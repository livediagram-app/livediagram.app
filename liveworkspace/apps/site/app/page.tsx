import { BrandMark, lucideGlyph } from '@livediagram/ui';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';
import type { Metadata } from 'next';
import { type CSSProperties, Fragment, type ReactNode } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ClosingActions, SignUpPromise } from '@/components/landing/AccountActions';
import { Apps } from '@/components/landing/Apps';
import { HeroActions } from '@/components/landing/HeroActions';
import { HubArt } from '@/components/landing/HubArt';
import { Promises } from '@/components/landing/Promises';
import { listedApps } from '@/lib/apps';
import './landing-motion.css';

const CheckIcon = lucideGlyph(lucideCheck, 14);

// The closing banner's glows: each a box within the card whose gradient reaches transparent at the box's nearest
// side (closest-side), so it fades out on every side before the card's edge; its centre leans toward its corner.
const CLOSING_GLOW = 'pointer-events-none absolute inset-y-0 w-4/5';
const CLOSING_SKY = 'bg-[radial-gradient(closest-side_at_40%_60%,rgb(14_165_233/0.4),transparent)]';
const CLOSING_VIOLET =
  'bg-[radial-gradient(closest-side_at_60%_40%,rgb(139_92_246/0.45),transparent)]';

export const metadata: Metadata = { alternates: { canonical: '/' } };

// What each app is for, in the order work moves through them, for the hero's first paragraph.
const STEPS: Partial<Record<SiteId, string>> = {
  'livediagram.app': 'Sketch the idea',
  'liveplanner.app': 'plan the work',
  'livedocuments.app': 'write it up',
  'livedesign.app': 'make it look right',
  'livehuddle.app': 'talk it through',
  'liveknowledge.app': 'keep what you learn',
};

// Every app is open source (each product's LICENSE). The second one changes for someone signed in (SignUpPromise).
const PROMISES: { key: string; text: ReactNode }[] = [
  { key: 'open-source', text: 'Open source' },
  { key: 'no-sign-up', text: <SignUpPromise /> },
  { key: 'no-trackers', text: 'No trackers or ads' },
];

// liveworkspace.app's front door (liveworkspace/docs/specs/010-site/site.md "The front door"): what liveworkspace
// is, the apps in it and how they join up, and the one account that ties them together.
export default function Home() {
  const apps = listedApps();
  return (
    <>
      <Header share />
      <main>
        <section className="hero-tall relative overflow-hidden [--hero-tall-header:64px]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_0%,rgb(14_165_233/0.12),transparent_70%),radial-gradient(60%_60%_at_95%_30%,rgb(139_92_246/0.12),transparent_70%)] dark:bg-[radial-gradient(70%_60%_at_15%_0%,rgb(14_165_233/0.16),transparent_70%),radial-gradient(60%_60%_at_95%_30%,rgb(139_92_246/0.18),transparent_70%)]"
          />
          <div className="relative mx-auto grid w-full max-w-7xl flex-1 content-center items-center gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:pt-24 lg:pb-28">
            <div className="lw-rise text-center sm:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 py-1 pr-3.5 pl-1.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <BrandMark accentColor={PLATFORM_SITE.accent} className="size-4" />
                </span>
                One free account, every app included
              </p>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-slate-900 sm:text-6xl lg:text-[4.25rem] dark:text-white">
                Everything your team makes,{' '}
                <span className="bg-gradient-to-r from-sky-600 via-indigo-500 to-violet-600 bg-clip-text text-transparent dark:from-sky-400 dark:via-indigo-300 dark:to-violet-400">
                  live
                </span>{' '}
                in one workspace.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed sm:mx-0 text-slate-600 sm:text-xl dark:text-slate-300">
                liveworkspace is a family of real-time apps.{' '}
                {apps.map((app, i) => (
                  <Fragment key={app.id}>
                    {i === 0 ? '' : i === apps.length - 1 ? ', and ' : ', '}
                    {STEPS[app.id] ?? 'work'} in{' '}
                    <a
                      href={app.url}
                      className="font-semibold text-[var(--lw-ink)] underline-offset-4 hover:underline dark:text-[var(--lw-ink-dark)]"
                      style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.light } as CSSProperties}
                    >
                      {app.name}
                    </a>
                  </Fragment>
                ))}
                .
              </p>
              <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed sm:mx-0 text-slate-600 sm:text-xl dark:text-slate-300">
                One account opens them all, and every link opens straight into the work, with
                everyone already in it.
              </p>
              <HeroActions />
              <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm sm:justify-start text-slate-500 dark:text-slate-400">
                {PROMISES.map((p) => (
                  <li key={p.key} className="flex items-center gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      <CheckIcon />
                    </span>
                    {p.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lw-rise hidden [animation-delay:150ms] sm:block">
              <HubArt />
            </div>
          </div>
        </section>

        <Apps />
        <Promises />

        <section className="px-4 py-20 sm:px-6 sm:py-28">
          {/* The closing banner: a card with its own surface in both modes (a lighter slate and a hairline on the dark
              page), and two glows that each fade to nothing inside their own box, held within the card, so no edge
              of either is ever cut straight (site.md "The front door", Paint). */}
          <div
            data-closing-banner=""
            className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-16 text-center ring-1 ring-white/10 ring-inset sm:px-12 sm:py-20 dark:bg-slate-900"
          >
            <div aria-hidden data-hero-glow className={`${CLOSING_GLOW} left-0 ${CLOSING_SKY}`} />
            <div
              aria-hidden
              data-hero-glow
              className={`${CLOSING_GLOW} right-0 ${CLOSING_VIOLET}`}
            />
            <div className="relative">
              <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <BrandMark variant="full" accentColor={PLATFORM_SITE.accent} className="size-14" />
              </span>
              <h2 className="mx-auto mt-8 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                One account. Every app. Always live.
              </h2>
              <ClosingActions />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
