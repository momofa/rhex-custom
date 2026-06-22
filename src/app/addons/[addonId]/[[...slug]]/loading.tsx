export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-1">
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
          <section className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="h-7 w-28 animate-pulse rounded-full bg-muted" />
            <div className="mt-4 h-8 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-muted" />
            <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="h-10 w-32 animate-pulse rounded-full bg-muted" />
              <div className="h-10 w-28 animate-pulse rounded-full bg-muted" />
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
