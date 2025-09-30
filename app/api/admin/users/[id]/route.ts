import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { credits, role, isActive } = await request.json()
    const resolvedParams = await params
    const userId = resolvedParams.id

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: { credits?: number; role?: UserRole; isActive?: boolean } = {}
    
    if (credits !== undefined && credits !== currentUser.credits) {
      updateData.credits = credits
      
      // Create credit transaction for admin adjustment
      const creditDifference = credits - currentUser.credits
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount: creditDifference,
          type: "ADMIN_ADJUSTMENT",
          description: `Admin adjustment: ${creditDifference > 0 ? "+" : ""}${creditDifference} credits`
        }
      })
    }

    if (role !== undefined) {
      updateData.role = role
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    return NextResponse.json({
      message: "User updated successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        credits: updatedUser.credits,
        isActive: updatedUser.isActive
      }
    })
  } catch (error) {
    console.error("Admin user update error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}