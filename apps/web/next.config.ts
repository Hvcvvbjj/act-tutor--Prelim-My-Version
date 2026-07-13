import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@act-tutor/content",
    "@act-tutor/core",
    "@act-tutor/server",
  ],
}

export default nextConfig
