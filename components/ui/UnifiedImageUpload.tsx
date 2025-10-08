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
  Plus,
  Download,
  Zap
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './Button';

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

interface UnifiedImageUploadProps {
  userCredits?: number;
  onCreditsUpdate?: (newCredits: number) => void;
  onProcessingComplete?: (results: ProcessResult[]) => void;
  showDownloadButton?: boolean;
  onDownloadAll?: () => void;
  downloadButtonText?: string;
}

// File Manager Class
class FileManager {
  private files: FileWithPreview[] = [];
  private onUpdate: (files: FileWithPreview[]) => void;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private allowedTypes: string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  constructor(onUpdate: (files: FileWithPreview[]) => void) {
    this.onUpdate = onUpdate;
  }

  private validateFile(file: File): { isValid: boolean; error?: string } {
    if (!this.allowedTypes.includes(file.type)) {
      return { isValid: false, error: `${file.name}: Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.` };
    }
    if (file.size > this.maxFileSize) {
      return { isValid: false, error: `${file.name}: File size too large. Maximum 10MB allowed.` };
    }
    return { isValid: true };
  }

  addFiles(newFiles: File[]): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    const validFiles: FileWithPreview[] = [];

    newFiles.forEach((file) => {
      const validation = this.validateFile(file);
      if (validation.isValid) {
        const fileWithPreview: FileWithPreview = Object.assign(file, {
          preview: URL.createObjectURL(file),
          id: Math.random().toString(36).substr(2, 9),
          status: 'pending' as const
        });
        validFiles.push(fileWithPreview);
      } else {
        errors.push(validation.error!);
      }
    });

    this.files = [...this.files, ...validFiles];
    this.onUpdate(this.files);
    return { success: errors.length === 0, errors };
  }

  removeFile(fileId: string): boolean {
    const index = this.files.findIndex(f => f.id === fileId);
    if (index !== -1) {
      URL.revokeObjectURL(this.files[index].preview);
      this.files.splice(index, 1);
      this.onUpdate(this.files);
      return true;
    }
    return false;
  }

  updateFileStatus(index: number, status: FileWithPreview['status'], result?: ProcessResult): boolean {
    if (index >= 0 && index < this.files.length) {
      this.files[index].status = status;
      if (result) {
        this.files[index].result = result;
      }
      this.onUpdate(this.files);
      return true;
    }
    return false;
  }

  clearAll(): void {
    this.files.forEach(file => {
      URL.revokeObjectURL(file.preview);
    });
    this.files = [];
    this.onUpdate(this.files);
  }

  getFiles(): FileWithPreview[] {
    return this.files;
  }

  getFileCount(): number {
    return this.files.length;
  }

  exportResults(): ProcessResult[] {
    return this.files
      .filter(file => file.result)
      .map(file => file.result!);
  }
}

// Progress Manager Class
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
    if (isSuccess !== undefined) {
      if (isSuccess) this.successful++;
      else this.failed++;
    }
    this.updateCallback();
  }

  private updateCallback(): void {
    const percentage = this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
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
    if (this.current === 0 || this.total === 0) return undefined;
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / elapsed;
    const remaining = this.total - this.current;
    return remaining / rate;
  }

  reset(): void {
    this.current = 0;
    this.total = 0;
    this.successful = 0;
    this.failed = 0;
    this.startTime = 0;
    this.updateCallback();
  }
}

