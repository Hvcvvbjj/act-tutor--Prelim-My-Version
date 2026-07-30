import { execFileSync } from "node:child_process"

import type { NextConfig } from "next"

const isDevelopment = process.env.NODE_ENV === "development"

const COMMIT_PATTERN = /^[0-9a-f]{40}$/i
const COMMIT_ENVIRONMENT_KEYS = [
  "SCOUT_SOURCE_COMMIT",
  "GITHUB_SHA",
  "CF_PAGES_COMMIT_SHA",
  "SOURCE_COMMIT_SHA",
  "COMMIT_SHA",
] as const

function normalizeCommit(value: string | undefined) {
  const commit = value?.trim()
  return commit && COMMIT_PATTERN.test(commit)
    ? commit.toLowerCase()
    : undefined
}

function resolveBuildCommit() {
  for (const key of COMMIT_ENVIRONMENT_KEYS) {
    const commit = normalizeCommit(process.env[key])
    if (commit) return commit
  }

  try {
    return normalizeCommit(
      execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
    )
  } catch {
    return undefined
  }
}

export const BUILD_COMMIT =
  (isDevelopment ? undefined : resolveBuildCommit()) ?? "development"

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' https://api.puter.com https://*.puter.com${isDevelopment ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ")

export const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: `${contentSecurityPolicy};`,
  },
  {
    key: "Permissions-Policy",
    value:
      "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-AlexACT-Release",
    value: BUILD_COMMIT,
  },
] as const

const nextConfig: NextConfig = {
  env: {
    SCOUT_BUILD_COMMIT: BUILD_COMMIT,
  },
  generateBuildId: async () => BUILD_COMMIT,
  poweredByHeader: false,
  transpilePackages: [
    "@act-tutor/content",
    "@act-tutor/core",
    "@act-tutor/server",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ]
  },
}

export default nextConfig
