import React, { useRef, useState, useCallback } from 'react';
import './DocumentUpload.css';

const DocumentUpload = ({ onUploadSuccess, onUploadError, folderId = null }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [metadata, setMetadata] = useState({
    documentType: 'other',
    description: '',
    tags: [],
  });

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
    }
  }, []);

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', metadata.documentType);
    formData.append('description', metadata.description);
    formData.append('tags', JSON.stringify(metadata.tags));
    if (folderId) {
      formData.append('folderId', folderId);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        const progress = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(progress);
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.data);
          } catch (error) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload request failed'));
      });

      xhr.open('POST', '/api/documents/upload');
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFiles = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
          const result = await uploadFile(file);
          uploadedFiles.push(result);
          setUploadProgress(((i + 1) / selectedFiles.length) * 100);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          if (onUploadError) {
            onUploadError(error.message);
          }
        }
      }

      if (uploadedFiles.length > 0 && onUploadSuccess) {
        onUploadSuccess(uploadedFiles);
      }

      setSelectedFiles([]);
      setMetadata({ documentType: 'other', description: '', tags: [] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (onUploadError) {
        onUploadError(error.message);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
  };

  const handleMetadataChange = (field, value) => {
    setMetadata((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTagAdd = (tag) => {
    if (tag && !metadata.tags.includes(tag)) {
      setMetadata((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    }
  };

  const handleTagRemove = (tag) => {
    setMetadata((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="document-upload">
      <div className="upload-container">
        {/* Drop Zone */}
        <div
          className={`upload-dropzone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="file-input"
            disabled={isUploading}
          />

          <div className="dropzone-content">
            <div className="dropzone-icon">📄</div>
            <h3>Drag and drop files here</h3>
            <p>or click to browse</p>
            <p className="file-size-limit">Max 100MB per file</p>
          </div>

          {selectedFiles.length > 0 && (
            <button
              type="button"
              className="btn-browse"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Add More Files
            </button>
          )}
        </div>

        {/* Metadata Section */}
        {selectedFiles.length > 0 && (
          <div className="metadata-section">
            <div className="metadata-group">
              <label>Document Type</label>
              <select
                value={metadata.documentType}
                onChange={(e) =>
                  handleMetadataChange('documentType', e.target.value)
                }
                disabled={isUploading}
              >
                <option value="other">Other</option>
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

            <div className="metadata-group">
              <label>Description</label>
              <textarea
                value={metadata.description}
                onChange={(e) =>
                  handleMetadataChange('description', e.target.value)
                }
                placeholder="Add a description..."
                rows={3}
                disabled={isUploading}
              />
            </div>

            <div className="metadata-group">
              <label>Tags</label>
              <div className="tags-input">
                <input
                  type="text"
                  placeholder="Add tag and press Enter"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTagAdd(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  disabled={isUploading}
                />
                <div className="tags-list">
                  {metadata.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleTagRemove(tag)}
                        disabled={isUploading}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Files List */}
        {selectedFiles.length > 0 && (
          <div className="files-section">
            <div className="files-header">
              <h4>Selected Files ({selectedFiles.length})</h4>
              <button
                type="button"
                className="btn-clear"
                onClick={handleClearAll}
                disabled={isUploading}
              >
                Clear All
              </button>
            </div>

            <div className="files-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-icon">📎</div>
                  <div className="file-info">
                    <p className="file-name">{file.name}</p>
                    <p className="file-size">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => handleRemoveFile(index)}
                    disabled={isUploading}
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="upload-progress-section">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="progress-text">{Math.round(uploadProgress)}% complete</p>
          </div>
        )}

        {/* Upload Button */}
        {selectedFiles.length > 0 && (
          <div className="upload-actions">
            <button
              className="btn-upload"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading
                ? `Uploading (${uploadProgress}%)...`
                : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;
