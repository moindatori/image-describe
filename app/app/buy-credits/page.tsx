'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';

interface CreditPackage {
  credits: number;
  price: number;
  popular?: boolean;
  qrCode: string;
  currency: string;
}

type LocationType = 'pakistan' | 'international';

const pakistanPackages: CreditPackage[] = [
  { credits: 500, price: 1000, qrCode: '1000 Rs 500 Cradit.png', currency: 'PKR' },
  { credits: 1000, price: 2000, qrCode: '2000Rs 1000 Cradit.png', popular: true, currency: 'PKR' },
  { credits: 1500, price: 3000, qrCode: '3000Rs 1500 Cradit.png', currency: 'PKR' },
  { credits: 2000, price: 4000, qrCode: '4000 Rs 2000 Cradit.png', currency: 'PKR' },
  { credits: 2500, price: 5000, qrCode: '5000 Rs 2500 Cradit.png', currency: 'PKR' },
];

const internationalPackages: CreditPackage[] = [
  { credits: 500, price: 5, qrCode: 'Binance 10$ equal to 1000 cradit.png', currency: 'USD' },
  { credits: 1000, price: 10, qrCode: 'Binance 10$ equal to 1000 cradit.png', popular: true, currency: 'USD' },
];

export default function BuyCreditsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [location, setLocation] = useState<LocationType>('pakistan');
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

  const getCurrentPackages = () => {
    return location === 'pakistan' ? pakistanPackages : internationalPackages;
  };

  const handleLocationChange = (newLocation: LocationType) => {
    setLocation(newLocation);
    setSelectedPackage(null);
    setIsCustom(false);
    setCustomCredits('');
    setCustomPrice('');
    setSelectedQrCode('');
    setError('');
  };

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
      let price: number;
      if (location === 'pakistan') {
        // Rate: 2 PKR per credit
        price = creditsNum * 2;
      } else {
        // Rate: $0.01 USD per credit (500 credits = $5, 1000 credits = $10)
        price = creditsNum * 0.01;
      }
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
    let currency: string;

    if (isCustom) {
      credits = parseInt(customCredits);
      amount = parseFloat(customPrice);
      currency = location === 'pakistan' ? 'PKR' : 'USD';
      
      if (!credits || credits < 250) {
        setError('Minimum 250 credits required for custom purchase');
        return;
      }
      
      if (location === 'pakistan') {
        if (!amount || amount < 500) {
          setError('Minimum amount is 500 PKR (250 credits)');
          return;
        }
      } else {
        if (!amount || amount < 2.5) {
          setError('Minimum amount is $2.50 USD (250 credits)');
          return;
        }
      }
      
      qrCode = location === 'pakistan' ? 'Custom 2pkr for 1 cradit.png' : 'Binance 10$ equal to 1000 cradit.png';
    } else if (selectedPackage) {
      credits = selectedPackage.credits;
      amount = selectedPackage.price;
      qrCode = selectedPackage.qrCode;
      currency = selectedPackage.currency;
    } else {
      setError('Please select a credit package');
      return;
    }

    // Navigate to payment page with selected options
    const params = new URLSearchParams({
      credits: credits.toString(),
      amount: amount.toString(),
      qrCode: qrCode,
      currency: currency,
      location: location
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

      {/* Location Selector */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">Select Your Location</h2>
        <div className="flex justify-center gap-4">
          <Button
            onClick={() => handleLocationChange('pakistan')}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${
              location === 'pakistan'
                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🇵🇰 Pakistan
          </Button>
          <Button
            onClick={() => handleLocationChange('international')}
            className={`px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${
              location === 'international'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🌍 International
          </Button>
        </div>
      </div>

      {/* Credit Packages */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Choose a Package</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {getCurrentPackages().map((pkg) => (
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
                  {pkg.currency === 'PKR' ? '₨' : '$'}{pkg.price}
                </div>
                <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                  {pkg.currency === 'PKR' ? '₨' : '$'}{(pkg.price / pkg.credits).toFixed(pkg.currency === 'PKR' ? 1 : 3)} per credit
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
                {location === 'pakistan' ? '₨2/credit' : '$0.01/credit'}
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
                <Label htmlFor="customCredits">Number of Credits (min: 250)</Label>
                <Input
                  id="customCredits"
                  type="number"
                  min="250"
                  value={customCredits}
                  onChange={(e) => handleCustomCreditsChange(e.target.value)}
                  placeholder="Enter credits amount"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="customPrice">Total Amount ({location === 'pakistan' ? 'PKR' : 'USD'})</Label>
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