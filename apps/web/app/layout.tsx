import { Archivo, Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"

import "./globals.css"
import { siteMetadata, siteViewport } from "./site-metadata"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
})
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
})

export const metadata = siteMetadata
export const viewport = siteViewport

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
      <body>
        <a
          href="#main-content"
          className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-lg bg-foreground px-4 py-3 text-sm font-bold text-background shadow-lg transition-transform focus:translate-y-0 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none"
        >
          Skip to main content
        </a>
        {children}
        <footer className="border-t border-border/80 bg-background px-5 pt-6 pb-24 text-muted-foreground md:pb-6">
          <div className="mx-auto flex max-w-[86rem] flex-col gap-3 text-xs leading-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div>
              <p>
                <span className="font-bold text-foreground">
                  Independent hackathon project.
                </span>{" "}
                Scout ACT is not affiliated with or endorsed by ACT.
              </p>
              <nav
                aria-label="About Scout"
                className="mt-2 flex flex-wrap gap-x-5"
              >
                <Link
                  href="/how-scout-works"
                  className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  How Scout works
                </Link>
                <Link
                  href="/trust"
                  className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  Data, privacy, and product limits
                </Link>
                <Link
                  href="/accessibility"
                  className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  Accessibility
                </Link>
                <a
                  href="https://github.com/Hvcvvbjj/act-tutor--Prelim-My-Version"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  Source code
                </a>
              </nav>
            </div>
            <p className="sm:max-w-xl sm:text-right">
              Practice content is original. Skill percentages and practice score
              ranges are learning estimates—not official ACT results.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
