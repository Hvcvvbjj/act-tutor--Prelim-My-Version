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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://scout-act-tutor.u1231294912.chatgpt.site"
  ),
  title: "Scout ACT",
  description:
    "An adaptive ACT coach that turns every answer into the next lesson.",
  openGraph: {
    title: "Scout ACT",
    description:
      "Meet Mr. Kim, your AI study coach for clear lessons, skill profiles, and an ACT plan that adapts after every round.",
    images: [
      {
        url: "/scout-social-preview.png",
        width: 1731,
        height: 909,
        alt: "A student studies beside a friendly geometric owl coach.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scout ACT",
    description:
      "Clear ACT lessons, honest skill profiles, and a study cycle that adapts with you.",
    images: ["/scout-social-preview.png"],
  },
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
      <body>
        <a
          href="#main-content"
          className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-lg bg-foreground px-4 py-3 text-sm font-bold text-background shadow-lg transition-transform focus:translate-y-0 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none motion-reduce:transition-none"
        >
          Skip to main content
        </a>
        {children}
        <footer className="border-t border-border/80 bg-background px-5 pt-6 pb-24 text-muted-foreground md:pb-6">
          <div className="mx-auto flex max-w-[86rem] flex-col gap-2 text-xs leading-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <p>
              <span className="font-bold text-foreground">
                Independent hackathon project.
              </span>{" "}
              Scout ACT is not affiliated with or endorsed by ACT.
            </p>
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
