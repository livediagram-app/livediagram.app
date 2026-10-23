import { BrandMark, lucideGlyph } from '@livediagram/ui';
import { lucideCheck } from '@livediagram/icons/lucide';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import type { ReactNode } from 'react';
import { type AppArt, listedApps } from '@/lib/apps';
import { AppLogo } from './AppLogo';
import { AppWindow, BoardScene, DesignScene, DiagramScene, DocumentScene } from './AppWindow';

const CheckIcon = lucideGlyph(lucideCheck, 16);

const SCENES: Record<AppArt, { address: string; scene: ReactNode }> = {
  diagram: { address: 'livediagram.app/d/launch-plan', scene: <DiagramScene /> },
  board: { address: 'liveplanner.app/p/launch', scene: <BoardScene /> },
  document: { address: 'livedocuments.app/d/quarterly-review', scene: <DocumentScene /> },
  design: { address: 'livedesign.app/d/northwind', scene: <DesignScene /> },
};

// The apps (liveworkspace/docs/site.md "The front door"): one section each, in the shared order,
// with its own logo, what it is for, three things it does, a window onto its work, and the way in.
// Each says it signs in with the liveworkspace account: the thread between them.
export function Apps() {
  return (
    <section id="apps" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
          The apps
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          Each app built for one kind of work.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          Use one, or move between them as the work moves on. They look alike, work alike, and know
          who you are.
        </p>

        <div className="mt-14 flex flex-col gap-8 sm:gap-10">
          {listedApps().map((app, i) => {
            const scene = SCENES[app.art];
            return (
              <article
                key={app.id}
                id={app.name}
                className="relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-70 dark:opacity-40"
                  style={{
                    background: `radial-gradient(60% 80% at ${i % 2 ? '0% 100%' : '100% 0%'}, ${app.accent}26, transparent 70%)`,
                  }}
                />
                <div className="relative flex flex-col p-6 sm:p-10 lg:grid lg:grid-cols-[5fr_6fr] lg:items-center lg:gap-14 lg:p-14">
                  {/* Below lg the column dissolves so the window can sit between the summary and the highlights. */}
                  <div className={`contents lg:block ${i % 2 ? 'lg:order-2' : ''}`}>
                    <div className="order-1">
                      <AppLogo app={app} />
                      <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                        {app.tagline}
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                        {app.summary}
                      </p>
                    </div>
                    <ul className="order-3 mt-6 flex flex-col gap-2.5">
                      {app.highlights.map((h) => (
                        <li
                          key={h}
                          className="flex items-center gap-3 font-medium text-slate-800 dark:text-slate-100"
                        >
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: app.deep }}
                          >
                            <CheckIcon />
                          </span>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="order-4 mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                      <a
                        href={app.url}
                        className="relative touch-target-y inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2"
                        style={{ backgroundColor: app.deep, outlineColor: app.deep }}
                      >
                        Open {app.id}
                        <span aria-hidden>→</span>
                      </a>
                      <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <BrandMark accentColor={PLATFORM_SITE.accent} className="size-4 shrink-0" />
                        Signs in with your liveworkspace account
                      </span>
                    </div>
                  </div>
                  <div className={`order-2 mt-8 lg:mt-0 ${i % 2 ? 'lg:order-1' : 'lg:order-none'}`}>
                    <AppWindow address={scene.address}>{scene.scene}</AppWindow>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
