'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface CreditPackage {
  credits: number;
  price: number;
  popular?: boolean;
  qrCode: string;
}

const creditPackages: CreditPackage[] = [
  { credits: 500, price: 1000, qrCode: '1000rs 500cradit.png' },
  { credits: 1000, price: 2000, qrCode: '2000rs 1000credit.png', popular: true },
  { credits: 1500, price: 3000, qrCode: '3000rs 1500credit.png' },
  { credits: 2000, price: 4000, qrCode: '4000rs 2000credit.png' },
  { credits: 2500, price: 5000, qrCode: '5000 rs 2500 credit.png' },
];

export default function BuyCreditsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [customCredits, setCustomCredits] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [selectedQrCode, setSelectedQrCode] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
  }, [session, status, router]);

  const handlePackageSelect = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setSelectedQrCode(pkg.qrCode);
    setIsCustom(false);
    setCustomCredits('');
    setCustomPrice('');
  };

  const handleCustomSelect = () => {
    setIsCustom(true);
    setSelectedPackage(null);
    setSelectedQrCode('');
  };

  const calculateCustomPrice = (credits: string) => {
    const creditsNum = parseInt(credits);
    if (creditsNum && creditsNum > 0) {
      // Rate: 5 PKR per credit
      const price = creditsNum * 5;
      setCustomPrice(price.toString());
    } else {
      setCustomPrice('');
    }
  };

  const handleCustomCreditsChange = (value: string) => {
    setCustomCredits(value);
    calculateCustomPrice(value);
  };

  const handleProceedToPayment = () => {
    let credits: number;
    let amount: number;
    let qrCode: string;

    if (isCustom) {
      credits = parseInt(customCredits);
      amount = parseFloat(customPrice);
      
      if (!credits || credits < 10) {
        setError('Minimum 10 credits required for custom purchase');
        return;
      }
      if (!amount || amount < 50) {
        setError('Minimum amount is 50 PKR');
        return;
      }
      qrCode = ''; // Custom packages don't have predefined QR codes
    } else if (selectedPackage) {
      credits = selectedPackage.credits;
      amount = selectedPackage.price;
      qrCode = selectedPackage.qrCode;
    } else {
      setError('Please select a credit package');
      return;
    }

    // Navigate to payment page with selected options
    const params = new URLSearchParams({
      credits: credits.toString(),
      amount: amount.toString(),
      qrCode: qrCode
    });
    
    router.push(`/app/buy-credits/payment?${params.toString()}`);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
          Buy Credits
        </h1>
        <p className="text-slate-600 text-lg">Purchase credits to describe more images with AI</p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <div className="text-red-800">{error}</div>
        </Alert>
      )}

      {/* Credit Packages */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Choose a Package</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {creditPackages.map((pkg) => (
            <Card
              key={pkg.credits}
              className={`relative cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                selectedPackage?.credits === pkg.credits && !isCustom
                  ? 'ring-2 ring-blue-500 border-blue-500 shadow-xl shadow-blue-500/25 bg-gradient-to-br from-blue-50 to-purple-50'
                  : 'hover:shadow-xl border-slate-200 bg-white hover:border-slate-300'
              }`}
              onClick={() => handlePackageSelect(pkg)}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
                    🔥 Popular
                  </span>
                </div>
              )}
              <div className="p-8 text-center">
                <div className="text-4xl font-bold text-slate-900 mb-2">
                  {pkg.credits}
                </div>
                <div className="text-slate-600 mb-6 font-medium">Credits</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  ₨{pkg.price}
                </div>
                <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                  ₨{(pkg.price / pkg.credits).toFixed(1)} per credit
                </div>
              </div>
            </Card>
          ))}

          {/* Custom Package */}
          <Card
            className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${
              isCustom
                ? 'ring-2 ring-blue-500 border-blue-500 shadow-xl shadow-blue-500/25 bg-gradient-to-br from-blue-50 to-purple-50'
                : 'hover:shadow-xl border-slate-200 bg-white hover:border-slate-300'
            }`}
            onClick={handleCustomSelect}
          >
            <div className="p-8 text-center">
              <div className="text-4xl font-bold text-slate-900 mb-2">
                Custom
              </div>
              <div className="text-slate-600 mb-6 font-medium">Credits</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                ₨5/credit
              </div>
              <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                Choose your amount
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Custom Credits Input */}
      {isCustom && (
        <div className="mb-10">
          <Card className="p-8 bg-gradient-to-br from-slate-50 to-white border-slate-200 shadow-lg">
            <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">Custom Package</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customCredits">Number of Credits (min: 10)</Label>
                <Input
                  id="customCredits"
                  type="number"
                  min="10"
                  value={customCredits}
                  onChange={(e) => handleCustomCreditsChange(e.target.value)}
                  placeholder="Enter credits amount"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="customPrice">Total Amount (PKR)</Label>
                <Input
                  id="customPrice"
                  type="number"
                  value={customPrice}
                  readOnly
                  placeholder="Auto-calculated"
                  className="mt-1 bg-gray-50"
                />
              </div>
            </div>
          </Card>
        </div>
      )}



      {/* Proceed to Payment Button */}
      {(selectedPackage || (isCustom && customCredits && customPrice)) && (
        <div className="text-center mt-12">
          <Button
            onClick={handleProceedToPayment}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-4 text-xl font-bold rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0"
          >
            Proceed to Payment
          </Button>
        </div>
      )}
    </div>
  );
}