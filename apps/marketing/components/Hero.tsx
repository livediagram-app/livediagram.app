import { HeroIllustration } from './HeroIllustration';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[600px] bg-gradient-to-b from-brand-100 via-brand-50 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          A canvas your team builds <span className="text-brand-600">together</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
          Flowcharts, mindmaps, retros, org charts — drawn from real shapes, themed in one click,
          shared with a link. Private by default, live with whoever you invite.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/live/new"
            className="inline-flex w-full items-center justify-center rounded-md bg-brand-500 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:w-auto"
          >
            Start drawing
          </a>
          <a
            href="#features"
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 sm:w-auto"
          >
            See what's in it
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-500">No sign-up — the canvas opens straight away.</p>

        <HeroIllustration />
      </div>
    </section>
  );
}
