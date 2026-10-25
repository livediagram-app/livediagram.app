import { lucideGlyph } from '@livediagram/ui';
import {
  lucideBookOpen,
  lucideChartLine,
  lucideCheck,
  lucideCircleCheck,
  lucideCircleDashed,
  lucideCircleX,
  lucideClock,
  lucideCpu,
  lucideFolder,
  lucideGlobe,
  lucideImage,
  lucideInfo,
  lucideKey,
  lucideMegaphone,
  lucidePenTool,
  lucideRadio,
  lucideRoute,
  lucideSignal,
  lucideSparkles,
  lucideTriangleAlert,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import type { ReactNode } from 'react';
import type { CheckResult, Overall, ServiceState } from '@/lib/status/probe';
import { HISTORY_MAX } from '@/lib/status/probe';
import type { IconName } from '@liveworkspace/status';

// The status page's pieces (liveworkspace/docs/site.md "Status"): every state as an icon and a word, never colour
// alone, the service icons, the strip of this visit's checks and the legend.

const ICONS: Record<IconName, ReturnType<typeof lucideGlyph>> = {
  globe: lucideGlyph(lucideGlobe, 18),
  key: lucideGlyph(lucideKey, 18),
  folder: lucideGlyph(lucideFolder, 18),
  users: lucideGlyph(lucideUsers, 18),
  chart: lucideGlyph(lucideChartLine, 18),
  image: lucideGlyph(lucideImage, 18),
  cpu: lucideGlyph(lucideCpu, 18),
  radio: lucideGlyph(lucideRadio, 18),
  route: lucideGlyph(lucideRoute, 18),
  pen: lucideGlyph(lucidePenTool, 18),
  megaphone: lucideGlyph(lucideMegaphone, 18),
  book: lucideGlyph(lucideBookOpen, 18),
  sparkles: lucideGlyph(lucideSparkles, 18),
};

export function ServiceIcon({ name }: { name: IconName }) {
  const Icon = ICONS[name];
  return <Icon />;
}

type StateLook = {
  word: string;
  // What the state means, for the legend and the badge's title.
  meaning: string;
  icon: ReturnType<typeof lucideGlyph>;
  // The badge: tinted ground, ink and ring, light and dark.
  badge: string;
  // A solid swatch for the strip and dots.
  swatch: string;
};

export const STATE_LOOK: Record<ServiceState, StateLook> = {
  up: {
    word: 'Operational',
    meaning: 'Answered as it should, in good time.',
    icon: lucideGlyph(lucideCircleCheck, 14),
    badge:
      'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25',
    swatch: 'bg-emerald-500 dark:bg-emerald-400',
  },
  reached: {
    word: 'Reached',
    meaning:
      'Another site answered. Browsers keep its reply private, so this says it is there, not what it said.',
    icon: lucideGlyph(lucideSignal, 14),
    badge:
      'bg-teal-50 text-teal-800 ring-teal-600/20 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/25',
    swatch: 'bg-teal-500 dark:bg-teal-400',
  },
  slow: {
    word: 'Slow',
    meaning: 'Answered, but took more than 1.5 seconds.',
    icon: lucideGlyph(lucideClock, 14),
    badge:
      'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25',
    swatch: 'bg-amber-500 dark:bg-amber-400',
  },
  down: {
    word: 'Down',
    meaning: 'No answer in 10 seconds, or an answer it shouldn’t give.',
    icon: lucideGlyph(lucideCircleX, 14),
    badge:
      'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/25',
    swatch: 'bg-rose-500 dark:bg-rose-400',
  },
  checking: {
    word: 'Checking',
    meaning: 'The first check is on its way.',
    icon: lucideGlyph(lucideCircleDashed, 14),
    badge:
      'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
    swatch: 'bg-slate-300 dark:bg-slate-600',
  },
  skipped: {
    word: 'Not checked',
    meaning: 'Not checked from this address; the row says why.',
    icon: lucideGlyph(lucideInfo, 14),
    badge:
      'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
    swatch: 'bg-slate-300 dark:bg-slate-600',
  },
};

export function StateBadge({
  state,
  size = 'md',
  word,
}: {
  state: ServiceState;
  size?: 'sm' | 'md';
  // Words in place of the state's own (a group's "2 of 7 slow").
  word?: string;
}) {
  const look = STATE_LOOK[state];
  const Icon = look.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset ${look.badge} ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
    >
      <span className={state === 'checking' ? 'lw-status-spin inline-flex' : 'inline-flex'}>
        <Icon />
      </span>
      {word ?? look.word}
    </span>
  );
}

