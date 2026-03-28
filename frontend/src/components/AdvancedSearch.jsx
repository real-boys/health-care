import React, { useState, useCallback, useEffect } from 'react';
import { Search, Filter, ChevronRight, Star, Trash2, Plus, Clock } from 'lucide-react';
import FilterPanel from './FilterPanel';
import SearchResults from './SearchResults';
import SavedSearchesPanel from './SavedSearchesPanel';
import './AdvancedSearch.css';

/**
 * Advanced Search Component
 * Comprehensive search interface for claims and providers
 */
const AdvancedSearch = ({ searchType = 'claims' }) => {
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState('recent');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [results, setResults] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showFilters, setShowFilters] = useState(true);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null);
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'saved'

  const [newSearch, setNewSearch] = useState(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveSearchDescription, setSaveSearchDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch results when filters/sort/page changes
  useEffect(() => {
    performSearch();
  }, [filters, sortBy, page, limit, searchTerm]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/search/filter-options', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setFilterOptions(data.options);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const performSearch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page,
        limit,
        sortBy,
        search: searchTerm,
        ...flattenFilters(filters)
      });

      const response = await fetch(
        `/api/search/${searchType}?${params}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data.data || []);
      setMetadata(data.metadata);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, page, limit, searchTerm, searchType]);

  const flattenFilters = (filters) => {
    const flattened = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && 
          !(Array.isArray(value) && value.length === 0)) {
        flattened[key] = Array.isArray(value) ? value : value;
      }
    });
    return flattened;
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPage(1);
  };

  const handleSearchTermChange = (term) => {
    setSearchTerm(term);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) {
      alert('Please enter a search name');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: saveSearchName,
          description: saveSearchDescription,
          searchType,
          filters,
          sortBy,
          tags: []
        })
      });

      if (!response.ok) throw new Error('Failed to save search');

      setShowSaveDialog(false);
      setSaveSearchName('');
      setSaveSearchDescription('');
      alert('Search saved successfully!');
    } catch (err) {
      alert('Error saving search: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => 
    v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  ) || searchTerm !== '';

  return (
    <div className="advanced-search">
      {/* Header */}
      <div className="search-header">
        <div className="search-title">
          <h1>
            {searchType === 'claims' ? '📋 Search Claims' : '👥 Search Providers'}
          </h1>
          <p>{searchType === 'claims' ? 'Find and manage insurance claims' : 'Find healthcare providers'}</p>
        </div>

        <div className="search-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowSavedSearches(!showSavedSearches)}
          >
            <Clock size={16} />
            {showSavedSearches ? 'Hide Saved' : 'Saved Searches'}
          </button>
          {hasActiveFilters && (
            <button className="btn btn-outline-secondary" onClick={clearFilters}>
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="search-container">
        {/* Left Sidebar - Filters */}
        {showFilters && (
          <aside className="search-sidebar">
            <div className="sidebar-header">
              <h3><Filter size={18} /> Filters</h3>
              <button
                className="btn-icon"
                onClick={() => setShowFilters(false)}
                title="Close filters"
              >
                ✕
              </button>
            </div>
            {filterOptions && (
              <FilterPanel
                searchType={searchType}
                filters={filters}
                filterOptions={filterOptions}
                onChange={handleFilterChange}
              />
            )}
          </aside>
        )}

        {/* Main Content */}
        <main className="search-main">
          {/* Search Bar */}
          <div className="search-bar-container">
            <div className="search-bar">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder={
                  searchType === 'claims'
                    ? 'Search claim number, claimant name, incident type...'
                    : 'Search provider name, email, license number...'
                }
                value={searchTerm}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                className="search-input"
              />
            </div>
            <button
              className="btn btn-icon filter-toggle"
              onClick={() => setShowFilters(!showFilters)}
              title="Toggle filters"
            >
              <Filter size={18} />
            </button>
          </div>

          {/* Results Toolbar */}
          <div className="results-toolbar">
            <div className="toolbar-left">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setShowSaveDialog(true)}
                disabled={!hasActiveFilters}
              >
                <Plus size={16} />
                Save Search
              </button>
            </div>

            <div className="toolbar-right">
              <div className="sort-container">
                <label htmlFor="sort-select">Sort by:</label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="sort-select"
                >
                  <option value="recent">Most Recent</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="date-desc">Date (Newest First)</option>
                  {searchType === 'claims' && (
                    <>
                      <option value="amount-desc">Amount (High to Low)</option>
                      <option value="amount-asc">Amount (Low to High)</option>
                    </>
                  )}
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                </select>
              </div>

              <div className="limit-container">
                <label htmlFor="limit-select">Per Page:</label>
                <select
                  id="limit-select"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="limit-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          {loading && <div className="loading">Searching...</div>}
          {error && <div className="error-message">Error: {error}</div>}

          {!loading && !error && (
            <>
              {results.length === 0 ? (
                <div className="no-results">
                  <p>No {searchType} found matching your criteria.</p>
                  <small>Try adjusting your filters or search terms.</small>
                </div>
              ) : (
                <>
                  <div className="results-info">
                    Showing <strong>{results.length}</strong> of <strong>{metadata?.total}</strong> results
                  </div>
                  <SearchResults
                    searchType={searchType}
                    results={results}
                    metadata={metadata}
                  />

                  {/* Pagination */}
                  {metadata && metadata.pages > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={page === 1}
                        className="page-btn"
                      >
                        ← First
                      </button>
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="page-btn"
                      >
                        Previous
                      </button>

                      <div className="page-info">
                        Page <strong>{page}</strong> of <strong>{metadata.pages}</strong>
                      </div>

                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === metadata.pages}
                        className="page-btn"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => handlePageChange(metadata.pages)}
                        disabled={page === metadata.pages}
                        className="page-btn"
                      >
                        Last →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>

        {/* Saved Searches Panel */}
        {showSavedSearches && (
          <aside className="search-sidebar saved-searches-panel">
            <div className="sidebar-header">
              <h3>
                <Clock size={18} />
                Saved Searches
              </h3>
              <button
                className="btn-icon"
                onClick={() => setShowSavedSearches(false)}
              >
                ✕
              </button>
            </div>
            <SavedSearchesPanel
              searchType={searchType}
              onSelectSearch={(search) => {
                setFilters(search.filters || {});
                setSortBy(search.sortBy || 'recent');
                setPage(1);
              }}
            />
          </aside>
        )}
      </div>

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="modal-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Save Search</h2>
              <button className="btn-close" onClick={() => setShowSaveDialog(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="search-name">Search Name *</label>
                <input
                  id="search-name"
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  placeholder="e.g., High-value claims this month"
                  maxLength={100}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="search-desc">Description</label>
                <textarea
                  id="search-desc"
                  value={saveSearchDescription}
                  onChange={(e) => setSaveSearchDescription(e.target.value)}
                  placeholder="Add notes about this search..."
                  maxLength={500}
                  rows={3}
                  className="form-textarea"
                />
              </div>
              <div className="search-summary">
                <strong>Current Filter Settings:</strong>
                <ul>
                  {Object.entries(flattenFilters(filters)).map(([key, value]) => (
                    <li key={key}>
                      <code>{key}</code>: {JSON.stringify(value)}
                    </li>
                  ))}
                  {searchTerm && (
                    <li><code>search</code>: {searchTerm}</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveSearch}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Search'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearch;
