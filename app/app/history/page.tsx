'use client';

import React, { useState, useEffect } from 'react';

import { downloadSingleDescription, downloadBulkDescriptions, type DescriptionData } from '@/lib/download-utils';
import { Button } from '@/components/ui/Button';

interface HistoryItem {
  id: string;
  filename: string;
  description: string;
  confidence: number;
  source: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

interface UserCredits {
  credits: number;
  userId: string;
  email: string;
  name: string;
}

interface HistoryResponse {
  descriptions: HistoryItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const HistoryPage = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  });

  const fetchHistory = async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
      });
      
      const response = await fetch(`/api/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      
      const data: HistoryResponse = await response.json();
      setHistoryItems(data.descriptions);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCredits = async () => {
    try {
      const response = await fetch('/api/user/credits');
      if (!response.ok) throw new Error('Failed to fetch credits');
      
      const data: UserCredits = await response.json();
      // Credits fetched successfully but not stored in state
    } catch (error) {
      console.error('Error fetching user credits:', error);
    }
  };

  useEffect(() => {
    fetchHistory(currentPage, searchTerm);
    fetchUserCredits();
  }, [currentPage, searchTerm]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchHistory(1, searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);



  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownloadSingle = (item: HistoryItem) => {
    const descriptionData: DescriptionData = {
      filename: item.filename,
      description: item.description,
      confidence: item.confidence,
      timestamp: new Date(item.createdAt).toLocaleString(),
      source: item.source
    };
    downloadSingleDescription(descriptionData);
  };

  const handleDownloadAll = () => {
    if (historyItems.length === 0) return;
    
    const descriptionData: DescriptionData[] = historyItems.map(item => ({
      filename: item.filename,
      description: item.description,
      confidence: item.confidence,
      timestamp: new Date(item.createdAt).toLocaleString(),
      source: item.source
    }));
    
    downloadBulkDescriptions(descriptionData, 'all_descriptions_history');
  };

  if (loading && historyItems.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Credits */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">History</h1>
            <p className="text-gray-600 mt-1">View and manage your previous image descriptions</p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-2">
            <Button variant="outline" onClick={handleDownloadAll} disabled={historyItems.length === 0}>
              Download All as TXT
            </Button>
            
          </div>
        </div>
      </div>



      {/* Results */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {pagination.totalCount} Results
          </h2>
        </div>
        
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : historyItems.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">
              {searchTerm ? 'No descriptions found matching your search.' : 'No image descriptions yet. Upload an image to get started!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {historyItems.map((item) => (
              <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">{item.filename}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.source === 'ideogram' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.source}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed mb-3">{item.description}</p>
                      <div className="flex items-center text-xs text-gray-500 space-x-4">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                        {item.fileSize && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {formatFileSize(item.fileSize)}
                          </div>
                        )}
                        {item.mimeType && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                            </svg>
                            {item.mimeType.split('/')[1].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button 
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => navigator.clipboard.writeText(item.description)}
                      title="Copy description"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button 
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => handleDownloadSingle(item)}
                      title="Download as TXT"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-4-4m4 4l4-4m-6 4h8a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h8z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{((pagination.currentPage - 1) * 10) + 1}</span> to{' '}
              <span className="font-medium">{Math.min(pagination.currentPage * 10, pagination.totalCount)}</span> of{' '}
              <span className="font-medium">{pagination.totalCount}</span> results
            </p>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!pagination.hasPrev || loading}
                onClick={() => handlePageChange(pagination.currentPage - 1)}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!pagination.hasNext || loading}
                onClick={() => handlePageChange(pagination.currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;