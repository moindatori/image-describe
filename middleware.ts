import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth")
    const isAdminPage = req.nextUrl.pathname.startsWith("/admin")
    const isAppPage = req.nextUrl.pathname.startsWith("/app")

    // Redirect authenticated users away from auth pages
    if (isAuthPage && isAuth) {
      if (token?.role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin", req.url))
      }
      return NextResponse.redirect(new URL("/app/upload", req.url))
    }

    // Redirect unauthenticated users to sign in
    if (!isAuth && (isAppPage || isAdminPage)) {
      return NextResponse.redirect(new URL("/auth/signin", req.url))
    }

    // Check admin access
    if (isAdminPage && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/app/upload", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isAuthPage = req.nextUrl.pathname.startsWith("/auth")
        const isPublicPage = req.nextUrl.pathname === "/" || req.nextUrl.pathname.startsWith("/api/auth")
        
        // Allow access to auth pages and public pages
        if (isAuthPage || isPublicPage) {
          return true
        }

        // Require authentication for protected pages
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/auth/:path*"
  ]
}