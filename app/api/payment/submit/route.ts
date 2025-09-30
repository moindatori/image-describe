import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const screenshot = formData.get('screenshot') as File;
    const credits = formData.get('credits') as string;
    const amount = formData.get('amount') as string;
    const transactionId = formData.get('transactionId') as string;
    const qrCode = formData.get('qrCode') as string;

    // Validate required fields
    if (!screenshot || !credits || !amount || !transactionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate file
    if (!screenshot.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image.' }, { status: 400 });
    }

    if (screenshot.size > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json({ error: 'File size too large. Maximum 5MB allowed.' }, { status: 400 });
    }

    // Validate credits and amount
    const creditsNum = parseInt(credits);
    const amountNum = parseFloat(amount);

    if (isNaN(creditsNum) || creditsNum < 10) {
      return NextResponse.json({ error: 'Invalid credits amount. Minimum 10 credits required.' }, { status: 400 });
    }

    if (isNaN(amountNum) || amountNum < 50) {
      return NextResponse.json({ error: 'Invalid amount. Minimum 50 PKR required.' }, { status: 400 });
    }

    // Validate transaction ID
    if (transactionId.trim().length < 3) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'payment-screenshots');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = screenshot.name.split('.').pop() || 'jpg';
    const filename = `payment_${session.user.id}_${timestamp}.${fileExtension}`;
    const filepath = join(uploadsDir, filename);

    // Save file
    const bytes = await screenshot.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Save payment request to database
    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        userId: session.user.id,
        creditsRequested: creditsNum,
        amount: amountNum,
        paymentMethod: 'QR_CODE', // New payment method type
        transactionId: transactionId.trim(),
        qrCodeUsed: qrCode || null,
        screenshotUrl: `/uploads/payment-screenshots/${filename}`,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment request submitted successfully',
      requestId: paymentRequest.id,
    });

  } catch (error) {
    console.error('Payment submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}