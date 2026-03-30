const User = require('../models/User');
const UserSettings = require('../models/UserSettings');
const SecurityLog = require('../models/SecurityLog');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class ProfileService {
  /**
   * Get complete user profile with settings
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId).select('-password -mfaSecret');
      if (!user) {
        throw new Error('User not found');
      }

      const settings = await UserSettings.findOne({ user: userId });
      const recentActivity = await SecurityLog.getRecentActivity(userId, 24);

      return {
        profile: user,
        settings: settings || {},
        activitySummary: {
          recentLogins: recentActivity.filter((a) => a.eventType === 'login')
            .length,
          failedAttempts: recentActivity.filter(
            (a) => a.eventType === 'login' && a.status === 'failed'
          ).length,
          securityEvents: recentActivity.filter(
            (a) => a.status !== 'success'
          ).length,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * Update user profile information
   */
  async updateProfile(userId, profileData) {
    try {
      const allowedFields = [
        'firstName',
        'lastName',
        'email',
        'phone',
        'avatar',
        'bio',
        'department',
        'specialization',
        'licenseNumber',
        'address',
        'city',
        'state',
        'zipCode',
        'country',
      ];

      const updateData = {};
      for (const field of allowedFields) {
        if (profileData[field] !== undefined) {
          updateData[field] = profileData[field];
        }
      }

      // Handle email change - requires verification
      if (updateData.email && updateData.email !== profileData.originalEmail) {
        updateData.emailVerified = false;
        updateData.emailVerificationToken = crypto.randomBytes(32).toString('hex');
        updateData.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

        // Log email change attempt
        await SecurityLog.logSecurityEvent({
          user: userId,
          eventType: 'email_change',
          status: 'pending',
          details: {
            reason: 'Email change requested',
            affectedField: 'email',
            oldValue: profileData.originalEmail,
            newValue: updateData.email,
            requiresVerification: true,
            verificationSent: true,
          },
          ipAddress: profileData.ipAddress,
          userAgent: profileData.userAgent,
        });
      }

      // Handle phone change
      if (updateData.phone && updateData.phone !== profileData.originalPhone) {
        updateData.phoneVerified = false;

        await SecurityLog.logSecurityEvent({
          user: userId,
          eventType: 'phone_change',
          status: 'pending',
          details: {
            reason: 'Phone change requested',
            affectedField: 'phone',
            oldValue: profileData.originalPhone,
            newValue: updateData.phone,
            requiresVerification: true,
          },
          ipAddress: profileData.ipAddress,
          userAgent: profileData.userAgent,
        });
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
      }).select('-password -mfaSecret');

      return updatedUser;
    } catch (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, oldPassword, newPassword, ipAddress, userAgent) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify old password
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        await SecurityLog.logSecurityEvent({
          user: userId,
          eventType: 'password_change',
          status: 'failed',
          severity: 'medium',
          details: {
            reason: 'Failed password verification',
          },
          ipAddress,
          userAgent,
        });

        throw new Error('Current password is incorrect');
      }

      // Validate new password strength
      const passwordStrength = this.validatePasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        throw new Error(`Password does not meet requirements: ${passwordStrength.errors.join(', ')}`);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.lastPasswordChange = new Date();
      user.passwordHistory = user.passwordHistory || [];

      // Store old password hash in history (keep last 5)
      user.passwordHistory.push({
        hashedPassword: await bcrypt.hash(oldPassword, 10),
        changedAt: new Date(),
      });

      if (user.passwordHistory.length > 5) {
        user.passwordHistory = user.passwordHistory.slice(-5);
      }

      await user.save();

      // Log successful password change
      await SecurityLog.logSecurityEvent({
        user: userId,
        eventType: 'password_change',
        status: 'success',
        severity: 'medium',
        details: {
          reason: 'Password changed by user',
        },
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      throw new Error(`Failed to change password: ${error.message}`);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email, ipAddress, userAgent) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if email exists
        return { success: true, message: 'Password reset link sent if email exists' };
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = await bcrypt.hash(resetToken, 10);

      user.passwordResetToken = resetTokenHash;
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save();

      await SecurityLog.logSecurityEvent({
        user: user._id,
        eventType: 'password_reset_requested',
        status: 'success',
        severity: 'low',
        details: {
          reason: 'Password reset requested',
          requiresVerification: true,
          verificationSent: true,
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Password reset link sent to email',
        resetToken,
      };
    } catch (error) {
      throw new Error(`Failed to request password reset: ${error.message}`);
    }
  }

  /**
   * Complete password reset
   */
  async completePasswordReset(resetToken, newPassword, ipAddress, userAgent) {
    try {
      const users = await User.find({
        passwordResetExpires: { $gt: Date.now() },
      });

      let user = null;
      for (const u of users) {
        const isValid = await bcrypt.compare(resetToken, u.passwordResetToken);
        if (isValid) {
          user = u;
          break;
        }
      }

      if (!user) {
        throw new Error('Invalid or expired password reset token');
      }

      // Validate new password strength
      const passwordStrength = this.validatePasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        throw new Error(`Password does not meet requirements: ${passwordStrength.errors.join(', ')}`);
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.lastPasswordChange = new Date();
      await user.save();

      await SecurityLog.logSecurityEvent({
        user: user._id,
        eventType: 'password_reset_completed',
        status: 'success',
        severity: 'medium',
        details: {
          reason: 'Password reset completed',
        },
        ipAddress,
        userAgent,
      });

      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      throw new Error(`Failed to complete password reset: ${error.message}`);
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const errors = [];
    const requirements = {
      minLength: password.length >= 12,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    if (!requirements.minLength) errors.push('At least 12 characters');
    if (!requirements.hasUpperCase) errors.push('At least one uppercase letter');
    if (!requirements.hasLowerCase) errors.push('At least one lowercase letter');
    if (!requirements.hasNumbers) errors.push('At least one number');
    if (!requirements.hasSpecialChar) errors.push('At least one special character');

    return {
      isValid: Object.values(requirements).every((v) => v),
      errors,
      requirements,
    };
  }

  /**
   * Get or create user settings
   */
  async getOrCreateSettings(userId) {
    try {
      let settings = await UserSettings.findOne({ user: userId });

      if (!settings) {
        settings = new UserSettings({ user: userId });
        await settings.save();
      }

      return settings;
    } catch (error) {
      throw new Error(`Failed to get/create settings: ${error.message}`);
    }
  }

  /**
   * Update user settings
   */
  async updateSettings(userId, settingsData) {
    try {
      let settings = await UserSettings.findOne({ user: userId });

      if (!settings) {
        settings = new UserSettings({ user: userId });
      }

      const allowedCategories = [
        'notifications',
        'privacy',
        'display',
        'security',
        'communication',
        'dataManagement',
      ];

      for (const category of allowedCategories) {
        if (settingsData[category]) {
          settings[category] = {
            ...settings[category],
            ...settingsData[category],
          };
        }
      }

      settings.lastUpdated = new Date();
      await settings.save();

      return settings;
    } catch (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  }

  /**
   * Get security activity
   */
  async getSecurityActivity(userId, limit = 50, offset = 0) {
    try {
      const logs = await SecurityLog.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);

      const total = await SecurityLog.countDocuments({ user: userId });

      return {
        logs,
        pagination: {
          total,
          limit,
          offset,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get security activity: ${error.message}`);
    }
  }

  /**
   * Get login history
   */
  async getLoginHistory(userId, limit = 20) {
    try {
      return await SecurityLog.getLoginHistory(userId, limit);
    } catch (error) {
      throw new Error(`Failed to get login history: ${error.message}`);
    }
  }

  /**
   * Add trusted device
   */
  async addTrustedDevice(userId, deviceId, deviceName) {
    try {
      const settings = await this.getOrCreateSettings(userId);
      await settings.addTrustedDevice(deviceId, deviceName);

      await SecurityLog.logSecurityEvent({
        user: userId,
        eventType: 'device_trusted',
        status: 'success',
        severity: 'low',
        deviceId,
        deviceName,
        details: {
          reason: 'Device marked as trusted',
        },
      });

      return settings;
    } catch (error) {
      throw new Error(`Failed to add trusted device: ${error.message}`);
    }
  }

  /**
   * Remove trusted device
   */
  async removeTrustedDevice(userId, deviceId) {
    try {
      const settings = await this.getOrCreateSettings(userId);
      await settings.removeTrustedDevice(deviceId);

      await SecurityLog.logSecurityEvent({
        user: userId,
        eventType: 'device_untrusted',
        status: 'success',
        severity: 'low',
        deviceId,
        details: {
          reason: 'Device removed from trusted list',
        },
      });

      return settings;
    } catch (error) {
      throw new Error(`Failed to remove trusted device: ${error.message}`);
    }
  }

  /**
   * Get trusted devices
   */
  async getTrustedDevices(userId) {
    try {
      const settings = await this.getOrCreateSettings(userId);
      return settings.getTrustedDevices();
    } catch (error) {
      throw new Error(`Failed to get trusted devices: ${error.message}`);
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(userId, verificationToken) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (
        user.emailVerificationToken !== verificationToken ||
        user.emailVerificationExpires < Date.now()
      ) {
        throw new Error('Invalid or expired verification token');
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      await SecurityLog.logSecurityEvent({
        user: userId,
        eventType: 'profile_updated',
        status: 'success',
        severity: 'low',
        details: {
          reason: 'Email verified',
          affectedField: 'email',
          verificationConfirmed: true,
        },
      });

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      throw new Error(`Failed to verify email: ${error.message}`);
    }
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(userId) {
    try {
      const user = await User.findById(userId).select('-password');
      const settings = await UserSettings.findOne({ user: userId });
      const activityLogs = await SecurityLog.find({ user: userId });

      return {
        profile: user,
        settings,
        activityLogs,
        exportedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to export user data: ${error.message}`);
    }
  }

  /**
   * Delete account (with GDPR compliance)
   */
  async deleteAccount(userId, password, reason) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Password is incorrect');
      }

      // Log account deletion
      await SecurityLog.logSecurityEvent({
        user: userId,
        eventType: 'account_locked',
        status: 'success',
        severity: 'critical',
        details: {
          reason: `Account deletion requested: ${reason}`,
        },
      });

      // Mark as deleted instead of hard delete (compliance)
      user.isDeleted = true;
      user.deletedAt = new Date();
      user.deletionReason = reason;
      user.email = `deleted-${userId}@deleted.local`;
      user.phone = null;
      await user.save();

      return { success: true, message: 'Account deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }

  /**
   * Check for suspicious activity
   */
  async checkSuspiciousActivity(userId) {
    try {
      const recentLogs = await SecurityLog.getRecentActivity(userId, 24);
      const failedAttempts = await SecurityLog.getFailedLoginAttempts(userId, 24);

      const suspiciousActivity = {
        failedLoginAttempts: failedAttempts.length,
        consecutiveFailures: 0,
        newLocations: 0,
        newDevices: 0,
        unusualTime: 0,
        requiresReview: false,
      };

      // Check consecutive failures
      let consecutiveCount = 0;
      for (const log of failedAttempts) {
        if (log.eventType === 'login' && log.status === 'failed') {
          consecutiveCount++;
        } else {
          break;
        }
      }
      suspiciousActivity.consecutiveFailures = consecutiveCount;

      // Check for new locations/devices
      const uniqueLocations = new Set();
      const uniqueDevices = new Set();

      for (const log of recentLogs) {
        if (log.isNewLocation) suspiciousActivity.newLocations++;
        if (log.isNewDevice) suspiciousActivity.newDevices++;
        if (log.isUnusualTime) suspiciousActivity.unusualTime++;

        if (log.location && log.location.country) {
          uniqueLocations.add(log.location.country);
        }
        if (log.deviceId) {
          uniqueDevices.add(log.deviceId);
        }
      }

      // Flag if suspicious
      if (
        suspiciousActivity.failedLoginAttempts > 5 ||
        suspiciousActivity.consecutiveFailures > 3 ||
        suspiciousActivity.newLocations > 2 ||
        suspiciousActivity.newDevices > 2
      ) {
        suspiciousActivity.requiresReview = true;
      }

      return suspiciousActivity;
    } catch (error) {
      throw new Error(`Failed to check suspicious activity: ${error.message}`);
    }
  }
}

module.exports = new ProfileService();