const formatTime = (ms: number): string => {
  if (ms < 1000) return 'Less than a second';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const UnifiedImageUpload: React.FC<UnifiedImageUploadProps> = ({ 
  userCredits = 0,
  onCreditsUpdate,
  onProcessingComplete,
  showDownloadButton = false,
  onDownloadAll,
  downloadButtonText = "Download All Descriptions"
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
  const [results, setResults] = useState<ProcessResult[]>([]);

  const fileManagerRef = useRef<FileManager | null>(null);
  const progressManagerRef = useRef<ProgressManager | null>(null);

  useEffect(() => {
    fileManagerRef.current = new FileManager(setFiles);
    progressManagerRef.current = new ProgressManager(setProgress);

    return () => {
      fileManagerRef.current?.clearAll();
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!fileManagerRef.current) return;
    
    const result = fileManagerRef.current.addFiles(acceptedFiles);
    if (result.errors.length > 0) {
      setErrors(prev => [...prev, ...result.errors]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isProcessing
  });

  const removeFile = useCallback((fileId: string) => {
    fileManagerRef.current?.removeFile(fileId);
  }, []);

  const clearAll = useCallback(() => {
    fileManagerRef.current?.clearAll();
    setResults([]);
    setErrors([]);
    progressManagerRef.current?.reset();
  }, []);

  const processImages = useCallback(async () => {
    if (!fileManagerRef.current || !progressManagerRef.current) return;
    
    const filesToProcess = fileManagerRef.current.getFiles();
    if (filesToProcess.length === 0) return;

    // Upfront credit validation
    const requiredCredits = filesToProcess.length;
    if (userCredits < requiredCredits) {
      setErrors([`Insufficient credits! You need ${requiredCredits} credits but only have ${userCredits}. Please buy more credits to process all images.`]);
      return;
    }

    setIsProcessing(true);
    setErrors([]);
    progressManagerRef.current.setTotal(filesToProcess.length);

    try {
      const formData = new FormData();
      filesToProcess.forEach((file) => {
        formData.append('images', file);
      });

      // Use the correct bulk processing endpoint that returns SSE stream
      const response = await fetch('/api/describe/bulk', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process images');
      }

      // Handle the response as a stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response stream');
      }

      // Process the stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data: ProgressUpdate = JSON.parse(line.slice(6));
                  
                  if (data.type === 'progress') {
                    progressManagerRef.current?.updateProgress(data.index || 0);
                  } else if (data.type === 'result' && data.result) {
                    const result = data.result;
                    fileManagerRef.current?.updateFileStatus(
                      result.index, 
                      result.success ? 'completed' : 'error', 
                      result
                    );
                    progressManagerRef.current?.updateProgress(
                      result.index + 1, 
                      result.success
                    );
                    
                    // Update results in real-time
                    const currentResults = fileManagerRef.current?.exportResults() || [];
                    setResults(currentResults);
                    
                    // Update credits in real-time after each successful image processing
                    if (result.remainingCredits !== undefined && onCreditsUpdate) {
                      onCreditsUpdate(result.remainingCredits);
                    }
                    
                    // Notify parent component of each result
                    if (onProcessingComplete) {
                      onProcessingComplete(currentResults);
                    }
                  } else if (data.type === 'complete') {
                    setIsProcessing(false);
                    if (data.summary && onCreditsUpdate) {
                      onCreditsUpdate(data.summary.remainingCredits);
                    }
                    // Update results for display
                    const finalResults = fileManagerRef.current?.exportResults() || [];
                    setResults(finalResults);
                    // Notify parent component of completion
                    if (onProcessingComplete) {
                      onProcessingComplete(finalResults);
                    }
                  } else if (data.type === 'error') {
                    setErrors(prev => [...prev, data.error || 'Unknown error occurred']);
                    setIsProcessing(false);
                  }
                } catch (error) {
                  console.error('Error parsing SSE data:', error);
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          setIsProcessing(false);
        } finally {
          reader.releaseLock();
        }
      };

      // Start processing the stream
      processStream();

    } catch (error) {
      console.error('Error processing images:', error);
      setErrors(prev => [...prev, error instanceof Error ? error.message : 'Unknown error occurred']);
      setIsProcessing(false);
    }
  }, [onCreditsUpdate]);

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

  const canProcessImages = files.length > 0 && userCredits > 0 && !isProcessing;
  const estimatedCreditsNeeded = files.length;
  const hasInsufficientCredits = estimatedCreditsNeeded > userCredits;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          AI Image Description
        </h1>
        <p className="text-lg text-slate-600">
          Upload images and get AI-powered descriptions with real-time progress tracking
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-slate-500">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>Available Credits: {userCredits}</span>
          </span>
        </div>
      </div>

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
                <button
                  onClick={() => setErrors([])}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                >
                  Clear errors
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Area - Only show when no files or when not processing */}
      <AnimatePresence>
        {(files.length === 0 || !isProcessing) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            {...(() => {
              const rootProps = getRootProps();
              // Extract only the safe props, excluding all event handlers that conflict with framer-motion
              const { 
                onKeyDown, onFocus, onBlur, onClick, onDragEnter, onDragOver, onDragLeave, onDrop,
                onDrag, onDragEnd, onDragExit, onDragStart, onMouseDown, onMouseEnter, onMouseLeave, 
                onMouseMove, onMouseOut, onMouseOver, onMouseUp, onAnimationStart, onAnimationEnd,
                onAnimationIteration, onTransitionEnd, onTransitionStart, onTransitionCancel,
                ...safeProps 
              } = rootProps;
              return safeProps;
            })()}
            onClick={getRootProps().onClick}
            onKeyDown={getRootProps().onKeyDown}
            onDragEnter={getRootProps().onDragEnter}
            onDragOver={getRootProps().onDragOver}
            onDragLeave={getRootProps().onDragLeave}
            onDrop={getRootProps().onDrop}
            className={cn(
              'relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-500 group overflow-hidden',
              'bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20',
              isDragActive
                ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-2xl shadow-blue-500/20'
                : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-xl',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
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
                {files.length > 0 ? (
                  <Plus className="w-12 h-12 text-white" />
                ) : (
                  <Upload className="w-12 h-12 text-white" />
                )}
              </motion.div>

              <div className="space-y-4">
                <motion.h3 
                  className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent"
                  animate={{ scale: isDragActive ? 1.05 : 1 }}
                >
                  {isDragActive 
                    ? 'Drop your images here!' 
                    : files.length > 0 
                      ? 'Add More Images' 
                      : 'Upload Images'
                  }
                </motion.h3>
                
                <p className="text-slate-600 text-lg">
                  {files.length > 0 
                    ? 'Drag and drop more images or click to browse'
                    : 'Drag and drop your images or click to browse'
                  }
                </p>
                
                <div className="flex flex-col items-center space-y-2 text-sm text-slate-500">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1">
                      <ImageIcon className="w-4 h-4" />
                      <span>JPEG, PNG, GIF, WebP</span>
                    </span>
                    <span>•</span>
                    <span>Max 10MB per file</span>
                  </div>
                  <span>Single or multiple images supported</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Section */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-8 shadow-xl"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <h3 className="text-2xl font-bold text-slate-800">Processing Images</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{progress.percentage}%</div>
                  <div className="text-sm text-slate-600">
                    {progress.current} of {progress.total} completed
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Progress Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{progress.successful}</div>
                  <div className="text-sm text-slate-600">Successful</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                  <div className="text-sm text-slate-600">Failed</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {progress.estimatedTimeRemaining 
                      ? formatTime(progress.estimatedTimeRemaining)
                      : 'Calculating...'
                    }
                  </div>
                  <div className="text-sm text-slate-600">Time Remaining</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Images Grid */}
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
                Images ({files.length})
              </h3>
              <div className="flex space-x-4">
                {results.length > 0 && !showDownloadButton && (
                  <Button
                    variant="outline"
                    onClick={downloadResults}
                    className="px-6 py-3 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Export Results
                  </Button>
                )}
                {showDownloadButton && onDownloadAll && (
                  <Button
                    variant="outline"
                    onClick={onDownloadAll}
                    className="px-6 py-3 border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {downloadButtonText}
                  </Button>
                )}
                {canProcessImages && (
                  <Button
                    onClick={processImages}
                    disabled={hasInsufficientCredits}
                    className={cn(
                      "px-8 py-3 text-white",
                      hasInsufficientCredits 
                        ? "bg-gray-400 cursor-not-allowed" 
                        : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    )}
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Process {files.length} Image{files.length !== 1 ? 's' : ''} ({files.length} credit{files.length !== 1 ? 's' : ''})
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="px-6 py-3 border-slate-300 hover:border-red-400 hover:text-red-600"
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* 8-Column Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {files.map((file, index) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative group"
                >
                  <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                    <img
                      src={file.preview}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    
                    {/* Status Indicator */}
                    <div className="absolute top-2 left-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        file.status === 'pending' && "bg-slate-400",
                        file.status === 'processing' && "bg-blue-500 animate-pulse",
                        file.status === 'completed' && "bg-green-500",
                        file.status === 'error' && "bg-red-500"
                      )} />
                    </div>

                    {/* Remove Button */}
                    {!isProcessing && (
                      <button
                        onClick={() => removeFile(file.id)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Credit Warning */}
      {hasInsufficientCredits && files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
        >
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-yellow-800 font-semibold mb-2">Insufficient Credits</h4>
              <p className="text-yellow-700 text-sm">
                You need {estimatedCreditsNeeded} credits to process these images, but you only have {userCredits} credits available.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default UnifiedImageUpload;