type OverallLook = { icon: ReturnType<typeof lucideGlyph>; orb: string; glow: string; ink: string };

export const OVERALL_LOOK: Record<Overall, OverallLook> = {
  checking: {
    icon: lucideGlyph(lucideCircleDashed, 36),
    orb: 'bg-slate-500 dark:bg-slate-500',
    glow: 'rgb(100 116 139 / 0.18)',
    ink: 'text-slate-600 dark:text-slate-300',
  },
  operational: {
    icon: lucideGlyph(lucideCheck, 36),
    orb: 'bg-emerald-500 dark:bg-emerald-500',
    glow: 'rgb(16 185 129 / 0.22)',
    ink: 'text-emerald-700 dark:text-emerald-300',
  },
  slow: {
    icon: lucideGlyph(lucideClock, 36),
    orb: 'bg-amber-500 dark:bg-amber-500',
    glow: 'rgb(245 158 11 / 0.22)',
    ink: 'text-amber-700 dark:text-amber-300',
  },
  outage: {
    icon: lucideGlyph(lucideTriangleAlert, 36),
    orb: 'bg-orange-500 dark:bg-orange-500',
    glow: 'rgb(249 115 22 / 0.22)',
    ink: 'text-orange-700 dark:text-orange-300',
  },
  major: {
    icon: lucideGlyph(lucideCircleX, 36),
    orb: 'bg-rose-500 dark:bg-rose-500',
    glow: 'rgb(244 63 94 / 0.24)',
    ink: 'text-rose-700 dark:text-rose-300',
  },
};

/** "84 ms", "1.6 s". */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/** "just now", "12 s ago", "3 min ago". */
export function formatAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

// The checks made since the page was opened, oldest first, as a row of slots: the empty ones still to come. The
// strip is a picture of the row's words, so assistive tech hears the summary instead.
export function HistoryStrip({ history }: { history: readonly CheckResult[] }) {
  const answered = history.filter((h) => h.state !== 'down').length;
  const empty = Math.max(0, HISTORY_MAX - history.length);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="sr-only">
        {history.length === 0
          ? 'No checks yet.'
          : `${answered} of ${history.length} checks answered since you opened this page.`}
      </span>
      <span aria-hidden className="flex h-5 min-w-0 flex-1 items-end gap-[2px] overflow-hidden">
        {Array.from({ length: empty }, (_, i) => (
          <span
            key={`e${i}`}
            className="h-1.5 min-w-[3px] flex-1 rounded-full bg-slate-200/80 dark:bg-slate-800"
          />
        ))}
        {history.map((h) => (
          <span
            key={h.at}
            className={`lw-status-bar min-w-[3px] flex-1 rounded-full ${STATE_LOOK[h.state].swatch} ${h.state === 'down' ? 'h-2.5' : h.state === 'slow' ? 'h-4' : 'h-5'}`}
          />
        ))}
      </span>
    </div>
  );
}

const LEGEND: ServiceState[] = ['up', 'reached', 'slow', 'down', 'checking', 'skipped'];

export function Legend({ children }: { children?: ReactNode }) {
  return (
    <section
      aria-labelledby="status-legend"
      className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="status-legend"
        className="text-base font-semibold tracking-tight text-slate-900 dark:text-white"
      >
        How to read this page
      </h2>
      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEGEND.map((state) => (
          <div key={state} className="flex flex-col items-start gap-1.5">
            <dt>
              <StateBadge state={state} />
            </dt>
            <dd className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {STATE_LOOK[state].meaning}
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}
