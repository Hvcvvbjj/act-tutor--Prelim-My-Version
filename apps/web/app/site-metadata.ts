import type { Metadata, Viewport } from "next"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://scout-act-tutor.u1231294912.chatgpt.site"
const SITE_TITLE = "AlexACT — Adaptive ACT Study Coach"
const SITE_DESCRIPTION =
  "An adaptive ACT coach that turns every answer into the next lesson."

export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "AlexACT",
  title: {
    default: SITE_TITLE,
    template: "%s | AlexACT",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    title: "AlexACT",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AlexACT",
    title: SITE_TITLE,
    description:
      "Meet Mr. Kim, your AI study coach for clear lessons, skill profiles, and an ACT plan that adapts after every round.",
    images: [
      {
        url: "/scout-social-preview.png",
        width: 1200,
        height: 630,
        alt: "Mr. Kim guides a student through AlexACT skill polygons and a lesson path.",
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
