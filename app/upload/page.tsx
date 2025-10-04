'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Sparkles
} from 'lucide-react';
import BulkImageUploadOptimized from '@/components/ui/BulkImageUploadOptimized';
import { Button } from '@/components/ui/Button';

interface ImageDescription {
  id: string;
  filename: string;
  description: string;
  confidence: number;
  source: string;
  createdAt: string;
}

interface UploadResult {
  success: boolean;
  description?: string;
  confidence?: number;
  source?: string;
  error?: string;
  remainingCredits?: number;
}

interface BulkResult {
  total: number;
  successful: number;
  failed: number;
  creditsUsed: number;
  remainingCredits: number;
  results: Array<{
    filename: string;
    success: boolean;
    description?: string;
    confidence?: number;
    error?: string;
  }>;
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

// Modern Feature Card Component
const FeatureCard = ({ icon: Icon, title, description }: {
  icon: any;
  title: string;
  description: string;
}) => (
  <Card className="border-2 border-gray-100 hover:border-blue-200 transition-all duration-200 hover:shadow-lg">
    <CardContent className="p-6 text-center">
      <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </CardContent>
  </Card>
);

export default function ModernUploadPage() {
  const { user, loading } = useUser();
  const [activeTab, setActiveTab] = useState('single');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentImages, setRecentImages] = useState<ImageDescription[]>([]);

  // Load recent images
  useEffect(() => {
    if (user) {
      fetchRecentImages();
    }
  }, [user]);

