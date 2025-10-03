'use client';

import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';

interface PaymentRequest {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  creditsRequested: number;
  amount: number;
  paymentMethod: string;
  transactionId: string | null;
  qrCodeUsed: string | null;
  screenshotUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPaymentsPage() {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  useEffect(() => {
    fetchPaymentRequests();
  }, []);

  const fetchPaymentRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/payments');
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

  const handleProcessPayment = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      setProcessingId(requestId);
      setError('');

      const response = await fetch('/api/admin/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action,
          adminNotes: adminNotes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process payment request');
      }

      // Refresh the list
      await fetchPaymentRequests();
      setSelectedRequest(null);
      setAdminNotes('');
      
    } catch (error) {
      console.error('Error processing payment:', error);
      setError(error instanceof Error ? error.message : 'Failed to process payment request');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequests = paymentRequests.filter(request => {
    if (filter === 'ALL') return true;
    return request.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Payment Requests</h1>
        <Button onClick={fetchPaymentRequests} variant="outline">
          Refresh
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <div className="text-red-800">{error}</div>
        </Alert>
      )}

      {/* Filter Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Payment Requests List */}
      <div className="grid gap-6">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No payment requests found.</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {request.user.name || request.user.email}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {request.user.email}
                    </p>
                  </div>
                  <Badge className={getStatusBadgeVariant(request.status)}>
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Payment Details */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Credits:</span>
                        <p className="text-gray-900">{request.creditsRequested}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Amount:</span>
                        <p className="text-gray-900">₨{request.amount}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Method:</span>
                        <p className="text-gray-900 capitalize">{request.paymentMethod}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Date:</span>
                        <p className="text-gray-900">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {request.transactionId && (
                        <div className="col-span-2">
                          <span className="font-medium text-gray-700">Transaction ID:</span>
                          <p className="text-gray-900 font-mono text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                            {request.transactionId}
                          </p>
                        </div>
                      )}
                      {request.qrCodeUsed && (
                        <div className="col-span-2">
                          <span className="font-medium text-gray-700">QR Code Used:</span>
                          <p className="text-gray-900 text-xs bg-blue-50 p-2 rounded mt-1">
                            {request.qrCodeUsed}
                          </p>
                        </div>
                      )}
                    </div>

                    {request.adminNotes && (
                      <div>
                        <span className="font-medium text-gray-700">Admin Notes:</span>
                        <p className="text-gray-900 mt-1 text-sm bg-gray-50 p-2 rounded">
                          {request.adminNotes}
                        </p>
                      </div>
                    )}

                    {request.status === 'PENDING' && (
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => setSelectedRequest(request)}
                          variant="outline"
                          size="sm"
                        >
                          Review
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Screenshot */}
                  <div>
                    <span className="font-medium text-gray-700 block mb-2">Payment Screenshot:</span>
                    {request.screenshotUrl ? (
                      <div className="border rounded-lg p-2 bg-gray-50">
                        <Image
                          src={request.screenshotUrl}
                          alt="Payment screenshot"
                          width={300}
                          height={200}
                          className="mx-auto rounded object-contain max-h-48 cursor-pointer"
                          onClick={() => window.open(request.screenshotUrl!, '_blank')}
                        />
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Click to view full size
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No screenshot uploaded</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Review Payment Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  <strong>User:</strong> {selectedRequest.user.name || selectedRequest.user.email}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Credits:</strong> {selectedRequest.creditsRequested}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Amount:</strong> ₨{selectedRequest.amount}
                </p>
                {selectedRequest.transactionId && (
                  <p className="text-sm text-gray-600">
                    <strong>Transaction ID:</strong> 
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded ml-1">
                      {selectedRequest.transactionId}
                    </span>
                  </p>
                )}
                {selectedRequest.qrCodeUsed && (
                  <p className="text-sm text-gray-600">
                    <strong>QR Code:</strong> {selectedRequest.qrCodeUsed}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any notes about this payment..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => handleProcessPayment(selectedRequest.id, 'APPROVED')}
                  disabled={processingId === selectedRequest.id}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processingId === selectedRequest.id ? 'Processing...' : 'Approve'}
                </Button>
                <Button
                  onClick={() => handleProcessPayment(selectedRequest.id, 'REJECTED')}
                  disabled={processingId === selectedRequest.id}
                  variant="outline"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                >
                  {processingId === selectedRequest.id ? 'Processing...' : 'Reject'}
                </Button>
              </div>

              <Button
                onClick={() => {
                  setSelectedRequest(null);
                  setAdminNotes('');
                }}
                variant="outline"
                className="w-full"
                disabled={processingId === selectedRequest.id}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}