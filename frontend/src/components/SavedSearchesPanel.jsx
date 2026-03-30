import React, { useState, useEffect } from 'react';
import { Star, Trash2, Play, Copy, Edit } from 'lucide-react';
import './SavedSearchesPanel.css';

/**
 * Saved Searches Panel Component
 * Displays and manages user's saved searches
 */
const SavedSearchesPanel = ({ searchType, onSelectSearch }) => {
  const [savedSearches, setSavedSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchSavedSearches();
  }, [searchType]);

  const fetchSavedSearches = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/saved?searchType=${searchType}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch saved searches');

      const data = await response.json();
      setSavedSearches(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSearch = async (id) => {
    if (!confirm('Delete this saved search?')) return;

    try {
      const response = await fetch(`/api/search/saved/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to delete search');

      setSavedSearches(prev => prev.filter(s => s._id !== id));
    } catch (err) {
      alert('Error deleting search: ' + err.message);
    }
  };

  const handlePinSearch = async (id, currentPinn) => {
    try {
      const response = await fetch(`/api/search/saved/${id}/pin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to pin search');

      const updatedSearch = await response.json();
      setSavedSearches(prev =>
        prev.map(s => (s._id === id ? updatedSearch.data : s))
          .sort((a, b) => b.isPinned - a.isPinned)
      );
    } catch (err) {
      alert('Error updating search: ' + err.message);
    }
  };

  const handleRunSearch = async (searchId) => {
    try {
      const response = await fetch(`/api/search/saved/${searchId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to load search');

      const data = await response.json();
      onSelectSearch(data.data);
    } catch (err) {
      alert('Error loading search: ' + err.message);
    }
  };

  const handleStartEdit = (search) => {
    setEditingId(search._id);
    setEditName(search.name);
  };

  const handleSaveEdit = async (searchId) => {
    if (!editName.trim()) {
      alert('Please enter a search name');
      return;
    }

    try {
      const response = await fetch(`/api/search/saved/${searchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: editName })
      });

      if (!response.ok) throw new Error('Failed to update search');

      const data = await response.json();
      setSavedSearches(prev =>
        prev.map(s => (s._id === searchId ? data.data : s))
      );
      setEditingId(null);
    } catch (err) {
      alert('Error updating search: ' + err.message);
    }
  };

  if (loading) {
    return <div className="saved-searches-loading">Loading saved searches...</div>;
  }

  if (error) {
    return <div className="saved-searches-error">Error: {error}</div>;
  }

  if (savedSearches.length === 0) {
    return (
      <div className="saved-searches-empty">
        <p>No saved searches yet.</p>
        <small>Save your first search from the main search interface.</small>
      </div>
    );
  }

  // Group searches by pinned status
  const pinnedSearches = savedSearches.filter(s => s.isPinned);
  const unpinnedSearches = savedSearches.filter(s => !s.isPinned);

  return (
    <div className="saved-searches-list">
      {/* Pinned Searches */}
      {pinnedSearches.length > 0 && (
        <div className="searches-group">
          <h4 className="group-title">📌 Pinned</h4>
          {pinnedSearches.map(search => (
            <SavedSearchItem
              key={search._id}
              search={search}
              isEditing={editingId === search._id}
              editName={editName}
              onEdit={() => handleStartEdit(search)}
              onSaveEdit={() => handleSaveEdit(search._id)}
              onCancel={() => setEditingId(null)}
              onRun={() => handleRunSearch(search._id)}
              onPin={() => handlePinSearch(search._id, search.isPinned)}
              onDelete={() => handleDeleteSearch(search._id)}
              onNameChange={setEditName}
            />
          ))}
        </div>
      )}

      {/* Unpinned Searches */}
      {unpinnedSearches.length > 0 && (
        <div className="searches-group">
          {pinnedSearches.length > 0 && <h4 className="group-title">💾 Other Searches</h4>}
          {unpinnedSearches.map(search => (
            <SavedSearchItem
              key={search._id}
              search={search}
              isEditing={editingId === search._id}
              editName={editName}
              onEdit={() => handleStartEdit(search)}
              onSaveEdit={() => handleSaveEdit(search._id)}
              onCancel={() => setEditingId(null)}
              onRun={() => handleRunSearch(search._id)}
              onPin={() => handlePinSearch(search._id, search.isPinned)}
              onDelete={() => handleDeleteSearch(search._id)}
              onNameChange={setEditName}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Individual Saved Search Item Component
 */
const SavedSearchItem = ({
  search,
  isEditing,
  editName,
  onEdit,
  onSaveEdit,
  onCancel,
  onRun,
  onPin,
  onDelete,
  onNameChange
}) => {
  const filterCount = Object.keys(search.filters || {}).length;
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="saved-search-item">
      {isEditing ? (
        <div className="edit-mode">
          <input
            type="text"
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={100}
            autoFocus
            className="edit-input"
          />
          <div className="edit-actions">
            <button className="btn btn-sm btn-primary" onClick={onSaveEdit}>
              Save
            </button>
            <button className="btn btn-sm btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="search-item-header">
            <div className="search-item-title">
              <h5>{search.name}</h5>
              {search.description && <p className="description">{search.description}</p>}
            </div>
            <button
              className={`pin-btn ${search.isPinned ? 'active' : ''}`}
              onClick={() => onPin()}
              title={search.isPinned ? 'Unpin' : 'Pin'}
            >
              <Star size={16} />
            </button>
          </div>

          <div className="search-item-details">
            <span className="detail">🔍 {filterCount} filters</span>
            {search.usageCount > 0 && (
              <span className="detail">📊 Used {search.usageCount}x</span>
            )}
            {search.lastExecuted && (
              <span className="detail">⏰ {formatDate(search.lastExecuted)}</span>
            )}
          </div>

          <div className="search-item-actions">
            <button className="btn btn-sm btn-primary" onClick={() => onRun()}>
              <Play size={14} />
              Run
            </button>
            <button className="btn btn-sm btn-secondary" onClick={() => onEdit()}>
              <Edit size={14} />
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => onDelete()}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SavedSearchesPanel;
