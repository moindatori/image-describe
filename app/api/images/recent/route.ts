import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/user';

export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getCurrentUser();

    // Fetch recent images for the user
    const recentImages = await prisma.imageDescription.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Limit to 10 most recent images
      select: {
        id: true,
        filename: true,
        description: true,
        confidence: true,
        source: true,
        createdAt: true,
      },
    });

    return NextResponse.json(recentImages);

  } catch (error) {
    console.error('Error fetching recent images:', error);
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message === 'User not authenticated' || error.message === 'User not found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch recent images' },
      { status: 500 }
    );
  }
}