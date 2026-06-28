// Purpose: Route protection — redirects unauthenticated users; skipped when Clerk keys are not set
// Used by: Next.js middleware pipeline

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// When CLERK_SECRET_KEY is not configured, bypass all auth checks so the UI is accessible
const hasClerk = !!process.env.CLERK_SECRET_KEY

async function clerkHandler(request: NextRequest) {
  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server")

  const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"])
  const isOnboarding = createRouteMatcher(["/onboarding"])

  return clerkMiddleware((auth, req) => {
    const { userId, orgId } = auth()
    if (!userId && !isPublic(req)) return auth().redirectToSignIn({ returnBackUrl: req.url })
    if (userId && !orgId && !isOnboarding(req) && !isPublic(req))
      return NextResponse.redirect(new URL("/onboarding", req.url))
    if (userId && orgId && isOnboarding(req))
      return NextResponse.redirect(new URL("/dashboard", req.url))
  })(request, {} as never)
}

export default function middleware(request: NextRequest) {
  if (!hasClerk) return NextResponse.next()
  return clerkHandler(request)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
