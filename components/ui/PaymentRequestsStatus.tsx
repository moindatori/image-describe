'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

interface PaymentRequest {
  id: string;
  creditsRequested: number;
  amount: number;
  currency: string;
  location: string;
  paymentMethod: string;
  transactionId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

interface PaymentRequestsStatusProps {
  className?: string;
}

export default function PaymentRequestsStatus({ className = '' }: PaymentRequestsStatusProps) {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPaymentRequests();
  }, []);

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/payment-requests');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch payment requests');
      }

      setPaymentRequests(data.paymentRequests);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch payment requests');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Show all payment requests (pending, approved, and rejected)
  const relevantRequests = paymentRequests.filter(
    request => request.status === 'PENDING' || request.status === 'APPROVED' || request.status === 'REJECTED'
  );

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-48"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Alert className="border-red-200 bg-red-50">
          <div className="text-red-800">{error}</div>
        </Alert>
      </div>
    );
  }

  if (relevantRequests.length === 0) {
    return null; // Don't show anything if no relevant requests
  }

  return (
    <div className={`${className}`}>
      <h2 className="text-xl font-bold text-slate-900 mb-4">Your Payment Requests</h2>
      <div className="space-y-4">
        {relevantRequests.map((request) => (
          <Card key={request.id} className="p-4 border-slate-200 bg-white">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900">
                    {request.creditsRequested} Credits
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  {request.currency === 'PKR' ? '₨' : '$'}{request.amount} • {formatDate(request.createdAt)}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-slate-700">Payment Method:</span>
                <p className="text-slate-900">{request.paymentMethod}</p>
              </div>
              {request.transactionId && (
                <div>
                  <span className="font-medium text-slate-700">Transaction ID:</span>
                  <p className="text-slate-900 font-mono text-xs">{request.transactionId}</p>
                </div>
              )}
            </div>

            {request.status === 'PENDING' && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                ⏳ Your payment is being reviewed. Credits will be added once approved.
              </div>
            )}

            {request.status === 'APPROVED' && request.processedAt && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                ✅ Payment approved on {formatDate(request.processedAt)}. Credits have been added to your account.
              </div>
            )}

            {request.status === 'REJECTED' && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                ❌ Payment request has been rejected. {request.adminNotes ? 'Please see admin notes below for details.' : 'Please contact support for more information.'}
              </div>
            )}

            {request.adminNotes && (
              <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-sm">
                <span className="font-medium text-slate-700">Admin Notes:</span>
                <p className="text-slate-900 mt-1">{request.adminNotes}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}