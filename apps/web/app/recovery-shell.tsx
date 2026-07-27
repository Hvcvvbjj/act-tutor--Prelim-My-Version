import Image from "next/image"
import type { ReactNode } from "react"

type RecoveryShellProps = {
  actions: ReactNode
  body: string
  eyebrow: string
  reference?: string
  title: string
}

export function RecoveryShell({
  actions,
  body,
  eyebrow,
  reference,
  title,
}: RecoveryShellProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-[72svh] items-center justify-center bg-[var(--canvas)] px-5 py-12 sm:px-8"
    >
      <section
        aria-describedby="recovery-copy"
        aria-labelledby="recovery-title"
        className="paper-panel w-full max-w-2xl rounded-[2rem] border border-border bg-background p-6 sm:p-10"
      >
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Image
            src="/scout-icon-192.png"
            alt=""
            width={88}
            height={88}
            className="size-20 shrink-0 rounded-[1.4rem] sm:size-[5.5rem]"
          />
          <div>
            <p className="ink-label text-primary">{eyebrow}</p>
            <h1
              id="recovery-title"
              className="mt-2 font-brand text-3xl font-black tracking-[-0.04em] text-foreground sm:text-5xl"
            >
              {title}
            </h1>
          </div>
        </div>

        <p
          id="recovery-copy"
          className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg"
        >
          {body}
        </p>

        {reference ? (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Reference code:{" "}
            <code className="rounded bg-muted px-1.5 py-1 font-mono text-foreground">
              {reference}
            </code>
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>
      </section>
    </main>
  )
}
