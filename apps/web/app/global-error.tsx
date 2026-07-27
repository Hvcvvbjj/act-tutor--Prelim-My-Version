"use client"

import Link from "next/link"

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f6f8fb",
          color: "#10213f",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <title>Scout ACT — Recovery</title>
        <main
          id="main-content"
          style={{
            boxSizing: "border-box",
            display: "grid",
            minHeight: "100svh",
            placeItems: "center",
            padding: "32px 20px",
          }}
        >
          <section
            aria-describedby="global-recovery-copy"
            aria-labelledby="global-recovery-title"
            style={{
              boxSizing: "border-box",
              width: "min(100%, 640px)",
              border: "1px solid #d6dce5",
              borderRadius: 28,
              background: "#ffffff",
              padding: "clamp(24px, 6vw, 48px)",
              boxShadow: "0 18px 50px rgb(16 33 63 / 0.10)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#06736c",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Recovery mode
            </p>
            <h1
              id="global-recovery-title"
              style={{
                margin: "12px 0 0",
                fontSize: "clamp(32px, 7vw, 52px)",
                letterSpacing: "-0.04em",
                lineHeight: 1.02,
              }}
            >
              Scout needs a fresh start.
            </h1>
            <p
              id="global-recovery-copy"
              style={{
                margin: "22px 0 0",
                color: "#5d6a7d",
                fontSize: 17,
                lineHeight: 1.65,
              }}
            >
              The app couldn’t finish opening. Retry the page, or return to the
              study home.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 30,
              }}
            >
              <button
                type="button"
                onClick={unstable_retry}
                style={{
                  minHeight: 48,
                  border: 0,
                  borderRadius: 12,
                  background: "#06736c",
                  color: "#ffffff",
                  cursor: "pointer",
                  padding: "12px 20px",
                  font: "inherit",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                Try again
              </button>
              <Link
                href="/"
                style={{
                  boxSizing: "border-box",
                  display: "inline-flex",
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #d6dce5",
                  borderRadius: 12,
                  color: "#10213f",
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Return to Scout home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
