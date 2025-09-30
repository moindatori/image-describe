import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          credits: user.credits,
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.credits = user.credits
      }
      return token
    },
    async session({ session, token }) {
      if (token && token.sub) {
        // Fetch fresh user data from database to ensure role is current
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { id: true, email: true, name: true, role: true, credits: true }
        })
        
        if (dbUser) {
          session.user.id = dbUser.id
          session.user.role = dbUser.role
          session.user.credits = dbUser.credits
          session.user.email = dbUser.email
          session.user.name = dbUser.name
        } else {
          // Fallback to token data if user not found
          session.user.id = token.sub
          session.user.role = token.role as string
          session.user.credits = token.credits as number
        }
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
}