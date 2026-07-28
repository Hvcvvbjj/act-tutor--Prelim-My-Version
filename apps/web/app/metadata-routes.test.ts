import { describe, expect, it } from "vitest"

import manifest from "./manifest"
import robots from "./robots"
import { siteMetadata, siteViewport } from "./site-metadata"
import sitemap from "./sitemap"

const SITE_URL = "https://scout-act-tutor.u1231294912.chatgpt.site"

describe("public metadata routes", () => {
  it("brands browser, sharing, and installed-app surfaces consistently", () => {
    expect(siteMetadata.metadataBase?.toString()).toBe(`${SITE_URL}/`)
    expect(siteMetadata).toMatchObject({
      applicationName: "Scout ACT",
      title: {
        default: "Scout ACT — Adaptive ACT Study Coach",
        template: "%s | Scout ACT",
      },
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
        title: "Scout ACT — Adaptive ACT Study Coach",
      },
      twitter: {
        card: "summary_large_image",
        title: "Scout ACT — Adaptive ACT Study Coach",
      },
    })
    expect(siteViewport).toEqual({
      width: "device-width",
      initialScale: 1,
      colorScheme: "light",
      themeColor: "#06736c",
    })
  })

  it("describes Scout as an installable education app", () => {
    expect(manifest()).toMatchObject({
      name: "Scout ACT — Adaptive Study Coach",
      short_name: "Scout ACT",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f6f8fb",
      theme_color: "#06736c",
      categories: ["education", "productivity"],
      icons: [
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
        },
        {
          src: "/scout-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/scout-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/favicon.ico",
          sizes: "16x16 32x32",
          type: "image/x-icon",
        },
      ],
    })
  })

  it("allows the public app while keeping API routes out of search results", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: "/api/",
      },
      sitemap: `${SITE_URL}/sitemap.xml`,
      host: SITE_URL,
    })
  })

  it("publishes the public app in its sitemap", () => {
    expect(sitemap()).toEqual([
      {
        url: SITE_URL,
        changeFrequency: "monthly",
        priority: 1,
      },
      {
        url: `${SITE_URL}/trust`,
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        url: `${SITE_URL}/how-scout-works`,
        changeFrequency: "monthly",
        priority: 0.7,
      },
    ])
  })
})
