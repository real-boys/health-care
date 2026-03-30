const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // Notification Preferences
    notifications: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      claimUpdates: {
        type: Boolean,
        default: true,
      },
      paymentNotifications: {
        type: Boolean,
        default: true,
      },
      documentUploads: {
        type: Boolean,
        default: true,
      },
      systemAlerts: {
        type: Boolean,
        default: false,
      },
      smsNotifications: {
        type: Boolean,
        default: false,
      },
      pushNotifications: {
        type: Boolean,
        default: true,
      },
    },
    // Privacy Settings
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['private', 'registered', 'public'],
        default: 'registered',
      },
      showEmail: {
        type: Boolean,
        default: false,
      },
      showPhone: {
        type: Boolean,
        default: false,
      },
      allowSearchIndexing: {
        type: Boolean,
        default: false,
      },
      dataCollection: {
        type: Boolean,
        default: true,
      },
    },
    // Display Preferences
    display: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
      language: {
        type: String,
        default: 'en',
      },
      timeZone: {
        type: String,
        default: 'UTC',
      },
      dateFormat: {
        type: String,
        enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
        default: 'MM/DD/YYYY',
      },
      itemsPerPage: {
        type: Number,
        default: 10,
        min: 5,
        max: 100,
      },
      defaultView: {
        type: String,
        enum: ['list', 'grid', 'table'],
        default: 'list',
      },
    },
    // Security Preferences
    security: {
      twoFactorAuth: {
        enabled: {
          type: Boolean,
          default: false,
        },
        method: {
          type: String,
          enum: ['email', 'sms', 'authenticator', 'none'],
          default: 'none',
        },
      },
      requireStrongPassword: {
        type: Boolean,
        default: true,
      },
      sessionTimeout: {
        type: Number,
        default: 3600000,
        description: 'Session timeout in milliseconds (default 1 hour)',
      },
      logoutOnBrowserClose: {
        type: Boolean,
        default: false,
      },
      enableBiometric: {
        type: Boolean,
        default: false,
      },
      trustedDevices: [
        {
          deviceId: String,
          deviceName: String,
          lastUsed: Date,
          isTrusted: Boolean,
        },
      ],
    },
    // Communication Preferences
    communication: {
      preferredLanguage: {
        type: String,
        default: 'en',
      },
      preferredContactMethod: {
        type: String,
        enum: ['email', 'phone', 'sms', 'in-app'],
        default: 'email',
      },
      marketingEmails: {
        type: Boolean,
        default: false,
      },
      productUpdates: {
        type: Boolean,
        default: true,
      },
    },
    // Data & Privacy
    dataManagement: {
      allowAnalytics: {
        type: Boolean,
        default: true,
      },
      allowCookies: {
        type: Boolean,
        default: true,
      },
      dataRetention: {
        type: String,
        enum: ['30days', '90days', '1year', 'indefinite'],
        default: '1year',
      },
    },
    // Preferences Metadata
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: String,
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// Instance methods
userSettingsSchema.methods.updateNotificationPreferences = function(prefs) {
  Object.assign(this.notifications, prefs);
  return this.save();
};

userSettingsSchema.methods.updatePrivacySettings = function(settings) {
  Object.assign(this.privacy, settings);
  return this.save();
};

userSettingsSchema.methods.updateSecuritySettings = function(settings) {
  Object.assign(this.security, settings);
  return this.save();
};

userSettingsSchema.methods.addTrustedDevice = function(deviceId, deviceName) {
  const existingDevice = this.security.trustedDevices.find(
    (d) => d.deviceId === deviceId
  );

  if (existingDevice) {
    existingDevice.lastUsed = new Date();
    existingDevice.isTrusted = true;
  } else {
    this.security.trustedDevices.push({
      deviceId,
      deviceName,
      lastUsed: new Date(),
      isTrusted: true,
    });
  }

  return this.save();
};

userSettingsSchema.methods.removeTrustedDevice = function(deviceId) {
  this.security.trustedDevices = this.security.trustedDevices.filter(
    (d) => d.deviceId !== deviceId
  );
  return this.save();
};

userSettingsSchema.methods.getTrustedDevices = function() {
  return this.security.trustedDevices.filter((d) => d.isTrusted);
};

userSettingsSchema.methods.resetToDefaults = function() {
  const defaults = {
    notifications: {
      emailNotifications: true,
      claimUpdates: true,
      paymentNotifications: true,
      documentUploads: true,
      systemAlerts: false,
      smsNotifications: false,
      pushNotifications: true,
    },
    privacy: {
      profileVisibility: 'registered',
      showEmail: false,
      showPhone: false,
      allowSearchIndexing: false,
      dataCollection: true,
    },
    display: {
      theme: 'auto',
      language: 'en',
      timeZone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      itemsPerPage: 10,
      defaultView: 'list',
    },
    security: {
      twoFactorAuth: {
        enabled: false,
        method: 'none',
      },
      sessionTimeout: 3600000,
      logoutOnBrowserClose: false,
      enableBiometric: false,
    },
  };

  Object.assign(this, defaults);
  return this.save();
};

// Indexes
userSettingsSchema.index({ user: 1 });
userSettingsSchema.index({ 'security.twoFactorAuth.enabled': 1 });
userSettingsSchema.index({ createdAt: -1 });

module.exports = mongoose.model('UserSettings', userSettingsSchema);
