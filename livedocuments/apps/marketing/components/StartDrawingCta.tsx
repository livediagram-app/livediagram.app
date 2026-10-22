import { ctaHref } from '@livedocuments/api-schema';
import { CheckIcon, ChevronRightIcon } from '@livedocuments/ui';

// The closing call to action (docs/specs/019-marketing/marketing-site.md "Closing CTA"), shared by the
// landing page and every feature category page, so a visitor who drilled into a category can start
// without going home, and its copy lives in one place. On the promises' deep indigo, so the page ends
// on a strong note: the invitation and its two ways in (Start creating, /new, where the visitor picks
// what they are making, worded the same on every page; Browse templates, the landing gallery).
// `surface` is the page it closes, for the landing funnel (docs/specs/019-marketing/landing-funnel.md);
// the link into the editor reports as its Closing slot.

// Three things true today, each a promise the page has already made.
const CHECKS = ['Free for everyone', 'Open source', 'Works offline'];

export function StartDrawingCta({ surface }: { surface: 'Home' | 'Feature' }) {
  const source = `${surface}.Closing` as const;
  return (
    <section
      id="get-started"
      aria-labelledby="get-started-title"
      className="relative overflow-hidden bg-[#0b1026] text-white"
    >
      {/* The canvas's dot grid, and the prism's light pooling behind the invitation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(217_119_6/0.35),transparent_65%)]"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-300">
          Ready when you are
        </p>
        <h2
          id="get-started-title"
          className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
        >
          Your next idea is one click away
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-pretty text-lg leading-relaxed text-slate-300">
          No sign-up, no paywall, nothing to install. Open a blank page, and share the link when you
          are ready for company.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={ctaHref('/new', source)}
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-6 text-base font-semibold text-[#0b1026] shadow-[0_10px_30px_-10px_rgb(251_191_36/0.6)] transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="text-optical-centre">Start creating</span>
            <ChevronRightIcon size={16} aria-hidden />
          </a>
          <a
            href="/#templates"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-base font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="text-optical-centre">Browse templates</span>
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-300">
          {CHECKS.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <CheckIcon size={16} aria-hidden className="text-emerald-400" />
              {c}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
