import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/user';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const user = await getCurrentUser();
    
    const skip = (page - 1) * limit;

    // Build where clause for search
    const whereClause = {
      userId: user.id,
      ...(search && {
        OR: [
          { filename: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    // Get total count for pagination
    const totalCount = await prisma.imageDescription.count({
      where: whereClause,
    });

    // Get paginated results
    const descriptions = await prisma.imageDescription.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        filename: true,
        description: true,
        confidence: true,
        source: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      descriptions,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message === 'User not authenticated' || error.message === 'User not found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    // Delete all image descriptions for the current user
    const result = await prisma.imageDescription.deleteMany({
      where: {
        userId: user.id,
      },
    });

    return NextResponse.json({
      message: 'History cleared successfully',
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Error clearing history:', error);
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message === 'User not authenticated' || error.message === 'User not found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to clear history' },
      { status: 500 }
    );
  }
}