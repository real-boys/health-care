import React, { useState, useEffect } from 'react';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import DocumentViewer from './DocumentViewer';
import './DocumentExplorer.css';

const DocumentExplorer = () => {
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentFolderName, setCurrentFolderName] = useState('Documents');
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [storageStats, setStorageStats] = useState(null);
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    loadRootFolders();
    loadStorageStats();
  }, []);

  const loadRootFolders = async () => {
    try {
      const response = await fetch('/api/documents/folders/root', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load folders');

      const data = await response.json();
      setFolders(data.data);
    } catch (error) {
      console.error('Load folders error:', error);
    }
  };

  const loadStorageStats = async () => {
    try {
      const response = await fetch('/api/documents/stats/storage', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load stats');

      const data = await response.json();
      setStorageStats(data.data);
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch('/api/documents/folder/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          name: newFolderName,
          parentFolderId: currentFolderId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create folder');

      setNewFolderName('');
      setShowCreateFolder(false);
      loadRootFolders();
    } catch (error) {
      console.error('Create folder error:', error);
    }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder and all its contents?')) return;

    try {
      const response = await fetch(`/api/documents/folder/${folderId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete folder');

      if (currentFolderId === folderId) {
        setCurrentFolderId(null);
        setCurrentFolderName('Documents');
      }
      loadRootFolders();
    } catch (error) {
      console.error('Delete folder error:', error);
    }
  };

  const handleFolderClick = (folder) => {
    setCurrentFolderId(folder.id);
    setCurrentFolderName(folder.name);
  };

  const handleUploadSuccess = () => {
    loadRootFolders();
    loadStorageStats();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="document-explorer">
      {selectedDocument ? (
        <DocumentViewer
          documentId={selectedDocument.id}
          onClose={() => setSelectedDocument(null)}
        />
      ) : (
        <>
          <div className="explorer-header">
            <h1>📁 Document Management</h1>
          </div>

          <div className="explorer-layout">
            {/* Sidebar */}
            <div className="explorer-sidebar">
              <div className="sidebar-section">
                <h3>Folders</h3>
                <button
                  className="btn-new-folder"
                  onClick={() => setShowCreateFolder(true)}
                >
                  + New Folder
                </button>

                <div className="folders-list">
                  <button
                    className={`folder-item ${currentFolderId === null ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentFolderId(null);
                      setCurrentFolderName('Documents');
                    }}
                  >
                    📁 All Documents
                  </button>

                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`folder-item ${currentFolderId === folder.id ? 'active' : ''}`}
                      onClick={() => handleFolderClick(folder)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (
                          window.confirm(
                            `Delete "${folder.name}"?`
                          )
                        ) {
                          deleteFolder(folder.id);
                        }
                      }}
                    >
                      <span className="folder-icon">📂</span>
                      <span className="folder-name">{folder.name}</span>
                      {folder.documentCount > 0 && (
                        <span className="doc-count">
                          {folder.documentCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {storageStats && storageStats.summary && (
                <div className="sidebar-section storage-stats">
                  <h3>Storage</h3>
                  <div className="storage-info">
                    <p>
                      <strong>
                        {storageStats.summary.totalFiles || 0}
                      </strong> Files
                    </p>
                    <p>
                      <strong>
                        {formatBytes(storageStats.summary.totalSize || 0)}
                      </strong> Used
                    </p>
                    <div className="storage-bar">
                      <div className="storage-used"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="explorer-main">
              {/* Top Bar */}
              <div className="explorer-topbar">
                <h2>{currentFolderName}</h2>
                <div className="topbar-controls">
                  <button
                    className="btn-icon"
                    title="List view"
                    onClick={() => setViewMode('list')}
                  >
                    ☰
                  </button>
                  <button
                    className="btn-icon"
                    title="Grid view"
                    onClick={() => setViewMode('grid')}
                  >
                    ⊞
                  </button>
                  <button
                    className="btn-upload"
                    onClick={() => setShowUpload(!showUpload)}
                  >
                    {showUpload ? '✕ Close Upload' : '+ Upload Files'}
                  </button>
                </div>
              </div>

              {/* Create Folder Modal */}
              {showCreateFolder && (
                <div className="modal-overlay" onClick={() => setShowCreateFolder(false)}>
                  <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                    <h3>Create New Folder</h3>
                    <input
                      type="text"
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') createFolder();
                      }}
                      autoFocus
                    />
                    <div className="modal-actions">
                      <button
                        className="btn-primary"
                        onClick={createFolder}
                        disabled={!newFolderName.trim()}
                      >
                        Create
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setShowCreateFolder(false);
                          setNewFolderName('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Section */}
              {showUpload && (
                <div className="upload-section">
                  <DocumentUpload
                    folderId={currentFolderId}
                    onUploadSuccess={handleUploadSuccess}
                  />
                </div>
              )}

              {/* Document List */}
              <DocumentList
                folderId={currentFolderId}
                onDocumentSelect={(doc) => setSelectedDocument(doc)}
                viewMode={viewMode}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentExplorer;
