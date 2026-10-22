import { BrandMark } from '@livediagram/ui';
import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';
import type { CSSProperties, ReactNode } from 'react';
import { listedApps, type ListedApp } from '@/lib/apps';
import { Footer } from './Footer';
import { Header } from './Header';
import { AppLogo, AppMark } from './landing/AppLogo';

// One part of a legal page. With `app`, it is about that app alone and sits under App by app, in
// the app's colours; without, it applies everywhere.
export type LegalSection = { id: string; title: string; body: ReactNode; app?: SiteId };

// A promise shown at a glance above the full text.
export type LegalHighlight = { icon: ReactNode; title: string; body: string };

const PAGES = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Use' },
];

// Reading styles for the text the pages pass in, which is plain HTML.
const PROSE =
  'text-[1.0625rem] leading-relaxed text-slate-700 dark:text-slate-300 [&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-slate-300 [&_a]:underline-offset-4 hover:[&_a]:decoration-slate-900 dark:[&_a]:text-white dark:[&_a]:decoration-slate-600 dark:hover:[&_a]:decoration-white [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] dark:[&_code]:bg-slate-800 [&_li]:pl-1 [&_li]:marker:text-slate-400 [&_p]:mt-4 first:[&_p]:mt-0 [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-5 first:[&_ul]:mt-0';

// The site's legal pages, /privacy and /terms (liveworkspace/docs/site.md "Privacy and terms"): one
// of each for liveworkspace and every app in it. A band with the promises at a glance and the apps
// covered, then the text, with its contents alongside: what applies everywhere, then app by app.
export function LegalPage({
  title,
  path,
  updated,
  intro,
  highlights,
  sections,
}: {
  title: string;
  path: string;
  updated: string;
  intro: ReactNode;
  highlights: LegalHighlight[];
  sections: LegalSection[];
}) {
  const apps = listedApps();
  const shared = sections.filter((section) => !section.app);
  const perApp = apps.flatMap((app) => {
    const own = sections.filter((section) => section.app === app.id);
    return own.length ? [{ app, sections: own }] : [];
  });

  return (
    <>
      <Header />
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
          {/* Each app's colour, softly, behind the title. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {apps.map((app, i) => (
              <span
                key={app.id}
                className="absolute size-72 rounded-full opacity-25 blur-3xl dark:opacity-15"
                style={{
                  background: app.accent,
                  top: `${-20 + (i % 2) * 40}%`,
                  right: `${-6 + i * 12}%`,
                }}
              />
            ))}
          </div>
          <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20">
            <nav
              aria-label="Legal"
              className="inline-flex rounded-full border border-slate-200 bg-white/80 p-1 text-sm font-medium shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80"
            >
              {PAGES.map((page) => (
                <a
                  key={page.href}
                  href={page.href}
                  aria-current={page.href === path ? 'page' : undefined}
                  className="rounded-full px-4 py-1.5 text-slate-600 transition-colors duration-micro hover:text-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white dark:text-slate-300 dark:hover:text-white dark:aria-[current=page]:bg-white dark:aria-[current=page]:text-slate-900"
                >
                  {page.label}
                </a>
              ))}
            </nav>
            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
              {title}
            </h1>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Last updated <time>{updated}</time>
            </p>
            <div className={`mt-6 max-w-2xl ${PROSE}`}>{intro}</div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Covers
              </span>
              <Chip>
                <BrandMark accentColor={PLATFORM_SITE.accent} className="size-4" />
                {PLATFORM_SITE.id}
              </Chip>
              {apps.map((app) => (
                <Chip key={app.id} app={app}>
                  <AppMark app={app} className="size-4" />
                  {app.id}
                </Chip>
              ))}
            </div>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {highlights.map((highlight) => (
                <li
                  key={highlight.title}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    {highlight.icon}
                  </span>
                  <p className="mt-4 font-semibold text-slate-900 dark:text-white">
                    {highlight.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {highlight.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16 lg:py-20">
          <aside>
            <details className="group rounded-2xl border border-slate-200 bg-white p-4 lg:hidden dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">
                On this page
              </summary>
              <Contents shared={shared} perApp={perApp} />
            </details>
            <nav
              aria-label="On this page"
              className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block"
            >
              <p className="text-xs font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
                On this page
              </p>
              <Contents shared={shared} perApp={perApp} />
            </nav>
          </aside>

          <div className="max-w-3xl">
            <ol>
              {shared.map((section, i) => (
                <li
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24 border-t border-slate-200 py-10 first:border-t-0 first:pt-0 dark:border-slate-800"
                >
                  <h2 className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    <span className="font-mono text-sm font-medium text-slate-400 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {section.title}
                  </h2>
                  <div className={`mt-5 ${PROSE}`}>{section.body}</div>
                </li>
              ))}
            </ol>

            {perApp.length > 0 && (
              <section
                aria-labelledby="app-by-app"
                className="mt-6 border-t border-slate-200 pt-12 dark:border-slate-800"
              >
                <h2
                  id="app-by-app"
                  className="scroll-mt-24 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  App by app
                </h2>
                <p className="mt-3 text-slate-600 dark:text-slate-400">
                  Everything above applies to every app. This is what only one of them does.
                </p>
                <div className="mt-8 space-y-6">
                  {perApp.map(({ app, sections: own }) => (
                    <article
                      key={app.id}
                      id={app.name}
                      className="scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      style={{ '--lw-ink': app.deep, '--lw-ink-dark': app.accent } as CSSProperties}
                    >
                      <div className="h-1.5" style={{ background: app.accent }} />
                      <div className="p-6 sm:p-8">
                        <h3 className="flex flex-wrap items-center justify-between gap-3">
                          <AppLogo app={app} size="md" />
                          <a
                            href={app.url}
                            className="text-sm font-semibold text-[var(--lw-ink)] no-underline dark:text-[var(--lw-ink-dark)]"
                          >
                            {app.id} →
                          </a>
                        </h3>
                        {own.map((section) => (
                          <div key={section.id} id={section.id} className="mt-6 scroll-mt-24">
                            <h4 className="font-semibold text-slate-900 dark:text-white">
                              {section.title}
                            </h4>
                            <div className={`mt-3 ${PROSE}`}>{section.body}</div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Chip({ app, children }: { app?: ListedApp; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-sm font-medium text-slate-700 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
      style={app ? { borderColor: `${app.accent}55` } : undefined}
    >
      {children}
    </span>
  );
}

const CONTENTS_LINK =
  'block rounded-lg px-2 py-1.5 text-slate-600 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

function Contents({
  shared,
  perApp,
}: {
  shared: LegalSection[];
  perApp: { app: ListedApp; sections: LegalSection[] }[];
}) {
  return (
    <div className="mt-3 text-sm">
      <ol className="space-y-0.5">
        {shared.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className={CONTENTS_LINK}>
              {section.title}
            </a>
          </li>
        ))}
      </ol>
      {perApp.length > 0 && (
        <>
          <p className="mt-5 px-2 text-xs font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
            App by app
          </p>
          <ul className="mt-2 space-y-0.5">
            {perApp.map(({ app }) => (
              <li key={app.id}>
                <a href={`#${app.name}`} className={`flex items-center gap-2 ${CONTENTS_LINK}`}>
                  <AppMark app={app} className="size-4" />
                  {app.name}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
