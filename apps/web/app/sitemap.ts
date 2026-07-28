import type { MetadataRoute } from "next"

const SITE_URL = "https://scout-act-tutor.u1231294912.chatgpt.site"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
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
  ]
}
