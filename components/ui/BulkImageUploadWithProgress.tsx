'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface BulkImageUploadProps {
  onImagesSelect: (files: File[]) => void;
  isLoading?: boolean;
  maxFiles?: number;
  onProcessingStart?: () => void;
  onProcessingComplete?: (results: ProcessResult[]) => void;
}

interface FileWithPreview extends File {
  preview: string;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: ProcessResult;
}

interface ProcessResult {
  success: boolean;
  imageId?: string;
  filename: string;
  description?: string;
  confidence?: number;
  source?: string;
  error?: string;
  index: number;
}

interface ProgressUpdate {
  type: 'progress' | 'result' | 'complete' | 'error';
  index?: number;
  total?: number;
  result?: ProcessResult;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    creditsUsed: number;
    remainingCredits: number;
  };
  error?: string;
}

const BulkImageUploadWithProgress: React.FC<BulkImageUploadProps> = ({ 
  onImagesSelect, 
  isLoading = false, 
  maxFiles = 10,
  onProcessingStart,
  onProcessingComplete
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const resultsRef = useRef<ProcessResult[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => {
      const fileWithPreview = Object.assign(file, {
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substr(2, 9),
        status: 'pending' as const
      }) as FileWithPreview;
      return fileWithPreview;
    });

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onImagesSelect(updatedFiles);
  }, [files, onImagesSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isLoading || isProcessing
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
    setProgress({ current: 0, total: 0 });
    onImagesSelect([]);
  };

  const processImages = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });
    resultsRef.current = [];
    onProcessingStart?.();

    // Reset file statuses
    const updatedFiles = files.map(file => ({ ...file, status: 'pending' as const }));
    setFiles(updatedFiles);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/api/describe/bulk', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process images');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: ProgressUpdate = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'progress':
                    if (data.index !== undefined && data.total !== undefined) {
                      setProgress({ current: data.index, total: data.total });
                      
                      // Update file status to processing
                      if (data.index > 0 && data.index <= files.length) {
                        setFiles(prev => prev.map((file, idx) => ({
                          ...file,
                          status: idx < data.index! ? 'processing' : file.status
                        })));
                      }
                    }
                    break;
                    
                  case 'result':
                    if (data.result) {
                      // Add to ref for immediate access
                      resultsRef.current = [...resultsRef.current, data.result];
                      
                      // Update specific file status and result
                      setFiles(prev => prev.map((file, idx) => 
                        idx === data.result!.index 
                          ? { 
                              ...file, 
                              status: data.result!.success ? 'completed' : 'error',
                              result: data.result
                            }
                          : file
                      ));
                    }
                    break;
                    
                  case 'complete':
                    setIsProcessing(false);
                    if (data.summary) {
                      // Pass the accumulated results to parent
                      onProcessingComplete?.(resultsRef.current);
                    }
                    break;
                    
                  case 'error':
                    setIsProcessing(false);
                    console.error('Processing error:', data.error);
                    break;
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing images:', error);
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: FileWithPreview['status']) => {
    switch (status) {
      case 'pending':
        return (
          <div className="w-4 h-4 rounded-full bg-gray-300"></div>
        );
      case 'processing':
        return (
          <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
        );
      case 'completed':
        return (
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
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
          (isLoading || isProcessing) && 'opacity-50 cursor-not-allowed'
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
              Supports: JPEG, PNG, GIF, WebP (max 10MB each, unlimited files)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {files.length} files selected
            </p>
          </div>
          {!isDragActive && !isProcessing && (
            <Button variant="outline" size="md" disabled={isLoading}>
              Choose Files
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Processing images...</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {files.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Ready to Process 
              </h3>
              
            </div>
            <div className="flex space-x-3">
              {!isProcessing && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={processImages}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 text-lg"
                >
                  Process
                </Button>
              )}
              <Button
                variant="outline"
                size="md"
                onClick={clearAll}
                disabled={isLoading || isProcessing}
                className="px-6 py-3"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Images ({files.length})
            </h3>
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
                  <div className="flex items-center space-x-2 mb-2">
                    {getStatusIcon(file.status)}
                    <p className="text-sm font-medium text-gray-900 truncate flex-1" title={file.name}>
                      {file.name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {formatFileSize(file.size)}
                  </p>
                  
                  {/* Show result if available */}
                  {file.result && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      {file.result.success ? (
                        <div>
                          <p className="text-green-600 font-medium">✓ Processed</p>
                          <p className="text-gray-600 mt-1 line-clamp-2">
                            {file.result.description}
                          </p>
                          <p className="text-gray-500 mt-1">
                            Confidence: {file.result.confidence}%
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-red-600 font-medium">✗ Failed</p>
                          <p className="text-red-500 mt-1">
                            {file.result.error}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!isProcessing && (
                  <button
                    onClick={() => removeFile(file.id)}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    disabled={isLoading}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkImageUploadWithProgress;