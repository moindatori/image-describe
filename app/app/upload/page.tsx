'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import BulkImageUploadOptimized from '@/components/ui/BulkImageUploadOptimized';
import { downloadSingleDescription, downloadBulkDescriptions, type DescriptionData } from '@/lib/download-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload01Icon, Image01Icon, AlertCircleIcon, Download01Icon } from '@hugeicons/core-free-icons';

interface DescriptionResult {
  description: string;
  confidence: number;
  timestamp: string;
  imageId?: string;
  remainingCredits?: number;
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

const UploadPage = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DescriptionResult | null>(null);
  const [bulkResults, setBulkResults] = useState<ProcessResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');

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

  const handleSingleImageUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/describe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process image');
      }

      const data = await response.json();
      
      setResult({
        description: data.description,
        confidence: data.confidence || 95,
        timestamp: new Date().toLocaleString(),
        imageId: data.id,
        remainingCredits: data.creditsRemaining,
      });
      setUserCredits(data.creditsRemaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkProcessingComplete = (results: ProcessResult[]) => {
    setBulkResults(results);
    // Update credits from the last result
    const lastResult = results[results.length - 1];
    if (lastResult && 'remainingCredits' in lastResult) {
      setUserCredits((lastResult as any).remainingCredits);
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
    if (bulkResults && bulkResults.length > 0) {
      const successfulResults = bulkResults.filter(result => result.success);
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

  const clearAll = () => {
    setSelectedFiles([]);
    setResult(null);
    setBulkResults([]);
    setError(null);
  };

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
              Upload images and get AI-powered descriptions with real-time progress tracking
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

      {/* Mode Toggle */}
      <div className="flex justify-center">
        <div className="bg-white rounded-lg p-1 shadow-md border border-gray-200">
          <button
            onClick={() => {
              setUploadMode('single');
              clearAll();
            }}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              uploadMode === 'single'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Single Image
          </button>
          <button
            onClick={() => {
              setUploadMode('bulk');
              clearAll();
            }}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              uploadMode === 'bulk'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Bulk Processing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {uploadMode === 'single' ? 'Upload Single Image' : 'Upload Multiple Images'}
          </h2>
          
          {uploadMode === 'single' ? (
            /* Single Image Upload */
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFiles([e.target.files[0]]);
                    }
                  }}
                  className="hidden"
                  id="single-file-input"
                  disabled={isLoading}
                />
                <label htmlFor="single-file-input" className="cursor-pointer">
                  <div className="space-y-4">
                    <HugeiconsIcon icon={Upload01Icon} size={48} className="mx-auto text-gray-400" />
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        {selectedFiles.length > 0 ? selectedFiles[0].name : 'Choose an image'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Click to browse or drag and drop
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Supports: JPEG, PNG, GIF, WebP (max 10MB)
                      </p>
                    </div>
                  </div>
                </label>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleSingleImageUpload(selectedFiles[0])}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Processing...' : 'Describe Image'}
                  </Button>
                  <Button variant="outline" onClick={clearAll} disabled={isLoading}>
                    Clear
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Bulk Image Upload with Progress */
            <BulkImageUploadOptimized
              onImagesSelect={setSelectedFiles}
              isLoading={isLoading}
              maxFiles={1000}
              userCredits={userCredits || 0}
              onCreditsUpdate={(newCredits) => setUserCredits(newCredits)}
              onProcessingStart={() => {
                setError(null);
                setBulkResults([]);
              }}
              onProcessingComplete={handleBulkProcessingComplete}
            />
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <HugeiconsIcon icon={AlertCircleIcon} size={20} className="text-red-500" />
                <p className="text-red-700 font-medium">Error</p>
              </div>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Results</h2>
          
          {uploadMode === 'single' && result && (
            <div className="space-y-4">
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-green-800">Description Generated</h3>
                  <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    {result.confidence}% confidence
                  </span>
                </div>
                <p className="text-gray-700 leading-relaxed">{result.description}</p>
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <span>{result.timestamp}</span>
                  <span>Credits remaining: {result.remainingCredits}</span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={handleDownloadSingleResult} variant="outline" className="flex-1">
                  <HugeiconsIcon icon={Download01Icon} size={16} className="mr-2" />
                  Download Result
                </Button>
              </div>
            </div>
          )}

          {uploadMode === 'bulk' && bulkResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  Bulk Results ({bulkResults.filter(r => r.success).length}/{bulkResults.length} successful)
                </h3>
                <Button onClick={handleDownloadBulkResults} variant="outline" size="sm">
                  <HugeiconsIcon icon={Download01Icon} size={16} className="mr-2" />
                  Download All
                </Button>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {bulkResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 truncate">
                        {result.filename}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        result.success
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {result.success ? '✓ Success' : '✗ Failed'}
                      </span>
                    </div>
                    {result.success ? (
                      <div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {result.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Confidence: {result.confidence}% | Source: {result.source}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadMode === 'bulk' && bulkResults.length === 0 && selectedFiles.length === 0 && (
            <div className="text-center py-12">
              <HugeiconsIcon icon={Image01Icon} size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Upload multiple images to see results here</p>
            </div>
          )}

          {uploadMode === 'single' && !result && selectedFiles.length === 0 && (
            <div className="text-center py-12">
              <HugeiconsIcon icon={Image01Icon} size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Upload an image to see the description here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;