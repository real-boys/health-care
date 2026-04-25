import React from 'react';
import { ExternalLink, DollarSign, Calendar, User, MapPin } from 'lucide-react';
import './SearchResults.css';

/**
 * Search Results Component
 * Displays search results with relevant information
 */
const SearchResults = ({ searchType, results, metadata }) => {
  const isClaimsSearch = searchType === 'claims';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'status-pending',
      'processing': 'status-processing',
      'approved': 'status-approved',
      'completed': 'status-completed',
      'denied': 'status-denied',
      'failed': 'status-failed'
    };
    return colors[status] || 'status-default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'critical': 'priority-critical'
    };
    return colors[priority] || 'priority-default';
  };

  if (isClaimsSearch) {
    return (
      <div className="search-results">
        {results.map((claim) => (
          <div key={claim._id} className="result-card claims-card">
            <div className="result-header">
              <div className="result-title">
                <h3>{claim.claimNumber}</h3>
                <span className={`status-badge ${getStatusColor(claim.status)}`}>
                  {claim.status}
                </span>
                {claim.priority && (
                  <span className={`priority-badge ${getPriorityColor(claim.priority)}`}>
                    {claim.priority}
                  </span>
                )}
              </div>
              <a href={`/claims/${claim._id}`} className="result-link" title="View details">
                <ExternalLink size={18} />
              </a>
            </div>

            <div className="result-details">
              <div className="detail-row">
                <div className="detail-item">
                  <User size={16} />
                  <div>
                    <span className="detail-label">Claimant</span>
                    <p className="detail-value">{claim.claimant?.name}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Calendar size={16} />
                  <div>
                    <span className="detail-label">Incident Date</span>
                    <p className="detail-value">{formatDate(claim.incident?.date)}</p>
                  </div>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-item">
                  <span className="detail-label">Incident Type</span>
                  <p className="detail-value">{claim.incident?.type}</p>
                </div>
                {claim.incident?.location && (
                  <div className="detail-item">
                    <MapPin size={16} />
                    <div>
                      <span className="detail-label">Location</span>
                      <p className="detail-value">{claim.incident.location}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="detail-row">
                <div className="detail-item">
                  <DollarSign size={16} />
                  <div>
                    <span className="detail-label">Claim Amount</span>
                    <p className="detail-value">{formatCurrency(claim.estimatedAmount)}</p>
                  </div>
                </div>
                {claim.approvedAmount && (
                  <div className="detail-item">
                    <DollarSign size={16} />
                    <div>
                      <span className="detail-label">Approved Amount</span>
                      <p className="detail-value">{formatCurrency(claim.approvedAmount)}</p>
                    </div>
                  </div>
                )}
              </div>

              {claim.claimant?.relationship && (
                <div className="detail-row">
                  <div className="detail-item">
                    <span className="detail-label">Relationship</span>
                    <p className="detail-value">{claim.claimant.relationship}</p>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Claim Type</span>
                    <p className="detail-value">{claim.claimType}</p>
                  </div>
                </div>
              )}
            </div>

            {claim.incident?.description && (
              <div className="result-description">
                <p>{claim.incident.description}</p>
              </div>
            )}

            <div className="result-footer">
              <span className="result-date">Created: {formatDate(claim.createdAt)}</span>
              <a href={`/claims/${claim._id}`} className="btn btn-sm btn-outline-primary">
                View Claim
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  } else {
    // Providers search results
    return (
      <div className="search-results">
        {results.map((provider) => (
          <div key={provider._id} className="result-card provider-card">
            <div className="result-header">
              <div className="result-title">
                <h3>
                  {provider.profile?.firstName} {provider.profile?.lastName}
                </h3>
                {provider.isActive ? (
                  <span className="status-badge status-approved">Active</span>
                ) : (
                  <span className="status-badge status-denied">Inactive</span>
                )}
              </div>
              <a href={`/providers/${provider._id}`} className="result-link" title="View details">
                <ExternalLink size={18} />
              </a>
            </div>

            <div className="result-details">
              <div className="detail-row">
                <div className="detail-item">
                  <span className="detail-label">Role</span>
                  <p className="detail-value">{provider.role}</p>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department</span>
                  <p className="detail-value">{provider.profile?.department || 'N/A'}</p>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-item">
                  <span className="detail-label">Email</span>
                  <p className="detail-value">
                    <a href={`mailto:${provider.email}`}>{provider.email}</a>
                  </p>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Phone</span>
                  <p className="detail-value">{provider.profile?.phone || 'N/A'}</p>
                </div>
              </div>

              {provider.profile?.organization && (
                <div className="detail-row">
                  <div className="detail-item">
                    <span className="detail-label">Organization</span>
                    <p className="detail-value">{provider.profile.organization}</p>
                  </div>
                  {provider.profile?.licenseNumber && (
                    <div className="detail-item">
                      <span className="detail-label">License</span>
                      <p className="detail-value">{provider.profile.licenseNumber}</p>
                    </div>
                  )}
                </div>
              )}

              {provider.permissions?.length > 0 && (
                <div className="detail-row">
                  <div className="detail-item full-width">
                    <span className="detail-label">Permissions</span>
                    <div className="permissions-list">
                      {provider.permissions.map((perm) => (
                        <span key={perm} className="permission-tag">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="result-footer">
              <span className="result-date">Joined: {formatDate(provider.createdAt)}</span>
              <a href={`/providers/${provider._id}`} className="btn btn-sm btn-outline-primary">
                View Profile
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  }
};

export default SearchResults;
