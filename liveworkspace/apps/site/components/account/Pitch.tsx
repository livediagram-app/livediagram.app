import { APP_SITES } from '@liveworkspace/sites';
import type { IconPrim } from '@livediagram/icons';
import { lucideLayoutGrid, lucideMail, lucideUsers } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import type { ReactNode } from 'react';

export const APP_NAMES = APP_SITES.map((site) => site.name).join(', ');

const TONES = {
  emerald: {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400',
    lead: 'text-emerald-700 dark:text-emerald-400',
  },
  violet: {
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-400',
    lead: 'text-violet-700 dark:text-violet-400',
  },
  sky: {
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400',
    lead: 'text-sky-700 dark:text-sky-400',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400',
    lead: 'text-amber-700 dark:text-amber-400',
  },
};

// No Lucide monitor is vendored, so the screen is drawn here on the same 24-unit grid.
const SCREEN: readonly IconPrim[] = [
  { t: 'rect', x: 3, y: 4, w: 18, h: 12, rx: 2 },
  { t: 'path', d: 'M8 20h8M12 16v4' },
];

const AppsIcon = lucideGlyph(lucideLayoutGrid, 20);
const DeviceIcon = lucideGlyph(SCREEN, 20);
const TeamIcon = lucideGlyph(lucideUsers, 20);
const MailIcon = lucideGlyph(lucideMail, 20);

const ROWS: {
  tone: keyof typeof TONES;
  icon: ReactNode;
  lead: string;
  title: string;
  line: string;
  withGoogle?: string;
}[] = [
  {
    tone: 'emerald',
    icon: <AppsIcon />,
    lead: 'Every app',
    title: 'One sign-in',
    line: `The same account works in ${APP_NAMES} and the rest of liveworkspace.`,
  },
  {
    tone: 'violet',
    icon: <DeviceIcon />,
    lead: 'Every device',
    title: 'Your work follows you',
    line: 'Start on a laptop, pick up on a phone.',
  },
  {
    tone: 'sky',
    icon: <TeamIcon />,
    lead: 'Teams',
    title: 'Work with your people',
    line: 'Share a workspace with the people you work with.',
  },
  {
    tone: 'amber',
    icon: <MailIcon />,
    lead: 'No password',
    title: 'A code by email',
    line: 'Nothing to remember: we send a code each time you sign in.',
    withGoogle: 'Nothing to remember: continue with Google, or we email you a code.',
  },
];

// Beside the card: what a liveworkspace account adds.
export function Pitch({ google }: { google: boolean }) {
  return (
    <section className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:gap-6">
      <p className="text-xs font-semibold tracking-[.18em] text-slate-700 uppercase sm:text-sm dark:text-slate-300">
        Your liveworkspace account
      </p>
      <h2 className="text-2xl leading-tight font-semibold tracking-tight text-indigo-950 sm:text-4xl lg:text-6xl lg:leading-[1.02] lg:tracking-[-.03em] dark:text-slate-100">
        One account for every live app.
      </h2>
      <ul className="mt-1 flex flex-col gap-2 lg:gap-3">
        {ROWS.map((row, i) => (
          <li
            key={row.lead}
            style={{ animationDelay: `${i * 60}ms` }}
            className="flex animate-[row-in_360ms_cubic-bezier(.34,1.4,.64,1)_both] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 motion-reduce:animate-none lg:gap-4 lg:rounded-2xl lg:px-4.5 lg:py-4 dark:border-slate-700/70 dark:bg-slate-800/80"
          >
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg lg:size-10 ${TONES[row.tone].chip}`}
            >
              {row.icon}
            </span>
            <span>
              <span className={`text-base font-semibold lg:text-xl ${TONES[row.tone].lead}`}>
                {row.lead}
              </span>{' '}
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {row.title}
              </span>
              <span className="block text-sm text-slate-600 dark:text-slate-400">
                {(google && row.withGoogle) || row.line}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
