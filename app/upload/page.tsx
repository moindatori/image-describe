'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';
import { 
  Upload, 
  Image as ImageIcon, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Zap,
  Star,
  TrendingUp,
  FileImage,
  Sparkles,
  X,
  AlertCircle,
  Trash2,
  Eye,
  Plus
} from 'lucide-react';

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

interface FileWithPreview extends File {
  preview: string;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: ProcessResult;
}

interface ProgressState {
  current: number;
  total: number;
  successful: number;
  failed: number;
  percentage: number;
  estimatedTimeRemaining?: number;
}

// Modern Stats Card Component
const StatsCard = ({ icon: Icon, title, value, description, color = "blue" }: {
  icon: any;
  title: string;
  value: string | number;
  description: string;
  color?: "blue" | "green" | "purple" | "orange";
}) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700"
  };

  return (
    <Card className={`${colorClasses[color]} border-2 transition-all duration-200 hover:shadow-lg hover:scale-105`}>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-full bg-white/50">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs opacity-70">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

export default function ModernUploadPage() {
  const { user, loading } = useUser();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total: 0,
    successful: 0,
    failed: 0,
    percentage: 0
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [processedResults, setProcessedResults] = useState<ProcessResult[]>([]);
  const currentEventSource = useRef<EventSource | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileWithPreview[] = acceptedFiles.map((file, index) => {
      const fileWithPreview = Object.assign(file, {
        preview: URL.createObjectURL(file),
        id: `${Date.now()}-${index}`,
        status: 'pending' as const
      });
      return fileWithPreview;
    });

    setFiles(prev => [...prev, ...newFiles]);
    setErrors([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isProcessing,
    maxFiles: 1000
  });

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setProcessedResults([]);
    setProgress({
      current: 0,
      total: 0,
      successful: 0,
      failed: 0,
      percentage: 0
    });
    setErrors([]);
  }, []);

  const processImages = useCallback(async () => {
    if (files.length === 0 || !user || user.credits <= 0) return;

    setIsProcessing(true);
    setErrors([]);
    setProgress({
      current: 0,
      total: files.length,
      successful: 0,
      failed: 0,
      percentage: 0
    });
    setProcessedResults([]);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('images', file);
      });

      // Start the processing request
      const response = await fetch('/api/describe/bulk-with-credits', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process images');
      }

      // Set up Server-Sent Events for progress tracking
      const eventSource = new EventSource('/api/describe/bulk-with-credits/stream');
      currentEventSource.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress') {
            setProgress(prev => ({
              ...prev,
              current: data.index || 0,
              percentage: ((data.index || 0) / files.length) * 100
            }));
            
            // Update file status
            if (data.index !== undefined) {
              setFiles(prev => prev.map((file, index) => 
                index === data.index ? { ...file, status: 'processing' } : file
              ));
            }
          } else if (data.type === 'result') {
            const result = data.result;
            if (result) {
              setProcessedResults(prev => [...prev, result]);
              
              // Update file status and result
              setFiles(prev => prev.map((file, index) => 
                index === result.index 
                  ? { 
                      ...file, 
                      status: result.success ? 'completed' : 'error',
                      result: result
                    } 
                  : file
              ));
              
              setProgress(prev => ({
                ...prev,
                current: prev.current + 1,
                successful: result.success ? prev.successful + 1 : prev.successful,
                failed: result.success ? prev.failed : prev.failed + 1,
                percentage: ((prev.current + 1) / files.length) * 100
              }));
            }
          } else if (data.type === 'complete') {
            eventSource.close();
            currentEventSource.current = null;
            setIsProcessing(false);
            
            if (data.summary) {
              setProgress(prev => ({
                ...prev,
                current: data.summary.total,
                successful: data.summary.successful,
                failed: data.summary.failed,
                percentage: 100
              }));
            }
          } else if (data.type === 'error') {
            setErrors(prev => [...prev, data.error || 'Processing error occurred']);
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
        currentEventSource.current = null;
        setIsProcessing(false);
        setErrors(prev => [...prev, 'Connection error occurred during processing']);
      };

    } catch (error) {
      console.error('Error processing images:', error);
      setErrors(prev => [...prev, error instanceof Error ? error.message : 'Unknown error occurred']);
      setIsProcessing(false);
    }
  }, [files, user]);

  const downloadResults = () => {
    if (processedResults.length === 0) return;

    const content = processedResults.map(result => 
      `Image: ${result.filename}\n${result.success 
        ? `Description: ${result.description}\nConfidence: ${result.confidence}%\nSource: ${result.source}` 
        : `Error: ${result.error}`}\n---`
    ).join('\n');

    const summary = `Processing Summary\nTotal: ${progress.total}\nSuccessful: ${progress.successful}\nFailed: ${progress.failed}\n\n${content}`;
    
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image_descriptions_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentEventSource.current) {
        currentEventSource.current.close();
      }
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Authentication Required</CardTitle>
            <CardDescription>Please sign in to access the upload page</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-6">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Image Description Studio
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your images into detailed, accurate descriptions using advanced AI technology
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <StatsCard
            icon={Zap}
            title="Available Credits"
            value={user.credits}
            description="Ready to use"
            color="blue"
          />
          <StatsCard
            icon={TrendingUp}
            title="Images Uploaded"
            value={files.length}
            description="Ready to process"
            color="green"
          />
          <StatsCard
            icon={Star}
            title="AI Accuracy"
            value="95%"
            description="Average confidence"
            color="purple"
          />
          <StatsCard
            icon={FileImage}
            title="Formats Supported"
            value="All"
            description="JPG, PNG, WebP, etc."
            color="orange"
          />
        </div>

        {/* Error Messages */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  <ul className="list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Area - Only show when no files or not processing */}
        <AnimatePresence>
          {files.length === 0 && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-12"
            >
              <Card className="shadow-xl border-0">
                <CardContent className="p-0">
                  <div
                    {...getRootProps()}
                    className={`relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all duration-500 ${
                      isDragActive
                        ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                    } hover:scale-[1.01] active:scale-[0.98]`}
                  >
                    <input {...getInputProps()} />
                    
                    <motion.div 
                      className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-8"
                      animate={{ 
                        rotate: isDragActive ? 360 : 0,
                        scale: isDragActive ? 1.1 : 1 
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      <Upload className="w-12 h-12 text-white" />
                    </motion.div>
                    
                    <h3 className="text-3xl font-bold text-gray-900 mb-4">
                      {isDragActive ? 'Drop your images here!' : 'Upload Images'}
                    </h3>
                    
                    <p className="text-xl text-gray-600 mb-6">
                      Drag and drop your images or click to browse
                    </p>
                    
                    <div className="flex justify-center items-center space-x-8 text-sm text-gray-500 mb-8">
                      <span className="flex items-center space-x-2">
                        <ImageIcon className="w-5 h-5" />
                        <span>JPEG, PNG, GIF, WebP</span>
                      </span>
                      <span className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>Max 10MB each</span>
                      </span>
                    </div>
                    
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-3 text-lg"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Choose Files
                    </Button>
                   </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Button - Show when files are present */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button
                        {...getRootProps()}
                        variant="outline"
                        size="lg"
                        disabled={isProcessing}
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <input {...getInputProps()} />
                        <Plus className="w-5 h-5 mr-2" />
                        Add More Images
                      </Button>
                      
                      <div className="text-sm text-gray-600">
                        {files.length} {files.length === 1 ? 'image' : 'images'} selected
                        {files.length > 0 && (
                          <span className="ml-2">
                            ({formatFileSize(files.reduce((total, file) => total + file.size, 0))})
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {processedResults.length > 0 && (
                        <Button
                          onClick={downloadResults}
                          variant="outline"
                          size="lg"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Download Results
                        </Button>
                      )}
                      
                      {!isProcessing && (
                        <Button
                          onClick={processImages}
                          disabled={user.credits < files.length}
                          size="lg"
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold"
                        >
                          <Zap className="w-5 h-5 mr-2" />
                          Process Images ({files.length} credits)
                        </Button>
                      )}
                      
                      <Button
                        onClick={clearAll}
                        variant="outline"
                        size="lg"
                        disabled={isProcessing}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-5 h-5 mr-2" />
                        Clear All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
              className="mb-8"
            >
              <Card className="shadow-xl border-blue-200">
                <CardContent className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Loader2 className="w-6 h-6 mr-3 animate-spin text-blue-500" />
                        Processing Images
                      </h3>
                      <p className="text-gray-600 mt-1">
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
                      <div className="text-sm text-gray-500 space-x-4">
                        <span className="text-green-600">✓ {progress.successful}</span>
                        <span className="text-red-600">✗ {progress.failed}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.percentage}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  
                  <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-gray-800">{progress.current}</div>
                      <div className="text-xs text-gray-500">Processed</div>
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
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Images Grid - 8 columns */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-8"
            >
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <ImageIcon className="w-6 h-6 mr-2" />
                      Uploaded Images ({files.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-300 transition-colors">
                          <img
                            src={file.preview}
                            alt={file.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          
                          {/* Status indicator */}
                          <div className="absolute top-2 left-2">
                            <div className={`w-3 h-3 rounded-full ${
                              file.status === 'pending' ? 'bg-gray-400' :
                              file.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                              file.status === 'completed' ? 'bg-green-500' :
                              'bg-red-500'
                            }`} />
                          </div>
                          
                          {/* Action buttons */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex space-x-1">
                              <button
                                onClick={() => setShowPreview(file.preview)}
                                className="p-1 bg-black/50 text-white rounded hover:bg-black/70 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              {!isProcessing && (
                                <button
                                  onClick={() => removeFile(file.id)}
                                  className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-600 mt-1 truncate" title={file.name}>
                          {file.name}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section - Column layout */}
        <AnimatePresence>
          {processedResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                      Processing Results ({processedResults.length})
                    </span>
                    <Button
                      onClick={downloadResults}
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {processedResults.map((result, index) => (
                      <motion.div
                        key={`${result.filename}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-lg border-2 ${
                          result.success 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full ${
                              result.success ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                            <h4 className="font-semibold text-gray-800">{result.filename}</h4>
                          </div>
                          {result.success && (
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="text-xs">
                                {result.confidence}% confidence
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {result.source}
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        {result.success ? (
                          <p className="text-gray-700 leading-relaxed">
                            {result.description}
                          </p>
                        ) : (
                          <div className="flex items-center space-x-2 text-red-700">
                            <AlertCircle className="w-4 h-4" />
                            <p>{result.error}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
    </div>
  );
}