import type { Metadata, Viewport } from "next"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://scout-act-tutor.u1231294912.chatgpt.site"
const SITE_TITLE = "Scout ACT — Adaptive ACT Study Coach"
const SITE_DESCRIPTION =
  "An adaptive ACT coach that turns every answer into the next lesson."

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Scout ACT",
  title: {
    default: SITE_TITLE,
    template: "%s | Scout ACT",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    title: "Scout ACT",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Scout ACT",
    title: SITE_TITLE,
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
    title: SITE_TITLE,
    description:
      "Clear ACT lessons, honest skill profiles, and a study cycle that adapts with you.",
    images: ["/scout-social-preview.png"],
  },
}

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#06736c",
}
