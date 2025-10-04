import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { ImageDescriptionProcessor } from '@/lib/image-description-processor';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const images = formData.getAll('images') as File[];

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    // Validate file count (reasonable limit)
    if (images.length > 100) {
      return NextResponse.json({ 
        error: 'Too many files. Maximum 100 files allowed per batch.' 
      }, { status: 400 });
    }

    // Initialize the processor
    const processor = new ImageDescriptionProcessor(user.id);

    // Start processing with credit checks
    const results = await processor.processImages(images);

    return NextResponse.json({
      success: true,
      results: results.results,
      summary: {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
        creditsUsed: results.creditsUsed,
        remainingCredits: results.remainingCredits,
        stoppedDueToCredits: results.stoppedDueToCredits
      }
    });

  } catch (error) {
    console.error('Bulk processing error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}