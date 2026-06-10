import React, { useState, useRef } from 'react';
import type { Candidate } from '../types';

interface ResumeUploadProps {
  jobId: string;
  onUploadSuccess: (candidates: Candidate[]) => void;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ jobId, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
    }
  };

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Only allow PDF and text files
      if (file.type === 'application/pdf' || file.type === 'text/plain' || file.name.endsWith('.txt')) {
        formData.append('resumes', file);
      } else {
        setError("Only PDF and TXT files are supported.");
        setUploading(false);
        return;
      }
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload resumes. Check server status.");
      }

      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        const errorMsg = result.errors.map((e: any) => `${e.filename}: ${e.error}`).join(', ');
        setError(`Some files failed: ${errorMsg}`);
      }

      if (result.success && result.success.length > 0) {
        onUploadSuccess(result.success);
      } else {
        if (!result.errors || result.errors.length === 0) {
          setError("No resumes were successfully parsed.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // reset file input
      }
    }
  };

  return (
    <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: '1rem' }}>Upload Candidates</h3>
      
      <div 
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          multiple 
          accept=".pdf,.txt"
        />
        
        {uploading ? (
          <div className="spinner-container" style={{ padding: '1rem' }}>
            <div className="spinner" style={{ width: '30px', height: '30px' }}></div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Parsing resume(s) & calculating scores...</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">📤</div>
            <p style={{ fontWeight: 500 }}>Drag and drop resumes here, or click to browse</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supports PDF and TXT. Max 10 resumes in batch.</p>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: '0.8rem', padding: '0.6rem 1rem', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '0.8rem' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};
