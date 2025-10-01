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

    // Get total users
    const totalUsers = await prisma.user.count()

    // Get total credits issued (sum of all positive credit transactions)
    const creditStats = await prisma.creditTransaction.aggregate({
      where: {
        amount: {
          gt: 0
        }
      },
      _sum: {
        amount: true
      }
    })

    // Get total images processed
    const totalImagesProcessed = await prisma.imageDescription.count()

    // Get active users (users who have processed images in the last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const activeUsers = await prisma.user.count({
      where: {
        imageDescriptions: {
          some: {
            createdAt: {
              gte: thirtyDaysAgo
            }
          }
        }
      }
    })

    // Get total remaining credits (sum of all users' current credit balances)
    const remainingCreditsStats = await prisma.user.aggregate({
      _sum: {
        credits: true
      }
    })

    return NextResponse.json({
      totalUsers,
      totalCreditsIssued: creditStats._sum.amount || 0,
      totalImagesProcessed,
      activeUsers,
      totalRemainingCredits: remainingCreditsStats._sum.credits || 0
    })
  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}