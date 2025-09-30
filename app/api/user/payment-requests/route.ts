import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's payment requests
    const paymentRequests = await prisma.paymentRequest.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        creditsRequested: true,
        amount: true,
        currency: true,
        location: true,
        paymentMethod: true,
        transactionId: true,
        status: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      paymentRequests
    });

  } catch (error) {
    console.error('Error fetching user payment requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}