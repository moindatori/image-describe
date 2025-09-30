'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface BulkImageUploadProps {
  onImagesSelect: (files: File[]) => void;
  isLoading?: boolean;
  maxFiles?: number;
}

interface FileWithPreview extends File {
  preview: string;
  id: string;
}

const BulkImageUpload: React.FC<BulkImageUploadProps> = ({ 
  onImagesSelect, 
  isLoading = false, 
  maxFiles = 10 
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.slice(0, maxFiles - files.length).map(file => {
      const fileWithPreview = Object.assign(file, {
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substr(2, 9)
      }) as FileWithPreview;
      return fileWithPreview;
    });

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onImagesSelect(updatedFiles);
  }, [files, maxFiles, onImagesSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isLoading || files.length >= maxFiles
  });

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(file => file.id !== fileId);
    setFiles(updatedFiles);
    onImagesSelect(updatedFiles);
  };

  const clearAll = () => {
    // Revoke object URLs to prevent memory leaks
    files.forEach(file => URL.revokeObjectURL(file.preview));
    setFiles([]);
    onImagesSelect([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400',
          (isLoading || files.length >= maxFiles) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-4">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop the images here' : 'Upload multiple images'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supports: JPEG, PNG, GIF, WebP (max 10MB each, up to {maxFiles} files)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {files.length} / {maxFiles} files selected
            </p>
          </div>
          {!isDragActive && files.length < maxFiles && (
            <Button variant="outline" size="md" disabled={isLoading}>
              Choose Files
            </Button>
          )}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Images ({files.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={isLoading}
            >
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div key={file.id} className="relative bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="aspect-w-16 aspect-h-9">
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-full h-32 object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  disabled={isLoading}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkImageUpload;