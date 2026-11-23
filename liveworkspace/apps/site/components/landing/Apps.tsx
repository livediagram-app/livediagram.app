import { lucideGlyph } from '@livediagram/ui';
import type { BrandApp } from '@liveworkspace/brand';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import { workAddress } from '@liveworkspace/marketing-site/components/BrowserWindow';
import type { ReactNode } from 'react';
import { type AppArt, listedApps } from '@/lib/apps';
import { AppLogo } from './AppLogo';
import { AppWindow, type Person } from './AppWindow';
import { BoardScene } from './BoardScene';
import { DesignScene } from './DesignScene';
import { DiagramScene } from './DiagramScene';
import { DocumentScene } from './DocumentScene';
import { HuddleScene } from './HuddleScene';
import { KnowledgebaseScene } from './KnowledgebaseScene';

const CheckIcon = lucideGlyph(lucideCheck, 16);

// Each app's window: the address it opens at, the work's name and state in the app's bar, who else is there, and
// the drawing of the work.
const ADA: Person = { initials: 'AL', colour: '#0369a1' };
const SAM: Person = { initials: 'SK', colour: '#7c3aed' };
const LENA: Person = { initials: 'LP', colour: '#b45309' };
const KAI: Person = { initials: 'KJ', colour: '#be123c' };
const PRIYA: Person = { initials: 'PN', colour: '#db2777' };
const JO: Person = { initials: 'JB', colour: '#c2410c' };

const SCENES: Record<
  AppArt,
  {
    brand: BrandApp;
    title: string;
    status: string;
    people: Person[];
    scene: ReactNode;
    route: string;
  }
> = {
  diagram: {
    brand: 'livediagram',
    route: 'document',
    title: 'Beta launch',
    status: 'Shared · 3 here',
    people: [ADA, SAM, LENA],
    scene: <DiagramScene />,
  },
  board: {
    brand: 'liveplanner',
    route: 'project',
    title: 'Launch plan',
    status: 'Shared · 4 here',
    people: [SAM, ADA, LENA, KAI],
    scene: <BoardScene />,
  },
  document: {
    brand: 'livedocuments',
    route: 'document',
    title: 'Quarterly review',
    status: 'Shared · 2 here',
    people: [LENA, KAI],
    scene: <DocumentScene />,
  },
  design: {
    brand: 'livedesign',
    route: 'design',
    title: 'Northwind brand',
    status: 'Shared · 2 here',
    people: [KAI, ADA],
    scene: <DesignScene />,
  },
  huddle: {
    brand: 'livehuddle',
    route: 'document',
    title: 'Team Pod',
    status: 'Live · 4 here',
    people: [PRIYA, SAM, JO],
    scene: <HuddleScene />,
  },
  knowledgebase: {
    brand: 'liveknowledge',
    route: 'document',
    title: 'Team Handbook',
    status: 'Shared · 2 here',
    people: [ADA, JO],
    scene: <KnowledgebaseScene />,
  },
};

// The apps (liveworkspace/docs/specs/010-site/site.md "The front door"): one section each, in the shared order,
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
                        <span className="text-optical-line">{app.action}</span>
                        <span aria-hidden className="text-optical-line">
                          →
                        </span>
                      </a>
                    </div>
                  </div>
                  <div className={`order-2 mt-8 lg:mt-0 ${i % 2 ? 'lg:order-1' : 'lg:order-none'}`}>
                    <AppWindow
                      address={workAddress(app.id, scene.route, scene.title)}
                      app={scene.brand}
                      title={scene.title}
                      status={scene.status}
                      people={scene.people}
                      accent={app.deep}
                    >
                      {scene.scene}
                    </AppWindow>
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
