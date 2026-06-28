// Purpose: Clerk-hosted sign-up page, styled to match earth tone theme
// Used by: sign-in page link

import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center font-mono text-lg font-semibold tracking-tight text-foreground">
          korvuz.exe
        </p>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-sm border border-border rounded-xl bg-card",
              headerTitle: "text-foreground font-semibold",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg",
              formFieldInput:
                "border-input bg-background text-foreground rounded-lg focus:ring-ring",
              footerActionLink: "text-primary hover:text-primary/80",
            },
          }}
        />
      </div>
    </div>
  )
}
