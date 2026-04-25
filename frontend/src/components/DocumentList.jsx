import React, { useState, useEffect } from 'react';
import './DocumentList.css';

const DocumentList = ({ folderId, onDocumentSelect, viewMode = 'list' }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedDocs, setSelectedDocs] = useState([]);

  useEffect(() => {
    fetchDocuments();
  }, [folderId, page, searchQuery, filterType]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/documents/list?page=${page}&limit=10`;

      if (folderId) {
        url += `&folderId=${folderId}`;
      }

      if (searchQuery) {
        url = `/api/documents/search?q=${encodeURIComponent(searchQuery)}&page=${page}&limit=10`;
        if (filterType !== 'all') {
          url += `&documentType=${filterType}`;
        }
      } else if (filterType !== 'all') {
        setDocuments([]);
        setLoading(false);
        return;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      setDocuments(data.data);
      setPagination(data.pagination);
      setSelectedDocs([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?')) return;

    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) throw new Error('Delete failed');

      setDocuments((docs) => docs.filter((d) => d.id !== docId));
    } catch (error) {
      setError(error.message);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedDocs(documents.map((d) => d.id));
    } else {
      setSelectedDocs([]);
    }
  };

  const handleSelectDoc = (docId, checked) => {
    if (checked) {
      setSelectedDocs([...selectedDocs, docId]);
    } else {
      setSelectedDocs(selectedDocs.filter((id) => id !== docId));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="document-list">
      {/* Search & Filter */}
      <div className="list-toolbar">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="search-input"
        />

        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="filter-select"
        >
          <option value="all">All Types</option>
          <option value="invoice">Invoice</option>
          <option value="receipt">Receipt</option>
          <option value="medical-report">Medical Report</option>
          <option value="prescription">Prescription</option>
          <option value="claim-form">Claim Form</option>
          <option value="id-proof">ID Proof</option>
          <option value="insurance-card">Insurance Card</option>
          <option value="bank-statement">Bank Statement</option>
          <option value="tax-document">Tax Document</option>
          <option value="contract">Contract</option>
        </select>
      </div>

      {/* List Header */}
      {documents.length > 0 && (
        <div className="list-header">
          <div className="col-select">
            <input
              type="checkbox"
              onChange={(e) => handleSelectAll(e.target.checked)}
              checked={
                selectedDocs.length === documents.length &&
                documents.length > 0
              }
            />
          </div>
          <div className="col-name">Name</div>
          <div className="col-type">Type</div>
          <div className="col-size">Size</div>
          <div className="col-date">Modified</div>
          <div className="col-actions">Actions</div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="list-loading">
          <div className="spinner"></div>
          <p>Loading documents...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="list-error">
          <p>Error: {error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && documents.length === 0 && (
        <div className="list-empty">
          <p>No documents found</p>
        </div>
      )}

      {/* Document List */}
      {!loading && documents.length > 0 && (
        <div className={`document-items ${viewMode}`}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`document-item ${selectedDocs.includes(doc.id) ? 'selected' : ''}`}
            >
              <div className="col-select">
                <input
                  type="checkbox"
                  checked={selectedDocs.includes(doc.id)}
                  onChange={(e) =>
                    handleSelectDoc(doc.id, e.target.checked)
                  }
                />
              </div>

              <div className="col-name" onClick={() => onDocumentSelect?.(doc)}>
                <span className="doc-icon">📄</span>
                <span className="doc-name">{doc.originalFileName}</span>
              </div>

              <div className="col-type">
                <span className="type-badge">{doc.documentType}</span>
              </div>

              <div className="col-size">
                {formatFileSize(doc.fileSize)}
              </div>

              <div className="col-date">{formatDate(doc.createdAt)}</div>

              <div className="col-actions">
                <button
                  className="btn-icon btn-view"
                  onClick={() => onDocumentSelect?.(doc)}
                  title="View"
                >
                  👁️
                </button>
                <button
                  className="btn-icon btn-download"
                  onClick={() => {
                    window.location.href = `/api/documents/download/${doc.id}`;
                  }}
                  title="Download"
                >
                  ⬇️
                </button>
                <button
                  className="btn-icon btn-delete"
                  onClick={() => handleDelete(doc.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="list-pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>

          <span>
            Page {pagination.page} of {pagination.pages}
          </span>

          <button
            onClick={() =>
              setPage((p) => Math.min(pagination.pages, p + 1))
            }
            disabled={page === pagination.pages}
          >
            Next →
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedDocs.length > 0 && (
        <div className="bulk-actions">
          <p>{selectedDocs.length} selected</p>
          <button
            className="btn-delete"
            onClick={() => {
              if (window.confirm('Delete selected documents?')) {
                selectedDocs.forEach((id) => handleDelete(id));
              }
            }}
          >
            Delete Selected
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentList;
