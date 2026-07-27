import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scout ACT — Adaptive Study Coach",
    short_name: "Scout ACT",
    description:
      "An adaptive ACT coach that turns every scored answer into the next lesson.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#06736c",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16 32x32",
        type: "image/x-icon",
      },
    ],
  }
}
