import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, deductCredits } from '@/lib/user';
import { getSetting } from '@/lib/settings';

const IDEOGRAM_API_URL = 'https://api.ideogram.ai/describe';
const MAX_CONCURRENT_REQUESTS = 5; // Process up to 5 images concurrently
const BATCH_SIZE = 10; // Process images in batches

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

interface ProgressUpdate {
  type: 'progress' | 'result' | 'complete' | 'error';
  index?: number;
  total?: number;
  result?: ProcessResult;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    creditsUsed: number;
    remainingCredits: number;
  };
  error?: string;
}

// Image Processing Service Class
class ImageProcessingService {
  private ideogramApiKey: string | null = null;

  constructor(apiKey: string | null) {
    this.ideogramApiKey = apiKey;
  }

  async processImage(file: File, userId: string, index: number): Promise<ProcessResult> {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return {
          success: false,
          filename: file.name,
          error: 'File must be an image',
          index
        };
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        return {
          success: false,
          filename: file.name,
          error: 'File size must be less than 10MB',
          index
        };
      }

      const result = await this.getImageDescription(file);
      
      // Save to database
      const savedImage = await prisma.imageDescription.create({
        data: {
          userId: userId,
          filename: file.name,
          description: result.description,
          confidence: result.confidence,
          source: result.source,
        },
      });

      return {
        success: true,
        imageId: savedImage.id,
        filename: file.name,
        description: result.description,
        confidence: result.confidence,
        source: result.source,
        index
      };

    } catch (error) {
      console.error('Error processing image:', error);
      return {
        success: false,
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        index
      };
    }
  }

  private async getImageDescription(file: File): Promise<{
    description: string;
    confidence: number;
    source: string;
  }> {
    // Try Ideogram API first
    if (this.ideogramApiKey) {
      try {
        const result = await this.callIdeogramAPI(file);
        return {
          description: result.description,
          confidence: 95,
          source: 'ideogram'
        };
      } catch (error) {
        console.error('Ideogram API error:', error);
        // Throw error instead of using fallback
        throw new Error(`Failed to describe image: ${error instanceof Error ? error.message : 'Unknown API error'}`);
      }
    }

    // Throw error if no API key is available
    throw new Error('Image description service is not available - API key not configured');
  }

  private async callIdeogramAPI(file: File): Promise<{ description: string }> {
    const formData = new FormData();
    formData.append('image_file', file);

    const response = await fetch(IDEOGRAM_API_URL, {
      method: 'POST',
      headers: {
        'Api-Key': this.ideogramApiKey!,
      },
      body: formData,
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = 'Ideogram API request failed';
      
      try {
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          errorMessage = `API error (${response.status}): ${errorText.substring(0, 100)}`;
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    
    // Validate JSON response
    if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
      throw new Error('Ideogram API returned invalid response format');
    }

    const result = JSON.parse(responseText);
    const description = result.descriptions?.[0]?.text || result.description;
    
    if (!description) {
      throw new Error('No description found in API response');
    }

    return { description };
  }
}

// Concurrent Processing Manager
class ConcurrentProcessingManager {
  private processingService: ImageProcessingService;
  private maxConcurrent: number;

  constructor(processingService: ImageProcessingService, maxConcurrent: number = MAX_CONCURRENT_REQUESTS) {
    this.processingService = processingService;
    this.maxConcurrent = maxConcurrent;
  }

  async processFilesConcurrently(
    files: File[],
    userId: string,
    onProgress: (update: ProgressUpdate) => void
  ): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    let processedCount = 0;

    // Process files in batches with concurrency control
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchPromises: Promise<ProcessResult>[] = [];

      // Create promises for concurrent processing within the batch
      for (let j = 0; j < batch.length; j += this.maxConcurrent) {
        const concurrentBatch = batch.slice(j, j + this.maxConcurrent);
        
        const concurrentPromises = concurrentBatch.map((file, localIndex) => {
          const globalIndex = i + j + localIndex;
          return this.processingService.processImage(file, userId, globalIndex);
        });

        batchPromises.push(...concurrentPromises);
      }

      // Wait for all promises in the current batch to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results and send updates
      for (const settledResult of batchResults) {
        processedCount++;
        
        // Send progress update
        onProgress({
          type: 'progress',
          index: processedCount,
          total: files.length
        });

        if (settledResult.status === 'fulfilled') {
          const result = settledResult.value;
          results.push(result);
          
          // Send result update
          onProgress({
            type: 'result',
            result: result
          });
        } else {
          // Handle rejected promise
          const errorResult: ProcessResult = {
            success: false,
            filename: 'unknown',
            error: settledResult.reason?.message || 'Processing failed',
            index: processedCount - 1
          };
          results.push(errorResult);
          
          onProgress({
            type: 'result',
            result: errorResult
          });
        }
      }

      // Small delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}

// Stream Response Manager
class StreamResponseManager {
  private encoder: TextEncoder;
  private controller: ReadableStreamDefaultController<Uint8Array>;

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.encoder = new TextEncoder();
    this.controller = controller;
  }

  sendUpdate(update: ProgressUpdate): void {
    try {
      const data = `data: ${JSON.stringify(update)}\n\n`;
      this.controller.enqueue(this.encoder.encode(data));
    } catch (error) {
      console.error('Error sending stream update:', error);
    }
  }

  close(): void {
    try {
      this.controller.close();
    } catch (error) {
      console.error('Error closing stream:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No image files provided' },
        { status: 400 }
      );
    }

    // Get authenticated user and check credits
    const user = await getCurrentUser();
    const requiredCredits = files.length;

    if (user.credits < requiredCredits) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          required: requiredCredits,
          available: user.credits,
          message: `You need at least ${requiredCredits} credit${requiredCredits > 1 ? 's' : ''} to describe these images.`
        },
        { status: 402 }
      );
    }

    // Get API key
    const ideogramApiKey = await getSetting('IDEOGRAM_API_KEY', 'IDEOGRAM_API_KEY');
    
    // Initialize services
    const processingService = new ImageProcessingService(ideogramApiKey);
    const concurrentManager = new ConcurrentProcessingManager(processingService);

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const streamManager = new StreamResponseManager(controller);
        let successfulProcessing = 0;

        try {
          // Send initial progress
          streamManager.sendUpdate({
            type: 'progress',
            index: 0,
            total: files.length
          });

          // Process images concurrently
          const results = await concurrentManager.processFilesConcurrently(
            files,
            user.id,
            (update) => streamManager.sendUpdate(update)
          );

          // Count successful processing
          successfulProcessing = results.filter(r => r.success).length;

          // Deduct credits only for successfully processed images
          if (successfulProcessing > 0) {
            await deductCredits(user.id, successfulProcessing, 'Bulk image description (optimized)');
          }

          // Get updated user credits
          const updatedUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { credits: true }
          });

          // Send completion update
          streamManager.sendUpdate({
            type: 'complete',
            summary: {
              total: files.length,
              successful: successfulProcessing,
              failed: files.length - successfulProcessing,
              creditsUsed: successfulProcessing,
              remainingCredits: updatedUser?.credits || 0
            }
          });

        } catch (error) {
          console.error('Error in bulk processing:', error);
          streamManager.sendUpdate({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          });
        } finally {
          streamManager.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error processing bulk images:', error);
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message === 'User not authenticated' || error.message === 'User not found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process images' },
      { status: 500 }
    );
  }
}