  const fetchRecentImages = async () => {
    try {
      const response = await fetch('/api/images/recent');
      if (response.ok) {
        const images = await response.json();
        setRecentImages(images.slice(0, 6)); // Show only 6 recent images
      }
    } catch (error) {
      console.error('Error fetching recent images:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSingleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/describe', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          description: result.description,
          confidence: result.confidence,
          source: result.source,
          remainingCredits: result.remainingCredits,
        });
        fetchRecentImages(); // Refresh recent images
      } else {
        setError(result.error || 'Failed to process image');
      }
    } catch (_error) {
      setError('Network error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkComplete = (results: BulkResult) => {
    setBulkResults(results);
    fetchRecentImages(); // Refresh recent images
  };

  const downloadSingleResult = () => {
    if (!uploadResult || !selectedFile) return;

    const content = `Image: ${selectedFile.name}\nDescription: ${uploadResult.description}\nConfidence: ${uploadResult.confidence}%\nSource: ${uploadResult.source}\nGenerated: ${new Date().toLocaleString()}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile.name.split('.')[0]}_description.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadBulkResults = () => {
    if (!bulkResults) return;

    const content = bulkResults.results.map(result => 
      `Image: ${result.filename}\n${result.success 
        ? `Description: ${result.description}\nConfidence: ${result.confidence}%` 
        : `Error: ${result.error}`}\n---`
    ).join('\n');

    const summary = `Bulk Processing Summary\nTotal: ${bulkResults.total}\nSuccessful: ${bulkResults.successful}\nFailed: ${bulkResults.failed}\nCredits Used: ${bulkResults.creditsUsed}\nRemaining Credits: ${bulkResults.remainingCredits}\n\n${content}`;
    
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_descriptions_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearSingle = () => {
    setSelectedFile(null);
    setPreview(null);
    setUploadResult(null);
    setError(null);
  };

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
            title="Recent Images"
            value={recentImages.length}
            description="Last processed"
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

        {/* Main Upload Interface */}
        <Card className="mb-12 shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Upload className="h-6 w-6" />
              Upload & Describe Images
            </CardTitle>
            <CardDescription className="text-blue-100">
              Choose between single image processing or bulk upload for multiple images
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="single" className="text-lg py-3">
                  <ImageIcon className="h-5 w-5 mr-2" />
                  Single Image
                </TabsTrigger>
                <TabsTrigger value="bulk" className="text-lg py-3">
                  <Upload className="h-5 w-5 mr-2" />
                  Bulk Upload
                </TabsTrigger>
              </TabsList>

              {/* Single Upload Tab */}
              <TabsContent value="single" className="space-y-6">
                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Upload Area */}
                  <div className="space-y-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="single-file-input"
                        disabled={isUploading}
                      />
                      <label htmlFor="single-file-input" className="cursor-pointer">
                        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                          <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                        <p className="text-lg font-medium text-gray-700 mb-2">
                          Click to upload an image
                        </p>
                        <p className="text-sm text-gray-500">
                          Supports JPG, PNG, WebP up to 10MB
                        </p>
                      </label>
                    </div>

                    {selectedFile && (
                      <Card className="border-2 border-blue-200">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="font-medium">{selectedFile.name}</p>
                              <p className="text-sm text-gray-500">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <Badge variant="secondary">Ready</Badge>
                          </div>
                          {preview && (
                            <img
                              src={preview}
                              alt="Preview"
                              className="w-full h-48 object-cover rounded-lg mb-4"
                            />
                          )}
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSingleUpload}
                              disabled={isUploading || user.credits < 1}
                              className="flex-1"
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Zap className="h-4 w-4 mr-2" />
                                  Describe Image (1 credit)
                                </>
                              )}
                            </Button>
                            <Button variant="outline" onClick={clearSingle}>
                              Clear
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Results Area */}
                  <div className="space-y-6">
                    {uploadResult && (
                      <Card className="border-2 border-green-200 bg-green-50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-green-800">
                            <CheckCircle className="h-5 w-5" />
                            Description Generated
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="bg-white p-4 rounded-lg border">
                            <p className="text-gray-800 leading-relaxed">
                              {uploadResult.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Badge variant="secondary">
                                {uploadResult.confidence}% confidence
                              </Badge>
                              <Badge variant="outline">
                                {uploadResult.source}
                              </Badge>
                            </div>
                            <Button onClick={downloadSingleResult} variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </div>
                          <div className="text-sm text-green-700">
                            Remaining credits: {uploadResult.remainingCredits}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {!uploadResult && !selectedFile && (
                      <Card className="border-2 border-gray-200">
                        <CardContent className="p-8 text-center">
                          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <ImageIcon className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500">
                            Upload an image to see the AI-generated description here
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Bulk Upload Tab */}
              <TabsContent value="bulk">
                <BulkImageUploadOptimized
                  onImagesSelect={(files) => {
                    // Handle file selection if needed
                    console.log('Files selected:', files);
                  }}
                  onProcessingComplete={(results) => {
                    // Convert ProcessResult[] to BulkResult format
                    const bulkResult: BulkResult = {
                      total: results.length,
                      successful: results.filter(r => r.success).length,
                      failed: results.filter(r => !r.success).length,
                      creditsUsed: results.length, // Assuming 1 credit per image
                      remainingCredits: results[0]?.remainingCredits || user.credits,
                      results: results.map(r => ({
                        filename: r.filename,
                        success: r.success,
                        description: r.description,
                        confidence: r.confidence,
                        error: r.error
                      }))
                    };
                    handleBulkComplete(bulkResult);
                  }}
                />

                {bulkResults && (
                  <Card className="mt-8 border-2 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          Bulk Processing Complete
                        </span>
                        <Button onClick={downloadBulkResults} variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download All
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{bulkResults.total}</p>
                          <p className="text-sm text-blue-700">Total Images</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{bulkResults.successful}</p>
                          <p className="text-sm text-green-700">Successful</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{bulkResults.failed}</p>
                          <p className="text-sm text-red-700">Failed</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">{bulkResults.creditsUsed}</p>
                          <p className="text-sm text-purple-700">Credits Used</p>
                        </div>
                      </div>
                      <div className="text-center text-sm text-gray-600">
                        Remaining credits: {bulkResults.remainingCredits}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Features Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Why Choose Our AI Description Service?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={Zap}
              title="Lightning Fast"
              description="Get detailed descriptions in seconds with our optimized AI processing pipeline"
            />
            <FeatureCard
              icon={Star}
              title="High Accuracy"
              description="95% average confidence with advanced computer vision and natural language processing"
            />
            <FeatureCard
              icon={TrendingUp}
              title="Bulk Processing"
              description="Process multiple images simultaneously with concurrent processing for maximum efficiency"
            />
          </div>
        </div>

        {/* Recent Images Section */}
        {recentImages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recently Processed Images
              </CardTitle>
              <CardDescription>
                Your latest AI-generated image descriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentImages.map((image) => (
                  <Card key={image.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm truncate">{image.filename}</p>
                        <Badge variant="secondary" className="text-xs">
                          {image.confidence}%
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3 mb-2">
                        {image.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{image.source}</span>
                        <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}