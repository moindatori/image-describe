'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Image as ImageIcon,
  Trash2,
  Download,
  Eye,
  Zap
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './Button';

// Types and Interfaces
interface ProcessResult {
  success: boolean;
  imageId?: string;
  filename: string;
  description?: string;
  confidence?: number;
  source?: string;
  error?: string;
  index: number;
  remainingCredits?: number;
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

interface FileWithPreview extends File {
  preview: string;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: ProcessResult;
}

interface BulkImageUploadProps {
  onImagesSelect: (files: File[]) => void;
  isLoading?: boolean;
  maxFiles?: number;
  onProcessingStart?: () => void;
  onProcessingComplete?: (results: ProcessResult[]) => void;
}

// Enhanced OOP Classes with modern patterns and better error handling
class FileManager {
  private files: FileWithPreview[] = [];
  private onUpdate: (files: FileWithPreview[]) => void;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private allowedTypes: string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  constructor(onUpdate: (files: FileWithPreview[]) => void, maxFileSize?: number) {
    this.onUpdate = onUpdate;
    if (maxFileSize) this.maxFileSize = maxFileSize;
  }

  private validateFile(file: File): { isValid: boolean; error?: string } {
    if (!this.allowedTypes.includes(file.type)) {
      return { isValid: false, error: 'Invalid file type. Please upload images only.' };
    }
    
    if (file.size > this.maxFileSize) {
      return { isValid: false, error: `File size exceeds ${this.formatFileSize(this.maxFileSize)} limit.` };
    }
    
    return { isValid: true };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  addFiles(newFiles: File[]): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    const validFiles: File[] = [];

    newFiles.forEach(file => {
      const validation = this.validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (validFiles.length > 0) {
      const filesWithPreview = validFiles.map(file => {
        const fileWithPreview = Object.assign(file, {
          preview: URL.createObjectURL(file),
          id: Math.random().toString(36).substr(2, 9),
          status: 'pending' as const
        }) as FileWithPreview;
        return fileWithPreview;
      });

      this.files = [...this.files, ...filesWithPreview];
      this.onUpdate(this.files);
    }

    return { success: validFiles.length > 0, errors };
  }

  removeFile(fileId: string): boolean {
    const fileToRemove = this.files.find(f => f.id === fileId);
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    this.files = this.files.filter(file => file.id !== fileId);
    this.onUpdate(this.files);
    return fileToRemove !== undefined;
  }

  updateFileStatus(index: number, status: FileWithPreview['status'], result?: ProcessResult): boolean {
    if (index >= 0 && index < this.files.length) {
      this.files[index] = {
        ...this.files[index],
        status,
        result
      };
      this.onUpdate([...this.files]);
      return true;
    }
    return false;
  }

  clearAll(): void {
    this.files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    this.files = [];
    this.onUpdate(this.files);
  }

  getFiles(): FileWithPreview[] {
    return [...this.files]; // Return copy to prevent external mutation
  }

  getFileCount(): number {
    return this.files.length;
  }

  getFilesByStatus(status: FileWithPreview['status']): FileWithPreview[] {
    return this.files.filter(file => file.status === status);
  }

  getTotalSize(): number {
    return this.files.reduce((total, file) => total + file.size, 0);
  }

  exportResults(): ProcessResult[] {
    return this.files
      .filter(file => file.result)
      .map(file => file.result!)
      .sort((a, b) => a.index - b.index);
  }
}

// Enhanced Progress Manager Class with statistics and better tracking
class ProgressManager {
  private current: number = 0;
  private total: number = 0;
  private successful: number = 0;
  private failed: number = 0;
  private startTime: number = 0;
  private onUpdate: (progress: { 
    current: number; 
    total: number; 
    successful: number; 
    failed: number;
    percentage: number;
    estimatedTimeRemaining?: number;
  }) => void;

  constructor(onUpdate: (progress: { 
    current: number; 
    total: number; 
    successful: number; 
    failed: number;
    percentage: number;
    estimatedTimeRemaining?: number;
  }) => void) {
    this.onUpdate = onUpdate;
  }

  setTotal(total: number): void {
    this.total = total;
    this.current = 0;
    this.successful = 0;
    this.failed = 0;
    this.startTime = Date.now();
    this.updateCallback();
  }

  updateProgress(current: number, isSuccess?: boolean): void {
    this.current = current;
    if (isSuccess === true) this.successful++;
    if (isSuccess === false) this.failed++;
    this.updateCallback();
  }

  incrementProgress(isSuccess?: boolean): void {
    this.current++;
    if (isSuccess === true) this.successful++;
    if (isSuccess === false) this.failed++;
    this.updateCallback();
  }

  private updateCallback(): void {
    const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const estimatedTimeRemaining = this.calculateEstimatedTime();
    
    this.onUpdate({ 
      current: this.current, 
      total: this.total, 
      successful: this.successful,
      failed: this.failed,
      percentage,
      estimatedTimeRemaining
    });
  }

  private calculateEstimatedTime(): number | undefined {
    if (this.current === 0 || this.startTime === 0) return undefined;
    
    const elapsed = Date.now() - this.startTime;
    const avgTimePerItem = elapsed / this.current;
    const remaining = this.total - this.current;
    
    return Math.round((remaining * avgTimePerItem) / 1000); // Return in seconds
  }

  reset(): void {
    this.current = 0;
    this.total = 0;
    this.successful = 0;
    this.failed = 0;
    this.startTime = 0;
    this.updateCallback();
  }

  getProgress(): { 
    current: number; 
    total: number; 
    successful: number;
    failed: number;
    percentage: number;
    estimatedTimeRemaining?: number;
  } {
    const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const estimatedTimeRemaining = this.calculateEstimatedTime();
    
    return { 
      current: this.current, 
      total: this.total, 
      successful: this.successful,
      failed: this.failed,
      percentage,
      estimatedTimeRemaining
    };
  }

  isComplete(): boolean {
    return this.current >= this.total && this.total > 0;
  }

  getSuccessRate(): number {
    return this.current > 0 ? (this.successful / this.current) * 100 : 0;
  }
}

// SSE Handler Class
class SSEHandler {
  private fileManager: FileManager;
  private progressManager: ProgressManager;
  private resultsRef: React.MutableRefObject<ProcessResult[]>;
  private onComplete?: (results: ProcessResult[]) => void;

  constructor(
    fileManager: FileManager,
    progressManager: ProgressManager,
    resultsRef: React.MutableRefObject<ProcessResult[]>,
    onComplete?: (results: ProcessResult[]) => void
  ) {
    this.fileManager = fileManager;
    this.progressManager = progressManager;
    this.resultsRef = resultsRef;
    this.onComplete = onComplete;
  }

  handleProgressUpdate(data: ProgressUpdate): void {
    try {
      switch (data.type) {
        case 'progress':
          if (typeof data.index === 'number' && typeof data.total === 'number') {
            this.progressManager.updateProgress(data.index);
            
            // Update file statuses to processing
            if (data.index > 0) {
              const files = this.fileManager.getFiles();
              files.forEach((_, idx) => {
                if (idx < data.index!) {
                  this.fileManager.updateFileStatus(idx, 'processing');
                }
              });
            }
          }
          break;
          
        case 'result':
          if (data.result && typeof data.result.index === 'number') {
            // Safely add to results
            this.resultsRef.current = [...this.resultsRef.current, data.result];
            
            // Update specific file status and result
            this.fileManager.updateFileStatus(
              data.result.index,
              data.result.success ? 'completed' : 'error',
              data.result
            );
          }
          break;
          
        case 'complete':
          if (this.onComplete) {
            this.onComplete(this.resultsRef.current);
          }
          break;
          
        case 'error':
          console.error('Processing error:', data.error);
          break;
      }
    } catch (error) {
      console.error('Error handling progress update:', error);
    }
  }

  parseSSEData(line: string): ProgressUpdate | null {
    try {
      if (line.startsWith('data: ')) {
        const jsonData = line.slice(6);
        if (jsonData.trim()) {
          return JSON.parse(jsonData);
        }
      }
    } catch (error) {
      console.error('Failed to parse SSE data:', error);
    }
    return null;
  }
}

const BulkImageUploadOptimized: React.FC<BulkImageUploadProps> = ({ 
  onImagesSelect, 
  isLoading = false, 
  maxFiles = 1000,
  onProcessingStart,
  onProcessingComplete
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ 
    current: number; 
    total: number; 
    successful: number; 
    failed: number; 
    percentage: number;
    estimatedTimeRemaining?: number;
  }>({ 
    current: 0, 
    total: 0, 
    successful: 0, 
    failed: 0, 
    percentage: 0,
    estimatedTimeRemaining: undefined
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const resultsRef = useRef<ProcessResult[]>([]);

  // Initialize managers
  const fileManagerRef = useRef<FileManager | null>(null);
  const progressManagerRef = useRef<ProgressManager | null>(null);
  const sseHandlerRef = useRef<SSEHandler | null>(null);

  useEffect(() => {
    fileManagerRef.current = new FileManager(setFiles);
    progressManagerRef.current = new ProgressManager(setProgress);
    sseHandlerRef.current = new SSEHandler(
      fileManagerRef.current,
      progressManagerRef.current,
      resultsRef,
      onProcessingComplete
    );
  }, [onProcessingComplete]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (fileManagerRef.current) {
      const result = fileManagerRef.current.addFiles(acceptedFiles);
      if (result.errors.length > 0) {
        setErrors(prev => [...prev, ...result.errors]);
        // Clear errors after 5 seconds
        setTimeout(() => {
          setErrors(prev => prev.filter(error => !result.errors.includes(error)));
        }, 5000);
      }
      onImagesSelect(fileManagerRef.current.getFiles());
    }
  }, [onImagesSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isLoading || isProcessing,
    maxFiles
  });

  const removeFile = useCallback((fileId: string) => {
    if (fileManagerRef.current) {
      fileManagerRef.current.removeFile(fileId);
      onImagesSelect(fileManagerRef.current.getFiles());
    }
  }, [onImagesSelect]);

  const clearAll = useCallback(() => {
    if (fileManagerRef.current && progressManagerRef.current) {
      fileManagerRef.current.clearAll();
      progressManagerRef.current.reset();
      resultsRef.current = [];
      onImagesSelect([]);
    }
  }, [onImagesSelect]);

  const processImages = async () => {
    if (!fileManagerRef.current || !progressManagerRef.current || !sseHandlerRef.current) {
      console.error('Managers not initialized');
      return;
    }

    const currentFiles = fileManagerRef.current.getFiles();
    if (currentFiles.length === 0) return;

    setIsProcessing(true);
    progressManagerRef.current.setTotal(currentFiles.length);
    resultsRef.current = [];
    onProcessingStart?.();

    try {
      const formData = new FormData();
      currentFiles.forEach((file) => {
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

      if (reader && sseHandlerRef.current) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            const data = sseHandlerRef.current.parseSSEData(line);
            if (data) {
              sseHandlerRef.current.handleProgressUpdate(data);
              
              if (data.type === 'complete') {
                setIsProcessing(false);
                break;
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusIcon = (status: FileWithPreview['status']) => {
    switch (status) {
      case 'pending':
        return <ImageIcon className="w-4 h-4 text-slate-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const downloadResults = () => {
    if (!fileManagerRef.current) return;
    
    const results = fileManagerRef.current.exportResults();
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `image-descriptions-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="w-full space-y-8">
      {/* Error Messages */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-red-800 font-semibold mb-2">Upload Errors</h4>
                <ul className="space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-red-700 text-sm">{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Upload Area */}
      <motion.div
        {...(() => {
          const rootProps = getRootProps();
          // Extract only the safe props, excluding all event handlers that conflict with framer-motion
          const { 
            onDrag, onDragEnd, onDragEnter, onDragExit, onDragLeave, onDragOver, onDragStart, onDrop,
            onAnimationStart, onAnimationEnd, onAnimationIteration,
            onTransitionStart, onTransitionEnd, onTransitionRun, onTransitionCancel,
            onClick, onMouseDown, onMouseUp, onMouseEnter, onMouseLeave, onMouseMove, onMouseOver, onMouseOut,
            onPointerDown, onPointerUp, onPointerEnter, onPointerLeave, onPointerMove, onPointerOver, onPointerOut,
            onTouchStart, onTouchEnd, onTouchMove, onTouchCancel,
            onKeyDown, onKeyUp, onKeyPress,
            onFocus, onBlur,
            ...safeProps 
          } = rootProps;
          return safeProps;
        })()}
        className={cn(
          'relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-500 group overflow-hidden',
          'bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20',
          isDragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-2xl shadow-blue-500/20'
            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-xl',
          (isLoading || isProcessing) && 'opacity-50 cursor-not-allowed'
        )}
        whileHover={{ scale: isDragActive ? 1.02 : 1.01 }}
        whileTap={{ scale: 0.98 }}
        onDragEnter={getRootProps().onDragEnter}
        onDragLeave={getRootProps().onDragLeave}
        onDragOver={getRootProps().onDragOver}
        onDrop={getRootProps().onDrop}
        onClick={getRootProps().onClick}
      >
        <input {...getInputProps()} />
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600" 
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='0.1'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
               }} />
        </div>

        <div className="relative flex flex-col items-center space-y-8">
          <motion.div 
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500',
              'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-2xl',
              isDragActive && 'animate-pulse shadow-blue-500/50'
            )}
            animate={{ 
              rotate: isDragActive ? 360 : 0,
              scale: isDragActive ? 1.1 : 1 
            }}
            transition={{ duration: 0.5 }}
          >
            <Upload className="w-12 h-12 text-white" />
          </motion.div>
          
          <div className="space-y-4">
            <motion.h3 
              className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent"
              animate={{ scale: isDragActive ? 1.05 : 1 }}
            >
              {isDragActive ? 'Drop your images here!' : 'Upload Multiple Images'}
            </motion.h3>
            
            <p className="text-slate-600 text-lg">
              Drag and drop your images or click to browse
            </p>
            
            <div className="flex flex-col items-center space-y-2 text-sm text-slate-500">
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <ImageIcon className="w-4 h-4" />
                  <span>JPEG, PNG, GIF, WebP</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Zap className="w-4 h-4" />
                  <span>Max 10MB each</span>
                </span>
              </div>
              
              {files.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-medium"
                >
                  {files.length} {files.length === 1 ? 'file' : 'files'} selected
                  {fileManagerRef.current && (
                    <span className="ml-2 text-blue-600">
                      ({formatFileSize(fileManagerRef.current.getTotalSize())})
                    </span>
                  )}
                </motion.div>
              )}
            </div>
          </div>
          
          {!isDragActive && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button 
                variant="outline" 
                size="lg" 
                disabled={isLoading}
                className="bg-white/90 backdrop-blur-sm border-slate-300 hover:bg-white hover:border-blue-400 hover:shadow-lg transition-all duration-300 px-8 py-3 text-lg font-semibold"
              >
                <Upload className="w-5 h-5 mr-2" />
                Choose Files
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Enhanced Progress Section */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl p-8 shadow-xl border border-slate-200"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 flex items-center">
                  <Loader2 className="w-6 h-6 mr-3 animate-spin text-blue-500" />
                  Processing Images
                </h3>
                <p className="text-slate-600 mt-1">
                  {progress.current} of {progress.total} completed
                  {progress.estimatedTimeRemaining && (
                    <span className="ml-2 text-blue-600">
                      • ~{formatTime(progress.estimatedTimeRemaining)} remaining
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600">
                  {progress.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-slate-500 space-x-4">
                  <span className="text-green-600">✓ {progress.successful}</span>
                  <span className="text-red-600">✗ {progress.failed}</span>
                </div>
              </div>
            </div>
            
            <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden shadow-inner">
              <motion.div 
                className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-4 rounded-full relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </motion.div>
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-lg font-bold text-slate-800">{progress.current}</div>
                <div className="text-xs text-slate-500">Processed</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-lg font-bold text-green-600">{progress.successful}</div>
                <div className="text-xs text-green-500">Successful</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-lg font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-red-500">Failed</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-r from-white via-blue-50/30 to-purple-50/20 border border-slate-200 rounded-2xl p-8 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 flex items-center">
                  <Zap className="w-6 h-6 mr-3 text-blue-500" />
                  Ready to Process
                </h3>
                <p className="text-slate-600 mt-2 text-lg">
                  {files.length} {files.length === 1 ? 'image' : 'images'} selected for AI description
                </p>
                {fileManagerRef.current && (
                  <p className="text-slate-500 mt-1">
                    Total size: {formatFileSize(fileManagerRef.current.getTotalSize())}
                  </p>
                )}
              </div>
              
              <div className="flex space-x-4">
                {progress.current > 0 && progress.successful > 0 && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={downloadResults}
                    className="px-6 py-3 border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 transition-all duration-300"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Export Results
                  </Button>
                )}
                
                {!isProcessing && (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={processImages}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold px-10 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Process All Images
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="lg"
                  onClick={clearAll}
                  disabled={isLoading || isProcessing}
                  className="px-6 py-3 border-slate-300 hover:border-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-300"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced File Grid */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-800">
                Selected Images ({files.length})
              </h3>
              {showPreview && (
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(null)}
                  className="text-slate-600"
                >
                  <X className="w-4 h-4 mr-2" />
                  Close Preview
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {files.map((file, index) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 group"
                  whileHover={{ y: -5 }}
                >
                  <div className="aspect-w-16 aspect-h-12 bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    
                    {/* Status Overlay */}
                    <div className="absolute top-3 left-3">
                      <div className={cn(
                        "flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm",
                        file.status === 'pending' && "bg-slate-100/90 text-slate-700",
                        file.status === 'processing' && "bg-blue-100/90 text-blue-700",
                        file.status === 'completed' && "bg-green-100/90 text-green-700",
                        file.status === 'error' && "bg-red-100/90 text-red-700"
                      )}>
                        {getStatusIcon(file.status)}
                        <span className="capitalize">{file.status}</span>
                      </div>
                    </div>

                    {/* Preview Button */}
                    <button
                      onClick={() => setShowPreview(file.preview)}
                      className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100 duration-300"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="p-5">
                    <div className="flex items-center space-x-3 mb-3">
                      <p className="text-sm font-semibold text-slate-800 truncate flex-1" title={file.name}>
                        {file.name}
                      </p>
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-4">
                      {formatFileSize(file.size)}
                    </p>
                    
                    {/* Enhanced Result Display */}
                    {file.result && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-4 rounded-xl text-xs border-2",
                          file.result.success 
                            ? "bg-green-50 border-green-200" 
                            : "bg-red-50 border-red-200"
                        )}
                      >
                        {file.result.success ? (
                          <div className="space-y-3">
                            <p className="text-green-700 font-bold flex items-center">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Processing Complete
                            </p>
                            <p className="text-slate-700 leading-relaxed line-clamp-4">
                              {file.result.description}
                            </p>
                            <div className="flex justify-between items-center pt-2 border-t border-green-200">
                              <span className="text-green-600 font-medium">
                                {file.result.confidence}% confidence
                              </span>
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                {file.result.source}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-red-700 font-bold flex items-center">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Processing Failed
                            </p>
                            <p className="text-red-600">
                              {file.result.error}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Remove Button */}
                  {!isProcessing && (
                    <motion.button
                      onClick={() => removeFile(file.id)}
                      className="absolute top-3 right-12 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      disabled={isLoading}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={showPreview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setShowPreview(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BulkImageUploadOptimized;