import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, deductCredits } from '@/lib/user';
import { getSetting } from '@/lib/settings';

const IDEOGRAM_API_URL = 'https://api.ideogram.ai/describe';

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

async function processImage(file: File, userId: string, index: number): Promise<ProcessResult> {
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

    let description = '';
    let confidence = 95;
    let source = 'ideogram';

    // Get Ideogram API key from database (with fallback to env)
    const IDEOGRAM_API_KEY = await getSetting('IDEOGRAM_API_KEY', 'IDEOGRAM_API_KEY');

    // Try to call Ideogram API
    if (IDEOGRAM_API_KEY) {
      try {
        const ideogramFormData = new FormData();
        ideogramFormData.append('image_file', file);

        const ideogramResponse = await fetch(IDEOGRAM_API_URL, {
          method: 'POST',
          headers: {
            'Api-Key': IDEOGRAM_API_KEY,
          },
          body: ideogramFormData,
        });

        if (ideogramResponse.ok) {
          let responseText = '';
          
          try {
            // First, get the response as text to check if it's valid
            responseText = await ideogramResponse.text();
            
            // Check if it looks like JSON (starts with { or [)
            if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
              const result = JSON.parse(responseText);
              description = result.descriptions?.[0]?.text || result.description || 'No description available';
              confidence = 95;
              source = 'ideogram';
            } else {
              console.error('Ideogram API returned non-JSON response:', responseText.substring(0, 200));
              throw new Error('Ideogram API returned invalid response format');
            }
          } catch (jsonError) {
            console.error('Failed to parse Ideogram API response:', jsonError);
            console.error('Response text:', responseText.substring(0, 200));
            throw new Error('Invalid JSON response from Ideogram API');
          }
        } else {
          // Handle error responses
          const contentType = ideogramResponse.headers.get('content-type');
          let errorMessage = 'Ideogram API request failed';
          
          try {
            if (contentType && contentType.includes('application/json')) {
              const errorData = await ideogramResponse.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
            } else {
              const errorText = await ideogramResponse.text();
              console.error('Ideogram API error response:', errorText);
              errorMessage = `API error (${ideogramResponse.status}): ${errorText.substring(0, 100)}`;
            }
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
          }
          
          throw new Error(errorMessage);
        }
      } catch (apiError) {
        console.error('Ideogram API error:', apiError);
        // Return error instead of fallback description
        return {
          success: false,
          filename: file.name,
          error: `Failed to describe image: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`,
          index: index
        };
      }
    } else {
      // Return error when no API key is available
      return {
        success: false,
        filename: file.name,
        error: 'Image description service is not available - API key not configured',
        index: index
      };
    }

    // Save to database
    const savedImage = await prisma.imageDescription.create({
      data: {
        userId: userId,
        filename: file.name,
        description: description,
        confidence: confidence,
        source: source,
      },
    });

    return {
      success: true,
      imageId: savedImage.id,
      filename: file.name,
      description: description,
      confidence: confidence,
      source: source,
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

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const results: ProcessResult[] = [];
        let successfulProcessing = 0;

        try {
          // Send initial progress
          const progressUpdate: ProgressUpdate = {
            type: 'progress',
            index: 0,
            total: files.length
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressUpdate)}\n\n`));

          // Process each image sequentially
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check if user still has credits before processing each image
            const currentUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { credits: true }
            });

            if (!currentUser || currentUser.credits < 1) {
              // Stop processing if no credits remaining
              const errorResult: ProcessResult = {
                success: false,
                filename: file.name,
                error: 'Insufficient credits to process this image',
                index: i
              };
              results.push(errorResult);
              
              const resultUpdate: ProgressUpdate = {
                type: 'result',
                result: errorResult
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(resultUpdate)}\n\n`));
              break;
            }
            
            // Send progress update
            const progressUpdate: ProgressUpdate = {
              type: 'progress',
              index: i + 1,
              total: files.length
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressUpdate)}\n\n`));

            // Process the image
            const result = await processImage(file, user.id, i);
            results.push(result);
            
            if (result.success) {
              successfulProcessing++;
              
              // Deduct credits immediately after successful processing
              try {
                await deductCredits(user.id, 1, `Image description for ${file.name}`);
              } catch (creditError) {
                console.error('Error deducting credits:', creditError);
                // Update the result to reflect credit deduction failure
                result.error = 'Processing successful but credit deduction failed';
                result.success = false;
                successfulProcessing--;
              }
            }

            // Send result update with current remaining credits
            const updatedUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { credits: true }
            });

            const resultUpdate: ProgressUpdate = {
              type: 'result',
              result: {
                ...result,
                remainingCredits: updatedUser?.credits || 0
              }
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(resultUpdate)}\n\n`));
          }

          // Get final user credits
          const finalUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { credits: true }
          });

          // Send completion update
          const completeUpdate: ProgressUpdate = {
            type: 'complete',
            summary: {
              total: files.length,
              successful: successfulProcessing,
              failed: files.length - successfulProcessing,
              creditsUsed: successfulProcessing,
              remainingCredits: finalUser?.credits || 0
            }
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeUpdate)}\n\n`));

        } catch (error) {
          console.error('Error in bulk processing:', error);
          const errorUpdate: ProgressUpdate = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorUpdate)}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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