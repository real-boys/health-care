import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, FileText, Camera, AlertCircle, CheckCircle, X, Loader } from 'lucide-react';
import './ProfileEditor.css';

const ProfileEditor = ({ userId, onSaved }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [verificationPending, setVerificationPending] = useState(false);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile/basic', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to load profile');

      const data = await response.json();
      setProfile(data.data);
      setFormData(data.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData((prev) => ({
          ...prev,
          avatar: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          bio: formData.bio,
          department: formData.department,
          specialization: formData.specialization,
          licenseNumber: formData.licenseNumber,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
          avatar: imagePreview,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.data);
      setSuccess('Profile updated successfully!');
      setEditMode(false);

      // Check if email changed and needs verification
      if (data.data.email !== profile.email) {
        setVerificationPending(true);
      }

      if (onSaved) onSaved(data.data);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile);
    setImagePreview(null);
    setEditMode(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="profile-editor">
        <div className="profile-editor__loading">
          <Loader className="spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-editor">
        <div className="profile-editor__error">
          <AlertCircle />
          <p>Failed to load profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-editor">
      <div className="profile-editor__header">
        <h2>Profile Information</h2>
        {!editMode && (
          <button
            className="profile-editor__edit-btn"
            onClick={() => setEditMode(true)}
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="profile-editor__alert profile-editor__alert--error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="profile-editor__alert profile-editor__alert--success">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {verificationPending && (
        <div className="profile-editor__alert profile-editor__alert--info">
          <AlertCircle size={20} />
          <span>A verification link has been sent to your new email address</span>
          <button onClick={() => setVerificationPending(false)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="profile-editor__container">
        {/* Avatar Section */}
        <div className="profile-editor__avatar-section">
          <div className="profile-editor__avatar">
            {imagePreview || formData.avatar ? (
              <img src={imagePreview || formData.avatar} alt="Profile" />
            ) : (
              <User size={80} />
            )}
          </div>
          {editMode && (
            <div className="profile-editor__avatar-upload">
              <input
                type="file"
                id="avatarInput"
                onChange={handleImageChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <label htmlFor="avatarInput" className="profile-editor__upload-label">
                <Camera size={18} />
                Change Avatar
              </label>
            </div>
          )}
        </div>

        {/* Profile Form */}
        <form className="profile-editor__form" onSubmit={handleSaveProfile}>
          <div className="profile-editor__form-grid">
            {/* Name Section */}
            <div className="profile-editor__form-group">
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            {/* Contact Section */}
            <div className="profile-editor__form-group">
              <label>
                <Mail size={16} /> Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
              {profile.emailVerified && (
                <span className="profile-editor__verified">✓ Verified</span>
              )}
            </div>

            <div className="profile-editor__form-group">
              <label>
                <Phone size={16} /> Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            {/* Professional Section */}
            <div className="profile-editor__form-group profile-editor__form-group--full">
              <label>Bio / About</label>
              <textarea
                name="bio"
                value={formData.bio || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__textarea"
                placeholder="Tell us about yourself..."
                rows="4"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                value={formData.department || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>Specialization</label>
              <input
                type="text"
                name="specialization"
                value={formData.specialization || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>License Number</label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            {/* Address Section */}
            <div className="profile-editor__form-group profile-editor__form-group--full">
              <label>
                <MapPin size={16} /> Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>State / Province</label>
              <input
                type="text"
                name="state"
                value={formData.state || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>Zip / Postal Code</label>
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>

            <div className="profile-editor__form-group">
              <label>Country</label>
              <input
                type="text"
                name="country"
                value={formData.country || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="profile-editor__input"
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="profile-editor__info">
            <div className="profile-editor__info-item">
              <span className="profile-editor__label">Member Since</span>
              <span className="profile-editor__value">
                {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
            {profile.role && (
              <div className="profile-editor__info-item">
                <span className="profile-editor__label">Role</span>
                <span className="profile-editor__value">{profile.role}</span>
              </div>
            )}
            {profile.lastPasswordChange && (
              <div className="profile-editor__info-item">
                <span className="profile-editor__label">Last Password Change</span>
                <span className="profile-editor__value">
                  {new Date(profile.lastPasswordChange).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {editMode && (
            <div className="profile-editor__actions">
              <button
                type="button"
                className="profile-editor__cancel-btn"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="profile-editor__save-btn"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader size={16} className="spinner" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfileEditor;
