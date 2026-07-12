import type { Metadata } from "next"
import { Geist } from "next/font/google"

import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "AI ACT Tutor",
  description: "A deterministic, adaptive ACT study-plan tutor.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} font-sans antialiased`}>
      <body>{children}</body>
    </html>
  )
}
