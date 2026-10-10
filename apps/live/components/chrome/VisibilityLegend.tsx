'use client';

// The visibility pill's legend (docs/specs/006-document/offline-mode.md "The visibility legend"): who can see
// this document. A hero in the current state's tone draws its reach as rings around you, lit out to how far
// the document goes; under it the audiences sit on one scale from Just You to Everyone, the current stop
// filled to, and hovering a stop shows that audience in the hero. Local only stands apart below, the
// deliberate opt-out; then, for someone who may share, Change Who Can See This opens Share. For the eye only:
// the pill carries the current state's words for assistive technology and opens Share itself.
import { useState, type ReactNode } from 'react';
import { ChevronRightIcon, lucideGlyph, SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import { lucideGlobe, lucideLink, lucideLock, lucideUsers } from '@livediagram/icons/lucide';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import { SHARE_STATE_META, type ShareState } from './share-states';

const LockGlyph = lucideGlyph(lucideLock, 14);
const LinkGlyph = lucideGlyph(lucideLink, 14);
const TeamGlyph = lucideGlyph(lucideUsers, 14);
const GlobeGlyph = lucideGlyph(lucideGlobe, 14);

// The audiences from narrowest to widest; Local only is the opt-out beside them.
export const LADDER: readonly ShareState[] = ['private', 'shared', 'team', 'community'];

// Each state's look: its glyph, its stop on the scale, the hero's wash, and its ink for the rings.
const LOOK: Record<
  ShareState,
  { icon: ReactNode; reach: string; stop: string; hero: string; ink: string; eyebrow: string }
> = {
  private: {
    icon: <LockGlyph />,
    reach: 'Just you',
    stop: 'bg-slate-600 text-white ring-slate-200 dark:bg-slate-300 dark:text-slate-900 dark:ring-slate-600',
    hero: 'from-slate-100 to-white dark:from-slate-800 dark:to-slate-900',
    ink: 'text-slate-500 dark:text-slate-300',
    eyebrow: 'text-slate-500 dark:text-slate-400',
  },
  shared: {
    icon: <LinkGlyph />,
    reach: 'Link',
    stop: 'bg-emerald-600 text-white ring-emerald-200 dark:bg-emerald-400 dark:text-emerald-950 dark:ring-emerald-500/40',
    hero: 'from-emerald-50 to-white dark:from-emerald-500/15 dark:to-slate-900',
    ink: 'text-emerald-600 dark:text-emerald-300',
    eyebrow: 'text-emerald-700 dark:text-emerald-300',
  },
  team: {
    icon: <TeamGlyph />,
    reach: 'Team',
    stop: 'bg-brand-600 text-white ring-brand-200 dark:bg-brand-600 dark:ring-brand-500/40',
    hero: 'from-brand-50 to-white dark:from-brand-500/15 dark:to-slate-900',
    ink: 'text-brand-600 dark:text-brand-300',
    eyebrow: 'text-brand-700 dark:text-brand-300',
  },
  community: {
    icon: <GlobeGlyph />,
    reach: 'Everyone',
    stop: 'bg-pink-600 text-white ring-pink-200 dark:bg-pink-400 dark:text-pink-950 dark:ring-pink-500/40',
    hero: 'from-pink-50 to-white dark:from-pink-500/15 dark:to-slate-900',
    ink: 'text-pink-600 dark:text-pink-300',
    eyebrow: 'text-pink-700 dark:text-pink-300',
  },
  offline: {
    icon: <ThisBrowserIcon size={14} />,
    reach: 'This browser',
    stop: 'bg-amber-500 text-white ring-amber-200 dark:bg-amber-400 dark:text-amber-950 dark:ring-amber-500/40',
    hero: 'from-amber-50 to-white dark:from-amber-500/15 dark:to-slate-900',
    ink: 'text-amber-600 dark:text-amber-300',
    eyebrow: 'text-amber-700 dark:text-amber-300',
  },
};

// The reach picture: you at the centre and a ring per wider audience, lit out to the state's own. Local
// only has no reach past you: the browser window holds you, the rings all dark.
function ReachRings({ state }: { state: ShareState }) {
  const lit = LADDER.indexOf(state);
  const look = LOOK[state];
  const radii = [14, 22, 30];
  return (
    <svg viewBox="0 0 72 72" aria-hidden className={`h-[72px] w-[72px] shrink-0 ${look.ink}`}>
      {radii.map((r, i) => {
        const on = i < lit;
        return (
          <circle
            key={r}
            cx="36"
            cy="36"
            r={r}
            fill={on ? 'currentColor' : 'none'}
            fillOpacity={on ? 0.08 + (radii.length - i) * 0.03 : 0}
            stroke="currentColor"
            strokeOpacity={on ? 0.55 : 0.18}
            strokeWidth={on ? 1.5 : 1}
            strokeDasharray={on ? undefined : '2 3'}
            className="transition-[fill-opacity,stroke-opacity] duration-short"
          />
        );
      })}
      {/* The audience on the outermost lit ring: a few people dotted round it. */}
      {lit > 0
        ? [0, 1, 2, 3, 4].slice(0, lit + 1).map((n) => {
            const r = radii[lit - 1]!;
            const a = (-60 + n * 72) * (Math.PI / 180);
            return (
              <circle
                key={n}
                cx={36 + r * Math.cos(a)}
                cy={36 + r * Math.sin(a)}
                r="2.6"
                fill="currentColor"
              />
            );
          })
        : null}
      <circle cx="36" cy="36" r="8" fill="currentColor" />
      <circle cx="36" cy="33.5" r="2.4" fill="white" className="dark:fill-slate-900" />
      <path d="M31.8 40.2a4.6 4.6 0 0 1 8.4 0" fill="white" className="dark:fill-slate-900" />
    </svg>
  );
}

function Hero({ state, current }: { state: ShareState; current: boolean }) {
  const m = SHARE_STATE_META[state];
  const look = LOOK[state];
  return (
    <div
      data-legend-hero={state}
      className={`flex items-center gap-3 rounded-t-xl bg-gradient-to-b px-4 pb-3 pt-4 transition-colors duration-short ${look.hero}`}
    >
      <ReachRings state={state} />
      <div className="min-w-0 flex-1">
        <p className={`text-[10.5px] font-semibold uppercase tracking-wide ${look.eyebrow}`}>
          {current ? 'Who Can See This' : 'If It Were'}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-base font-semibold leading-tight text-slate-900 dark:text-slate-50">
          <span className={look.ink}>{look.icon}</span>
          {m.label}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-slate-600 dark:text-slate-300">
          {m.description}
        </p>
      </div>
    </div>
  );
}

// The audiences on one scale, the track filled up to the current stop.
function ReachScale({
  current,
  peek,
  onPeek,
}: {
  current: ShareState;
  peek: ShareState | null;
  onPeek: (state: ShareState | null) => void;
}) {
  const at = LADDER.indexOf(current);
  const fill = at <= 0 ? 0 : (at / (LADDER.length - 1)) * 100;
  return (
    <div className="px-4 pb-1 pt-3">
      <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        From Just You to Everyone
      </p>
      <div className="relative">
        {/* The track runs between the first and last stops' centres. */}
        <span className="absolute left-[12.5%] right-[12.5%] top-[13px] h-1 rounded-full bg-slate-100 dark:bg-slate-800">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-slate-400 via-emerald-400 to-pink-400 dark:from-slate-500 dark:via-emerald-500 dark:to-pink-500"
            style={{ width: `${fill}%` }}
          />
        </span>
        <ol className="relative grid grid-cols-4" onMouseLeave={() => onPeek(null)}>
          {LADDER.map((s, i) => {
            const on = s === current;
            const reached = at >= 0 && i <= at;
            const peeked = s === peek && !on;
            return (
              <li
                key={s}
                data-current={on ? '' : undefined}
                onMouseEnter={() => onPeek(s)}
                className="group flex cursor-default flex-col items-center gap-1.5"
              >
                <span
                  className={`flex items-center justify-center rounded-full transition duration-micro group-hover:scale-110 ${
                    on
                      ? `h-[30px] w-[30px] -mt-0.5 shadow-md ring-4 ${LOOK[s].stop}`
                      : peeked
                        ? `h-[26px] w-[26px] ring-2 ${LOOK[s].stop}`
                        : reached
                          ? 'h-[26px] w-[26px] bg-white text-slate-600 ring-2 ring-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-600'
                          : 'h-[26px] w-[26px] bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700'
                  }`}
                >
                  {LOOK[s].icon}
                </span>
                <span
                  className={`text-[11px] leading-tight ${
                    on
                      ? 'font-semibold text-slate-900 dark:text-slate-50'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {LOOK[s].reach}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// Local only, apart from the scale: the document never leaves this browser.
function LocalOnlyRow({
  current,
  onPeek,
}: {
  current: boolean;
  onPeek: (state: ShareState | null) => void;
}) {
  const m = SHARE_STATE_META.offline;
  return (
    <div
      data-current={current ? '' : undefined}
      onMouseEnter={() => onPeek('offline')}
      onMouseLeave={() => onPeek(null)}
      className={`mx-3 mt-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
        current
          ? 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30'
          : 'bg-slate-50 hover:bg-amber-50/60 dark:bg-slate-800/50 dark:hover:bg-amber-500/10'
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          current
            ? LOOK.offline.stop
            : 'bg-white text-amber-600 ring-1 ring-amber-200 dark:bg-slate-900 dark:text-amber-300 dark:ring-amber-500/30'
        }`}
      >
        {LOOK.offline.icon}
      </span>
      <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {current ? m.label : `Or ${m.label}`}
        </span>
        {': '}
        {current ? 'saved only here, never on our servers.' : 'never leaves this browser.'}
      </span>
    </div>
  );
}

export function VisibilityLegend({
  current,
  onManage,
}: {
  current: ShareState;
  // Opens Share; absent where the reader may not change who can see the document.
  onManage?: () => void;
}) {
  // A hovered stop shows its audience in the hero; leaving puts the current state back.
  const [peek, setPeek] = useState<ShareState | null>(null);
  const shown = peek ?? current;
  return (
    // The top padding bridges the gap to the pill, so the pointer can cross into the legend.
    <div
      aria-hidden
      data-visibility-legend=""
      className="absolute left-1/2 top-full z-10 w-[20rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-2 text-left"
    >
      <div className="animate-dialog-in overflow-hidden rounded-xl border border-slate-200 bg-white pb-3 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50">
        <Hero state={shown} current={shown === current} />
        <ReachScale current={current} peek={peek} onPeek={setPeek} />
        <LocalOnlyRow current={current === 'offline'} onPeek={setPeek} />
        {onManage ? (
          <div className="px-3 pt-3">
            <button
              type="button"
              tabIndex={-1}
              onClick={onManage}
              className={`group flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-600 ${SOLID_BRAND_DARK_CONTROL}`}
            >
              Change Who Can See This
              <span className="transition-transform duration-micro group-hover:translate-x-0.5">
                <ChevronRightIcon size={13} />
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
