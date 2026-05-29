export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium tracking-wide text-brand-700 uppercase">
          Real-time collaboration
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          Diagrams your team builds <span className="text-brand-600">together</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
          A multiplayer canvas for diagrams and mindmaps. Live cursors, instant sync, no
          friction — for teams who think visually.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#get-started"
            className="inline-flex w-full items-center justify-center rounded-md bg-brand-500 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
          >
            Get started
          </a>
          <a
            href="#how-it-works"
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 sm:w-auto"
          >
            See how it works
          </a>
        </div>

        <div
          aria-hidden
          className="mx-auto mt-16 max-w-4xl rounded-xl border border-brand-200 bg-white p-2 shadow-xl shadow-brand-500/10"
        >
          <div className="aspect-[16/9] w-full rounded-lg bg-gradient-to-br from-brand-50 to-white p-8">
            <div className="flex h-full items-center justify-center">
              <div className="grid grid-cols-3 gap-4 opacity-70">
                <div className="h-16 w-32 rounded-md border-2 border-brand-400 bg-brand-50" />
                <div className="h-16 w-32 rounded-md border-2 border-brand-500 bg-brand-100" />
                <div className="h-16 w-32 rounded-md border-2 border-brand-400 bg-brand-50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
