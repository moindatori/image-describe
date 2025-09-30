import { prisma } from './prisma'
import { CreditTransactionType } from '@prisma/client'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    throw new Error('User not authenticated')
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (!user) {
    throw new Error('User not found')
  }

  return user
}

export async function deductCredits(userId: string, amount: number, description?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user || user.credits < amount) {
    throw new Error('Insufficient credits')
  }

  // Update user credits and create transaction record
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: user.credits - amount }
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: CreditTransactionType.IMAGE_DESCRIPTION,
        description: description || `Used ${amount} credit(s) for image description`
      }
    })
  ])

  return updatedUser
}

export async function addCredits(userId: string, amount: number, type: CreditTransactionType, description?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Update user credits and create transaction record
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: user.credits + amount }
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        type,
        description: description || `Added ${amount} credit(s)`
      }
    })
  ])

  return updatedUser
}