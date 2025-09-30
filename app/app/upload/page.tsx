'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { downloadSingleDescription, downloadBulkDescriptions, type DescriptionData } from '@/lib/download-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload01Icon, Image01Icon, AlertCircleIcon, Download01Icon, File01Icon } from '@hugeicons/core-free-icons';

interface DescriptionResult {
  description: string;
  confidence: number;
  timestamp: string;
  imageId?: string;
  remainingCredits?: number;
}

interface BulkResult {
  success: boolean;
  imageId?: string;
  filename: string;
  description?: string;
  confidence?: number;
  error?: string;
}

interface BulkResponse {
  results: BulkResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    creditsUsed: number;
    remainingCredits: number;
  };
}

const UploadPage = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DescriptionResult | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fetch user credits on component mount
  React.useEffect(() => {
    const fetchCredits = async () => {
      try {
        const response = await fetch('/api/user/credits');
        if (response.ok) {
          const data = await response.json();
          setUserCredits(data.credits);
        }
      } catch (error) {
        console.error('Failed to fetch credits:', error);
      }
    };
    fetchCredits();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      handleFilesSelect(imageFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFilesSelect(files);
    }
  };

  const handleFilesSelect = (files: File[]) => {
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    if (validFiles.length !== files.length) {
      setError('Some files were skipped. Only JPEG, PNG, GIF, and WebP files under 10MB are supported.');
    } else {
      setError(null);
    }

    setSelectedFiles(validFiles.slice(0, 10)); // Limit to 10 files
    setResult(null);
    setBulkResults(null);
  };

  const handleDescribeImages = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      if (selectedFiles.length === 1) {
        // Single image mode
        formData.append('image', selectedFiles[0]);
      } else {
        // Bulk mode
        selectedFiles.forEach((file) => {
          formData.append('images', file);
        });
      }

      const response = await fetch('/api/describe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process images');
      }

      const data = await response.json();
      
      if (selectedFiles.length === 1) {
        // Single image response
        setResult({
          description: data.description,
          confidence: data.confidence || 95,
          timestamp: new Date().toLocaleString(),
          imageId: data.id,
          remainingCredits: data.creditsRemaining,
        });
        setUserCredits(data.creditsRemaining);
      } else {
        // Bulk response
        setBulkResults(data);
        setUserCredits(data.summary.remainingCredits);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResult = () => {
    if (result && selectedFiles[0]) {
      console.log('Saving result:', { file: selectedFiles[0].name, result });
      alert('Result saved successfully!');
    }
  };

  const handleDownloadSingleResult = () => {
    if (result && selectedFiles[0]) {
      const descriptionData: DescriptionData = {
        filename: selectedFiles[0].name,
        description: result.description,
        confidence: result.confidence,
        timestamp: result.timestamp,
        source: 'ideogram'
      };
      downloadSingleDescription(descriptionData);
    }
  };

  const handleDownloadBulkResults = () => {
    if (bulkResults && bulkResults.results.length > 0) {
      const successfulResults = bulkResults.results.filter(result => result.success);
      const descriptionData: DescriptionData[] = successfulResults.map(result => ({
        filename: result.filename,
        description: result.description || '',
        confidence: result.confidence,
        timestamp: new Date().toLocaleString(),
        source: 'ideogram'
      }));
      downloadBulkDescriptions(descriptionData);
    }
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setResult(null);
    setBulkResults(null);
    setError(null);
  };

  const isSingleMode = selectedFiles.length === 1;
  const isBulkMode = selectedFiles.length > 1;
  const requiredCredits = selectedFiles.length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Image Description
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Upload one or multiple images and get AI-powered descriptions using Ideogram API
            </p>
          </div>
          {userCredits !== null && (
            <div className="text-right bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-200">
              <p className="text-sm text-slate-600 font-medium">Available Credits</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{userCredits}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Unified Upload Section */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Upload Images</h2>
          
          {/* Unified Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ${
              dragActive 
                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg transform scale-105' 
                : selectedFiles.length > 0 
                  ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md' 
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
            />
            
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 text-slate-400">
                <HugeiconsIcon icon={Upload01Icon} size={64} strokeWidth={2} />
              </div>
              
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {selectedFiles.length > 0 
                    ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                    : 'Upload images'
                  }
                </p>
                <p className="text-base text-slate-600 mt-2 font-medium">
                  Drag and drop or click to browse
                </p>
                <p className="text-sm text-slate-500 mt-3 bg-slate-100 px-3 py-1 rounded-full inline-block">
                  Supports: JPEG, PNG, GIF, WebP (max 10MB each, up to 10 files)
                </p>
              </div>
            </div>
          </div>

          {/* Selected Files Display */}
          {selectedFiles.length > 0 && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Selected Files</h3>
                <Button variant="outline" onClick={clearFiles} className="text-sm bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 font-medium">
                  Clear All
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center">
                        <HugeiconsIcon icon={Image01Icon} size={24} strokeWidth={2} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate max-w-48">{file.name}</p>
                        <p className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full inline-block">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Action Button */}
              <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-blue-900">
                    {isSingleMode ? 'Ready to Describe' : 'Ready to Process'}
                  </h3>
                  <div className="text-sm text-blue-700 bg-blue-100 px-3 py-1 rounded-full font-medium">
                    {requiredCredits} credit{requiredCredits > 1 ? 's' : ''} required
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={handleDescribeImages}
                  disabled={isLoading || (userCredits !== null && userCredits < requiredCredits)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0"
                >
                  {isLoading ? 
                    `${isSingleMode ? 'Describing' : 'Processing'} ${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}...` : 
                   userCredits !== null && userCredits < requiredCredits ? 
                   `Insufficient Credits (Need ${requiredCredits}, Have ${userCredits})` : 
                   `${isSingleMode ? 'Describe Image' : `Describe ${selectedFiles.length} Images`} (${requiredCredits} credit${requiredCredits > 1 ? 's' : ''})`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {isBulkMode ? 'Processing Results' : 'Description Result'}
          </h2>
          
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">
                {isSingleMode ? 'Analyzing image...' : 'Processing images...'}
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <HugeiconsIcon icon={AlertCircleIcon} size={20} strokeWidth={2} className="text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Single Image Result */}
          {result && isSingleMode && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-800 mb-2">Description Generated</h3>
                <p className="text-gray-700 leading-relaxed">{result.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">Confidence:</span>
                  <span className="ml-2 text-gray-600">{result.confidence}%</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">Generated:</span>
                  <span className="ml-2 text-gray-600">{result.timestamp}</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button variant="primary" onClick={handleSaveResult} className="flex-1">
                  Save Result
                </Button>
                <Button variant="outline" onClick={handleDownloadSingleResult} className="flex-1">
                  <HugeiconsIcon icon={Download01Icon} size={16} strokeWidth={2} className="mr-2" />
                  Download TXT
                </Button>
                <Button variant="outline" onClick={() => setResult(null)} className="flex-1">
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Results */}
          {bulkResults && isBulkMode && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Total</p>
                  <p className="text-2xl font-bold text-blue-900">{bulkResults.summary.total}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Successful</p>
                  <p className="text-2xl font-bold text-green-900">{bulkResults.summary.successful}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-800">Failed</p>
                  <p className="text-2xl font-bold text-red-900">{bulkResults.summary.failed}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm font-medium text-purple-800">Credits Used</p>
                  <p className="text-2xl font-bold text-purple-900">{bulkResults.summary.creditsUsed}</p>
                </div>
              </div>

              {/* Individual Results */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Individual Results</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bulkResults.results.map((result, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${
                      result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{result.filename}</h4>
                          {result.success ? (
                            <div className="mt-2">
                              <p className="text-gray-700 text-sm">{result.description}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Confidence: {result.confidence}%
                              </p>
                            </div>
                          ) : (
                            <p className="text-red-700 text-sm mt-1">{result.error}</p>
                          )}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {result.success ? 'Success' : 'Failed'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download Button for Bulk Results */}
              {bulkResults.summary.successful > 0 && (
                <div className="flex justify-center">
                  <Button variant="primary" onClick={handleDownloadBulkResults} className="px-6">
                    <HugeiconsIcon icon={Download01Icon} size={16} strokeWidth={2} className="mr-2" />
                    Download All Descriptions as TXT ({bulkResults.summary.successful} files)
                  </Button>
                </div>
              )}
            </div>
          )}

          {!result && !bulkResults && !isLoading && !error && (
            <div className="text-center py-12 text-gray-500">
              <HugeiconsIcon icon={File01Icon} size={48} strokeWidth={2} className="mx-auto mb-4 text-gray-300" />
              <p>Upload images to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;