import { ctaHref } from '@livediagram/api-schema';
import { CheckIcon, ChevronRightIcon, START_BLANKS } from '@livediagram/ui';

// The closing call to action (docs/specs/019-marketing/marketing-site.md "Closing CTA"), shared by the
// landing page and every feature category page, so a visitor who drilled into a category can start
// without going home, and its copy lives in one place. On the promises' deep indigo, so the page ends
// on a strong note: the invitation and its two ways in (Start drawing, the wizard, worded the same on
// every page; Browse templates, the landing gallery) beside a launcher of one blank per mode, the
// header's Start Blank list, so the two never drift. `surface` is the page it closes, for the landing
// funnel (docs/specs/019-marketing/landing-funnel.md); every link here reports as its Closing slot.

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
      {/* The canvas's dot grid, and the prism's light pooling behind the launcher. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/2 h-[36rem] w-[36rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(37_99_235/0.35),transparent_65%)]"
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-6 py-24 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 text-center lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-300">
            Ready when you are
          </p>
          <h2
            id="get-started-title"
            className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            Your next idea is one click away
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-lg leading-relaxed text-slate-300 lg:mx-0">
            No sign-up, no paywall, nothing to install. Open a canvas, and share the link when you
            are ready for company.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <a
              href={ctaHref('/new', source)}
              className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-6 text-base font-semibold text-[#0b1026] shadow-[0_10px_30px_-10px_rgb(56_189_248/0.6)] transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="text-optical-centre">Start drawing</span>
              <ChevronRightIcon size={16} aria-hidden />
            </a>
            <a
              href="/#templates"
              className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-base font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="text-optical-centre">Browse templates</span>
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-300 lg:justify-start">
            {CHECKS.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <CheckIcon size={16} aria-hidden className="text-emerald-400" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* The launcher: one blank per mode, straight into the editor. */}
        <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm sm:p-4">
          <p
            id="get-started-blanks"
            className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400"
          >
            Or start blank
          </p>
          <ul aria-labelledby="get-started-blanks" className="flex flex-col gap-1.5">
            {START_BLANKS.map(({ label, desc, href, blank, Icon }) => (
              <li key={blank}>
                <a
                  href={ctaHref(href, source)}
                  className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-micro hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-sky-300"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300 transition-colors duration-micro group-hover:bg-sky-400/20">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-white">{label}</span>
                    <span className="block text-sm text-slate-400 sm:truncate">{desc}</span>
                  </span>
                  <ChevronRightIcon
                    size={16}
                    aria-hidden
                    className="shrink-0 text-slate-500 transition-transform duration-micro group-hover:text-white motion-safe:group-hover:translate-x-0.5"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
