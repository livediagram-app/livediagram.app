import { ctaHref } from '@livehuddle/api-schema';
import { CheckIcon, ChevronRightIcon } from '@livehuddle/ui';

// The closing call to action (docs/specs/019-marketing/marketing-site.md "Closing CTA"), shared by the
// landing page and every feature category page, so a visitor who drilled into a category can start
// without going home, and its copy lives in one place. On the promises' deep indigo, so the page ends
// on a strong note: the invitation and its two ways in (Open a Space, /new, where the visitor picks
// the Space or session to start from, worded the same on every page; Browse Templates, the landing gallery).
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
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(16_185_129/0.3),transparent_65%)]"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center sm:py-28">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-300">
          Ready when you are
        </p>
        <h2
          id="get-started-title"
          className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
        >
          Your next huddle is one click away
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-pretty text-lg leading-relaxed text-slate-300">
          No sign-up, no paywall, nothing to install. Open a Space, walk in, and share the link when
          the team is ready to join you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={ctaHref('/new', source)}
            className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-6 text-base font-semibold text-[#0b1026] shadow-[0_10px_30px_-10px_rgb(52_211_153/0.6)] transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="text-optical-centre">Open a Space</span>
            <ChevronRightIcon size={16} aria-hidden />
          </a>
          <a
            href="/#templates"
            className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-base font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span className="text-optical-centre">Browse Templates</span>
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
