import { StartDrawingArt } from '@/components/StartDrawingArt';

// The closing "Time to start" call-to-action. Shared by the landing page
// (`app/page.tsx`) and every feature category page (`/features/<id>`) so a
// visitor who drilled into a category can convert without bouncing home, and
// the CTA copy / styling lives in exactly one place. The primary CTA reads
// "Start drawing" everywhere (docs/specs/019-marketing/marketing-site.md).
export function StartDrawingCta() {
  return (
    <section id="get-started" className="border-t border-slate-200/70 bg-brand-500">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
        <StartDrawingArt />
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Time to start
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50">
          No sign up required, no subscriptions or payments of any kind, livediagram is completely
          free and open source.
        </p>
        <div className="mt-8">
          <a
            href="/new"
            className="inline-flex items-center justify-center rounded-md bg-white px-6 py-3 text-base font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Start drawing
          </a>
        </div>
      </div>
    </section>
  );
}
