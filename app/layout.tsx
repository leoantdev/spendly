import { Geist, Geist_Mono } from "next/font/google"
import type { Metadata, Viewport } from "next"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Spendly",
  description: "Log expenses in seconds and see where your money went.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Spendly",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "touch-manipulation antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
