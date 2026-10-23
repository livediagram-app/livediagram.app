import { BrandMark, lucideGlyph } from '@livediagram/ui';
import { lucideCheck } from '@livediagram/icons/lucide';
import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';
import { type CSSProperties, Fragment } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Apps } from '@/components/landing/Apps';
import { HeroActions } from '@/components/landing/HeroActions';
import { HubArt } from '@/components/landing/HubArt';
import { Journey } from '@/components/landing/Journey';
import { listedApps } from '@/lib/apps';
import './landing-motion.css';

const CheckIcon = lucideGlyph(lucideCheck, 14);

// What each app is for, in the order work moves through them, for the hero's one sentence.
const STEPS: Partial<Record<SiteId, string>> = {
  'livediagram.app': 'Sketch the idea',
  'liveplanner.app': 'plan the work',
  'livedocuments.app': 'write it up',
  'livedesign.app': 'make it look right',
};

const PROMISES = ['Completely free', 'No sign-up needed', 'No trackers or ads'];

// liveworkspace.app's front door (liveworkspace/docs/site.md "The front door"): what liveworkspace
// is, the apps in it and how they join up, and the one account that ties them together.
export default function Home() {
  const apps = listedApps();
  return (
    <>
      <Header />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_0%,rgb(14_165_233/0.12),transparent_70%),radial-gradient(60%_60%_at_95%_30%,rgb(139_92_246/0.12),transparent_70%)] dark:bg-[radial-gradient(70%_60%_at_15%_0%,rgb(14_165_233/0.16),transparent_70%),radial-gradient(60%_60%_at_95%_30%,rgb(139_92_246/0.18),transparent_70%)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:pt-24 lg:pb-28">
            <div className="lw-rise text-center sm:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 py-1 pr-3.5 pl-1.5 text-sm font-medium text-slate-600 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
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
                      style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.accent } as CSSProperties}
                    >
                      {app.name}
                    </a>
                  </Fragment>
                ))}
                , all with one account. Every link opens straight into the work, with everyone
                already in it.
              </p>
              <HeroActions />
              <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm sm:justify-start text-slate-500 dark:text-slate-400">
                {PROMISES.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      <CheckIcon />
                    </span>
                    {p}
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
        <Journey />

        <section className="px-4 py-20 sm:px-6 sm:py-28">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(50%_70%_at_0%_100%,rgb(14_165_233/0.35),transparent_70%),radial-gradient(50%_70%_at_100%_0%,rgb(139_92_246/0.4),transparent_70%)]"
            />
            <div className="relative">
              <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <BrandMark variant="full" accentColor={PLATFORM_SITE.accent} className="size-14" />
              </span>
              <h2 className="mx-auto mt-8 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                One account. Every app. Always live.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
                Or start your work as a guest without signing in at all.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <a
                  href="/sign-up?return=%2F"
                  className="relative touch-target-y inline-flex min-h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-px hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Create your free account
                </a>
                <a
                  href="#apps"
                  className="relative touch-target-y inline-flex min-h-12 items-center rounded-full border border-white/25 px-6 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Pick an app
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
