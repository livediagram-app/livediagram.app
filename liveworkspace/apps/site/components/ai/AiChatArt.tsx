import { lucideCircleCheck, lucideSparkles } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
import type { SiteId } from '@liveworkspace/sites';
import type { CSSProperties, ReactNode } from 'react';
import { AppMark } from '@/components/landing/AppLogo';
import { listedApps, type ListedApp } from '@/lib/apps';

const CheckIcon = lucideGlyph(lucideCircleCheck, 14);
const SparklesIcon = lucideGlyph(lucideSparkles, 14);

// The Build with AI hero's picture (liveworkspace/docs/specs/010-site/site.md "Build with AI"): one request across
// apps, the three tool calls it makes (liveplanner, livediagram, livedocuments), each in its app's prism and accent,
// and what each one made, landing in one account. Decorative: one accessible name on the frame, the parts hidden.
// Still, so it needs no motion budget.

type Made = { id: SiteId; tool: string; title: string; art: ReactNode };

const ink = (app: ListedApp) =>
  ({ '--lw-ink': app.deep, '--lw-ink-dark': app.light }) as CSSProperties;

const INK_BG = 'bg-[var(--lw-ink)] dark:bg-[var(--lw-ink-dark)]';

// A board: three columns of cards.
const BoardArt = (
  <span className="flex h-9 gap-1">
    {[3, 2, 1].map((cards, col) => (
      <span
        key={col}
        className="flex flex-1 flex-col gap-0.5 rounded-sm bg-slate-100 p-0.5 dark:bg-slate-800"
      >
        {Array.from({ length: cards }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-[2px] ${INK_BG} opacity-70`} />
        ))}
      </span>
    ))}
  </span>
);

// A sitemap: a root box linked to three below.
const DiagramArt = (
  <svg
    viewBox="0 0 60 36"
    className="h-9 w-full text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]"
  >
    <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.55">
      <path d="M30 10v6M10 16h40M10 16v5M30 16v5M50 16v5" />
    </g>
    <rect x="21" y="2" width="18" height="8" rx="2" fill="currentColor" />
    {[2, 22, 42].map((x) => (
      <rect
        key={x}
        x={x}
        y="21"
        width="16"
        height="8"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    ))}
  </svg>
);

// A deck: a slide with a title bar and lines, a second behind it.
const DeckArt = (
  <span className="relative block h-9">
    <span className="absolute inset-x-2 top-0 bottom-1.5 rounded-sm bg-slate-100 dark:bg-slate-800" />
    <span className="absolute inset-x-0 top-1.5 bottom-0 flex flex-col gap-1 rounded-sm border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
      <span className={`h-1.5 w-3/5 rounded-[2px] ${INK_BG}`} />
      <span className="h-1 w-4/5 rounded-[2px] bg-slate-200 dark:bg-slate-700" />
      <span className="h-1 w-2/3 rounded-[2px] bg-slate-200 dark:bg-slate-700" />
    </span>
  </span>
);

const MADE: Made[] = [
  {
    id: 'liveplanner.app',
    tool: 'liveplanner · create_item',
    title: 'Relaunch tasks',
    art: BoardArt,
  },
  {
    id: 'livediagram.app',
    tool: 'livediagram · create_item',
    title: 'New sitemap',
    art: DiagramArt,
  },
  {
    id: 'livedocuments.app',
    tool: 'livedocuments · create_item',
    title: 'Kickoff deck',
    art: DeckArt,
  },
];

export function AiChatArt() {
  const apps = new Map<SiteId, ListedApp>(listedApps().map((app) => [app.id, app]));
  const made = MADE.flatMap((m) => {
    const app = apps.get(m.id);
    return app ? [{ ...m, app }] : [];
  });
  return (
    <div
      role="img"
      aria-label="An AI chat asks for a project across liveplanner, livediagram and livedocuments, and each app makes its part"
      className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/30"
    >
      <div
        aria-hidden
        className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800"
      >
        <span className="size-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="size-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="size-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Your AI tool
        </span>
      </div>
      <div aria-hidden className="space-y-3 p-4 text-sm">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-slate-800 px-3.5 py-2 text-white dark:bg-slate-200 dark:text-slate-950">
          Set up our website relaunch: the tasks, a sitemap and a kickoff deck.
        </p>
        <ul className="flex flex-col items-start gap-1.5">
          {made.map(({ id, tool, app }) => (
            <li
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-2.5 pl-1.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <AppMark app={app} className="size-4" />
              {tool}
              <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
            </li>
          ))}
        </ul>
        <ul className="grid grid-cols-3 gap-2">
          {made.map(({ id, title, art, app }) => (
            <li
              key={id}
              style={ink(app)}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 border-t-[var(--lw-ink)] border-t-2 bg-slate-50 p-2 dark:border-slate-700 dark:border-t-[var(--lw-ink-dark)] dark:bg-slate-950"
            >
              {art}
              <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {title}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
          <SparklesIcon className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
          <span>Done. All three are in your liveworkspace account, shared with the team.</span>
        </p>
      </div>
    </div>
  );
}
