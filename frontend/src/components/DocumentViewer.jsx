import React, { useEffect, useState } from 'react';
import './DocumentViewer.css';

const DocumentViewer = ({ documentId, onClose }) => {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('preview');

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(
          `/api/documents/preview/${documentId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('authToken')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const data = await response.json();
        setDocument(data.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setDocument(null);
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/documents/download/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.originalFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const renderPreview = () => {
    if (!document) return null;

    if (
      document.mimeType.startsWith('image/') &&
      document.thumbnailPath
    ) {
      return (
        <div className="preview-image">
          <img
            src={`/uploads/${document.thumbnailPath}`}
            alt={document.originalFileName}
          />
        </div>
      );
    }

    if (document.mimeType === 'application/pdf') {
      return (
        <div className="preview-pdf">
          <iframe
            src={`/api/documents/download/${documentId}`}
            title="PDF Viewer"
          />
        </div>
      );
    }

    if (document.mimeType.startsWith('text/')) {
      return (
        <div className="preview-text">
          <pre>{document.previewText}</pre>
        </div>
      );
    }

    return (
      <div className="preview-unavailable">
        <p>Preview not available for this file type</p>
        <p className="file-type">{document.mimeType}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="document-viewer">
        <div className="viewer-loading">Loading document...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-viewer">
        <div className="viewer-error">
          <p>Error: {error}</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="document-viewer">
      <div className="viewer-header">
        <div className="viewer-title">
          <h3>{document?.originalFileName}</h3>
          <p className="file-meta">
            {document?.fileSize && `${(document.fileSize / 1024).toFixed(2)} KB`}
            {document?.createdAt && ` • ${new Date(document.createdAt).toLocaleDateString()}`}
          </p>
        </div>
        <div className="viewer-actions">
          <button className="btn-download" onClick={handleDownload}>
            ⬇️ Download
          </button>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="viewer-tabs">
        <button
          className={`tab ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => setViewMode('preview')}
        >
          Preview
        </button>
        <button
          className={`tab ${viewMode === 'details' ? 'active' : ''}`}
          onClick={() => setViewMode('details')}
        >
          Details
        </button>
      </div>

      <div className="viewer-content">
        {viewMode === 'preview' && (
          <div className="preview-section">
            {renderPreview()}
          </div>
        )}

        {viewMode === 'details' && document && (
          <div className="details-section">
            <div className="detail-item">
              <label>File Name</label>
              <p>{document.originalFileName}</p>
            </div>
            <div className="detail-item">
              <label>File Size</label>
              <p>{(document.fileSize / 1024).toFixed(2)} KB</p>
            </div>
            <div className="detail-item">
              <label>File Type</label>
              <p>{document.mimeType}</p>
            </div>
            <div className="detail-item">
              <label>Document Type</label>
              <p className="badge">{document.documentType}</p>
            </div>
            {document.description && (
              <div className="detail-item">
                <label>Description</label>
                <p>{document.description}</p>
              </div>
            )}
            {document.tags && document.tags.length > 0 && (
              <div className="detail-item">
                <label>Tags</label>
                <div className="tags">
                  {document.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="detail-item">
              <label>Created</label>
              <p>{new Date(document.createdAt).toLocaleString()}</p>
            </div>
            <div className="detail-item">
              <label>Downloads</label>
              <p>{document.downloadCount}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
