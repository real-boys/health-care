import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './FilterPanel.css';

/**
 * Filter Panel Component
 * Displays filters based on search type
 */
const FilterPanel = ({ searchType, filters, filterOptions, onChange }) => {
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    amount: true,
    dates: false,
    text: false,
    advanced: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFilterChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const handleArrayFilterChange = (key, value) => {
    const current = filters[key] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: updated });
  };

  const isClaimsSearch = searchType === 'claims';

  return (
    <div className="filter-panel">
      {/* Status Filter */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('status')}
        >
          <ChevronDown
            size={16}
            className={expandedSections.status ? 'expanded' : ''}
          />
          <span>Status</span>
        </button>
        {expandedSections.status && (
          <div className="filter-options">
            {filterOptions.statuses.map(status => (
              <label key={status} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={(filters.status || []).includes(status)}
                  onChange={() => handleArrayFilterChange('status', status)}
                />
                <span className={`status-badge status-${status}`}>{status}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Claim Type Filter (Claims only) */}
      {isClaimsSearch && (
        <div className="filter-section">
          <button
            className="filter-section-header"
            onClick={() => toggleSection('claimType')}
          >
            <ChevronDown
              size={16}
              className={expandedSections.claimType ? 'expanded' : ''}
            />
            <span>Claim Type</span>
          </button>
          {expandedSections.claimType && (
            <div className="filter-options">
              {filterOptions.claimTypes.map(type => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={(filters.claimType || []).includes(type)}
                    onChange={() => handleArrayFilterChange('claimType', type)}
                  />
                  <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Priority Filter (Claims only) */}
      {isClaimsSearch && (
        <div className="filter-section">
          <button
            className="filter-section-header"
            onClick={() => toggleSection('priority')}
          >
            <ChevronDown
              size={16}
              className={expandedSections.priority ? 'expanded' : ''}
            />
            <span>Priority</span>
          </button>
          {expandedSections.priority && (
            <div className="filter-options">
              {filterOptions.priorities.map(priority => (
                <label key={priority} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={(filters.priority || []).includes(priority)}
                    onChange={() => handleArrayFilterChange('priority', priority)}
                  />
                  <span className={`priority-badge priority-${priority}`}>{priority}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Amount Range (Claims only) */}
      {isClaimsSearch && (
        <div className="filter-section">
          <button
            className="filter-section-header"
            onClick={() => toggleSection('amount')}
          >
            <ChevronDown
              size={16}
              className={expandedSections.amount ? 'expanded' : ''}
            />
            <span>Amount Range</span>
          </button>
          {expandedSections.amount && (
            <div className="filter-inputs">
              <div className="input-group">
                <label>Min Amount</label>
                <input
                  type="number"
                  min="0"
                  value={filters.amountMin || ''}
                  onChange={(e) => handleFilterChange('amountMin', e.target.value)}
                  placeholder="$0"
                  className="filter-input"
                />
              </div>
              <div className="input-group">
                <label>Max Amount</label>
                <input
                  type="number"
                  min="0"
                  value={filters.amountMax || ''}
                  onChange={(e) => handleFilterChange('amountMax', e.target.value)}
                  placeholder="No limit"
                  className="filter-input"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Date Range */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('dates')}
        >
          <ChevronDown
            size={16}
            className={expandedSections.dates ? 'expanded' : ''}
          />
          <span>{isClaimsSearch ? 'Incident Date' : 'Created Date'}</span>
        </button>
        {expandedSections.dates && (
          <div className="filter-inputs">
            <div className="input-group">
              <label>From</label>
              <input
                type="date"
                value={filters[isClaimsSearch ? 'dateFrom' : 'createdFrom'] || ''}
                onChange={(e) =>
                  handleFilterChange(
                    isClaimsSearch ? 'dateFrom' : 'createdFrom',
                    e.target.value
                  )
                }
                className="filter-input"
              />
            </div>
            <div className="input-group">
              <label>To</label>
              <input
                type="date"
                value={filters[isClaimsSearch ? 'dateTo' : 'createdTo'] || ''}
                onChange={(e) =>
                  handleFilterChange(
                    isClaimsSearch ? 'dateTo' : 'createdTo',
                    e.target.value
                  )
                }
                className="filter-input"
              />
            </div>
          </div>
        )}
      </div>

      {/* Text Search Fields */}
      <div className="filter-section">
        <button
          className="filter-section-header"
          onClick={() => toggleSection('text')}
        >
          <ChevronDown
            size={16}
            className={expandedSections.text ? 'expanded' : ''}
          />
          <span>Search Fields</span>
        </button>
        {expandedSections.text && (
          <div className="filter-inputs">
            {isClaimsSearch ? (
              <>
                <div className="input-group">
                  <label>Claim Number</label>
                  <input
                    type="text"
                    value={filters.claimNumber || ''}
                    onChange={(e) => handleFilterChange('claimNumber', e.target.value)}
                    placeholder="e.g., CLM-20240101-1234"
                    className="filter-input"
                  />
                </div>
                <div className="input-group">
                  <label>Claimant Name</label>
                  <input
                    type="text"
                    value={filters.claimantName || ''}
                    onChange={(e) => handleFilterChange('claimantName', e.target.value)}
                    placeholder="Full name"
                    className="filter-input"
                  />
                </div>
                <div className="input-group">
                  <label>Incident Type</label>
                  <input
                    type="text"
                    value={filters.incidentType || ''}
                    onChange={(e) => handleFilterChange('incidentType', e.target.value)}
                    placeholder="e.g., auto accident"
                    className="filter-input"
                  />
                </div>
                <div className="input-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={filters.location || ''}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                    placeholder="City, State"
                    className="filter-input"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={filters.name || ''}
                    onChange={(e) => handleFilterChange('name', e.target.value)}
                    placeholder="First or last name"
                    className="filter-input"
                  />
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={filters.email || ''}
                    onChange={(e) => handleFilterChange('email', e.target.value)}
                    placeholder="Email address"
                    className="filter-input"
                  />
                </div>
                <div className="input-group">
                  <label>License Number</label>
                  <input
                    type="text"
                    value={filters.licenseNumber || ''}
                    onChange={(e) => handleFilterChange('licenseNumber', e.target.value)}
                    placeholder="License number"
                    className="filter-input"
                  />
                </div>
                <div className="input-group">
                  <label>Organization</label>
                  <input
                    type="text"
                    value={filters.organization || ''}
                    onChange={(e) => handleFilterChange('organization', e.target.value)}
                    placeholder="Hospital, clinic name"
                    className="filter-input"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Role Filter (Providers only) */}
      {!isClaimsSearch && (
        <div className="filter-section">
          <button
            className="filter-section-header"
            onClick={() => toggleSection('role')}
          >
            <ChevronDown
              size={16}
              className={expandedSections.role ? 'expanded' : ''}
            />
            <span>Role</span>
          </button>
          {expandedSections.role && (
            <div className="filter-options">
              {filterOptions.roles.map(role => (
                <label key={role} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={(filters.role || []).includes(role)}
                    onChange={() => handleArrayFilterChange('role', role)}
                  />
                  <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Status (Providers only) */}
      {!isClaimsSearch && (
        <div className="filter-section">
          <button
            className="filter-section-header"
            onClick={() => toggleSection('active')}
          >
            <ChevronDown
              size={16}
              className={expandedSections.active ? 'expanded' : ''}
            />
            <span>Status</span>
          </button>
          {expandedSections.active && (
            <div className="filter-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.isActive !== false}
                  onChange={(e) => handleFilterChange('isActive', e.target.checked)}
                />
                <span>Active Only</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
