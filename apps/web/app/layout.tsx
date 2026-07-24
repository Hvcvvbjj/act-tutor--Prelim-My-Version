import type { Metadata } from "next"
import { Archivo, Geist, Geist_Mono } from "next/font/google"

import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
})

export const metadata: Metadata = {
  title: "Scout ACT",
  description:
    "An adaptive ACT coach that turns every answer into the next lesson.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${archivo.variable} font-sans antialiased`}
    >
      <body>{children}</body>
    </html>
  )
}
