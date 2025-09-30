'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import Image from 'next/image';

function PaymentPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [credits, setCredits] = useState('');
  const [amount, setAmount] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [location, setLocation] = useState('pakistan');
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Get parameters from URL
    const creditsParam = searchParams.get('credits');
    const amountParam = searchParams.get('amount');
    const qrCodeParam = searchParams.get('qrCode');
    const currencyParam = searchParams.get('currency');
    const locationParam = searchParams.get('location');

    if (!creditsParam || !amountParam) {
      router.push('/app/buy-credits');
      return;
    }

    setCredits(creditsParam);
    setAmount(amountParam);
    setQrCode(qrCodeParam || '');
    setCurrency(currencyParam || 'PKR');
    setLocation(locationParam || 'pakistan');
  }, [session, status, router, searchParams]);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Screenshot file size must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file');
        return;
      }

      setScreenshot(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setScreenshotPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPayment = async () => {
    if (!transactionId.trim()) {
      setError('Please enter the transaction ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First, upload the screenshot
      const formData = new FormData();
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }
      formData.append('credits', credits);
      formData.append('amount', amount);
      formData.append('transactionId', transactionId.trim());
      formData.append('qrCode', qrCode);
      formData.append('currency', currency);
      formData.append('location', location);

      const response = await fetch('/api/payment/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit payment request');
      }

      setSuccess('Payment request submitted successfully! Our team will review it within 24 hours.');
      
      // Redirect to history page after 3 seconds
      setTimeout(() => {
        router.push('/app/history');
      }, 3000);

    } catch (error) {
      console.error('Payment submission error:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit payment request');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session || !credits || !amount) {
    return null;
  }



  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Payment</h1>
        <p className="text-gray-600">Scan the QR code and provide transaction details</p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <div className="text-red-800">{error}</div>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <div className="text-green-800">{success}</div>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Details & QR Code */}
        <div>
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Credits:</span>
                <span className="font-semibold">{credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-semibold">{currency === 'PKR' ? '₨' : '$'}{amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-semibold">{location === 'pakistan' ? 'Bank Transfer / QR Code' : 'Binance'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Payment QR Code
            </h2>
            <div className="text-center">
              {qrCode ? (
                <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
                  <Image
                    src={`/qrcodes/${qrCode}`}
                    alt="Payment QR Code"
                    width={250}
                    height={250}
                    className="mx-auto border rounded-lg"
                  />
                </div>
              ) : (
                <div className="inline-block p-8 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">Custom amount - Please contact support for payment details</p>
                </div>
              )}
              <div className="mt-4 text-sm text-gray-600">
                <p className="mb-2">{location === 'pakistan' ? 'Scan this QR code with your banking app or mobile wallet' : 'Send payment to the Binance address shown in the QR code'}</p>
                <p className="font-semibold">Amount: {currency === 'PKR' ? '₨' : '$'}{amount}</p>
                <p className="text-xs text-gray-500 mt-2">
                  After payment, enter your transaction ID below. Screenshot upload is optional but recommended.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Screenshot Upload */}
        <div>
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Verification</h2>
            
            <div className="mb-6">
              <Label htmlFor="transactionId" className="block text-sm font-medium text-gray-700 mb-2">
                Transaction ID *
              </Label>
              <Input
                id="transactionId"
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Enter your transaction ID"
                className="mb-2"
              />
              <p className="text-xs text-gray-500">
                Enter the transaction ID from your payment confirmation
              </p>
            </div>

            <div className="mb-6">
              <Label htmlFor="screenshot" className="block text-sm font-medium text-gray-700 mb-2">
                Payment Screenshot (Optional)
              </Label>
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                className="mb-2"
              />
              <p className="text-xs text-gray-500">
                Upload a clear screenshot of your payment confirmation (max 5MB) - Optional but recommended for faster processing
              </p>
            </div>

            {screenshotPreview && (
              <div className="mb-6">
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </Label>
                <div className="border rounded-lg p-2 bg-gray-50">
                  <Image
                    src={screenshotPreview}
                    alt="Payment screenshot preview"
                    width={300}
                    height={200}
                    className="mx-auto rounded object-contain max-h-48"
                  />
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>{location === 'pakistan' ? 'Scan the QR code with your banking app or mobile wallet' : 'Send payment to the Binance address shown in the QR code'}</li>
                <li>Complete the payment of {currency === 'PKR' ? '₨' : '$'}{amount}</li>
                <li>Note down the transaction ID from your payment confirmation</li>
                <li>Enter the transaction ID in the form above</li>
                <li>Optionally upload a screenshot of the payment confirmation for faster processing</li>
                <li>Click &quot;Submit Payment Request&quot;</li>
              </ol>
            </div>

            <Button
              onClick={handleSubmitPayment}
              disabled={loading || !transactionId.trim() || !!success}
              className="w-full"
            >
              {loading ? 'Submitting...' : success ? 'Request Submitted' : 'Submit Payment Request'}
            </Button>

            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => router.push('/app/buy-credits')}
                disabled={loading}
              >
                Back to Packages
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Your payment request will be reviewed within 24 hours.</p>
        <p>Credits will be added to your account once the payment is verified.</p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
      <PaymentPageContent />
    </Suspense>
  );
}