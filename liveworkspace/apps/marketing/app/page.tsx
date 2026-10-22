import { AppArt } from '@/components/AppArt';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { listedApps } from '@/lib/apps';

// liveworkspace.app (liveworkspace/docs/marketing-site.md): what liveworkspace is, and the way on to
// each app. Short on purpose: each app's own site has the detail.

const PILLARS = [
  {
    title: 'Live by default',
    body: 'Everything you make is shared in real time. Send a link, and people are in the same document with you, seeing each change as it happens.',
  },
  {
    title: 'One account',
    body: 'Signing in goes through accounts.liveworkspace.app with a code sent to your email, no password to remember. Sign in once, and each app that uses it knows you.',
  },
  {
    title: 'Open about data',
    body: 'No third-party trackers, and no ads. The anonymous usage we do count is published for anyone to read, for every app together or one at a time.',
  },
  {
    title: 'Free to start',
    body: 'Each app works without paying, and you can start making something before you sign in.',
  },
];

export default function Home() {
  const apps = listedApps();
  return (
    <>
      <Header />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.18),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.22),transparent_60%)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              liveworkspace
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
              Live apps for every kind of work, under one roof.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Each liveworkspace app does one job well: drawing out an idea, or planning the work
              that follows it. They all share the same habits. Everything is real-time, you share by
              link, and nothing about you is sold or tracked.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="#apps"
                className="inline-flex min-h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                See the apps
              </a>
              <a
                href="/telemetry"
                className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900"
              >
                See exactly what we measure
              </a>
            </div>
          </div>
        </section>

        <section id="apps" className="scroll-mt-20 border-t border-slate-200 dark:border-slate-800">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              The apps
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
              Pick the one that fits the work in front of you. Each has its own site, with
              everything it can do.
            </p>
            <ul className="mt-10 grid gap-6 md:grid-cols-2">
              {apps.map((app) => (
                <li key={app.id}>
                  <a
                    href={app.url}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition-shadow hover:shadow-xl hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/30 dark:focus-visible:outline-white"
                  >
                    <div
                      className="border-b border-slate-200 p-6 dark:border-slate-800"
                      style={{ backgroundColor: `${app.accent}12` }}
                    >
                      <AppArt kind={app.art} accent={app.accent} />
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-white">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: app.accent }}
                        />
                        {app.name}
                      </h3>
                      <p className="mt-2 text-slate-600 dark:text-slate-300">{app.summary}</p>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {app.highlights.map((h) => (
                          <li
                            key={h}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {h}
                          </li>
                        ))}
                      </ul>
                      <span className="mt-6 text-sm font-semibold text-slate-900 dark:text-white">
                        Open {app.id}{' '}
                        <span
                          aria-hidden
                          className="inline-block transition-transform group-hover:translate-x-0.5"
                        >
                          →
                        </span>
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="how-it-fits"
          className="scroll-mt-20 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              How it fits together
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
              Different apps, the same promises. Whichever one you open, this is what you get.
            </p>
            <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <div key={p.title}>
                  <dt className="font-semibold text-slate-900 dark:text-white">{p.title}</dt>
                  <dd className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
                    {p.body}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-12 text-sm text-slate-500 dark:text-slate-400">
              The numbers are on the{' '}
              <a
                href="/telemetry"
                className="font-medium text-slate-900 underline underline-offset-4 dark:text-white"
              >
                telemetry dashboard
              </a>
              : anonymous, first-party, updated a few minutes at a time.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
