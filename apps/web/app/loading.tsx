import Image from "next/image"

export default function Loading() {
  return (
    <main
      id="main-content"
      role="status"
      aria-busy="true"
      aria-labelledby="route-loading-title"
      className="flex min-h-[72svh] items-center justify-center bg-[var(--canvas)] px-5 py-12 sm:px-8"
    >
      <section className="paper-panel w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-background">
        <div className="flex flex-col gap-7 p-6 sm:p-10">
          <div className="flex items-center gap-4">
            <Image
              src="/scout-icon-192.png"
              alt=""
              width={72}
              height={72}
              className="size-16 rounded-[1.15rem] sm:size-[4.5rem]"
              priority
            />
            <div>
              <p className="ink-label text-primary">Scout ACT</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                Adaptive study coach
              </p>
            </div>
          </div>

          <div>
            <h1
              id="route-loading-title"
              className="font-brand text-3xl font-black tracking-[-0.04em] text-foreground sm:text-5xl"
            >
              Getting your study space ready.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Scout is checking for a saved plan and preparing the right
              starting screen.
            </p>
          </div>

          <div
            aria-hidden="true"
            className="grid gap-3 border-t border-border pt-6"
          >
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
            <div className="h-3 w-full animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          </div>
        </div>

        <div className="border-t border-border bg-[var(--info-surface)] px-6 py-4 text-sm font-semibold text-secondary-foreground sm:px-10">
          Your results stay labeled as official, practice, or planning
          estimates.
        </div>
      </section>
    </main>
  )
}
