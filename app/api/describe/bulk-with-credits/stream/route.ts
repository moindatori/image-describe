import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';
import { ImageDescriptionProcessor } from '@/lib/image-description-processor';

// Session management
const activeSessions = new Map<string, {
  processor?: ImageDescriptionProcessor;
  controller: AbortController;
  startTime: number;
}>();

// Cleanup old sessions (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.startTime > oneHour) {
      session.controller.abort();
      activeSessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

export async function GET(_request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Create a unique session ID
    const sessionId = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create abort controller for this session
    const controller = new AbortController();
    
    // Set up Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(`data: ${JSON.stringify({
          type: 'connected',
          sessionId,
          message: 'Connected to processing stream'
        })}\n\n`);
      },
      cancel() {
        // Clean up when client disconnects
        if (activeSessions.has(sessionId)) {
          const session = activeSessions.get(sessionId)!;
          session.controller.abort();
          activeSessions.delete(sessionId);
        }
      }
    });

    // Store session info
    activeSessions.set(sessionId, {
      controller,
      startTime: Date.now()
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('Stream setup error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

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
    const sessionId = formData.get('sessionId') as string;

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (!sessionId || !activeSessions.has(sessionId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    // Get the session
    const session = activeSessions.get(sessionId)!;
    
    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create processor instance for this user
          const processor = new ImageDescriptionProcessor(user.id);
          
          // Process images with streaming updates
          await processor.processImagesWithStreaming(
            images,
            (update) => {
              // Send progress update via SSE
              controller.enqueue(`data: ${JSON.stringify(update)}\n\n`);
            },
            session.controller.signal
          );

          // Send completion message
          controller.enqueue(`data: ${JSON.stringify({
            type: 'complete',
            message: 'Processing completed'
          })}\n\n`);

          controller.close();
          
          // Clean up session
          activeSessions.delete(sessionId);

        } catch (error) {
          console.error('Processing error:', error);
          
          // Send error message
          controller.enqueue(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`);

          controller.close();
          
          // Clean up session
          activeSessions.delete(sessionId);
        }
      },
      cancel() {
        // Clean up when client disconnects
        if (activeSessions.has(sessionId)) {
          session.controller.abort();
          activeSessions.delete(sessionId);
        }
      }
    });

    return new NextResponse(stream, {
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
    console.error('Streaming processing error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}