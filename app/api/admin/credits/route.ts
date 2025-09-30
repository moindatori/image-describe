import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const transactions = await prisma.creditTransaction.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100 // Limit to last 100 transactions
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error("Admin credits fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { userId, amount, description } = await request.json()

    if (!userId || !amount) {
      return NextResponse.json(
        { error: "User ID and amount are required" },
        { status: 400 }
      )
    }

    // Update user credits
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: amount
        }
      }
    })

    // Create credit transaction
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "ADMIN_ADJUSTMENT",
        description: description || "Admin credit adjustment"
      }
    })

    return NextResponse.json({
      message: "Credits added successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        credits: updatedUser.credits
      }
    })
  } catch (error) {
    console.error("Admin credits add error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}