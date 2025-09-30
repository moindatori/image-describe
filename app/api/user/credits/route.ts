import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    return NextResponse.json({
      credits: user.credits,
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error('Error fetching user credits:', error);
    
    // Check if it's an authentication error
    if (error instanceof Error && (error.message === 'User not authenticated' || error.message === 'User not found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch user credits' },
      { status: 500 }
    );
  }
}