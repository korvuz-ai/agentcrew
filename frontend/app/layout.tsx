// Purpose: Root layout — ClerkProvider (when key is set), global fonts, base HTML structure
// Used by: all pages in the app

import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "korvuz.exe",
  description: "Build and run your AI agent company",
}

// ClerkProvider is loaded lazily so the app builds and runs without keys configured
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )

  if (!CLERK_KEY) return body

  const { ClerkProvider } = await import("@clerk/nextjs")
  return <ClerkProvider>{body}</ClerkProvider>
}
