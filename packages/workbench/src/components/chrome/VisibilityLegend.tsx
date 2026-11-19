'use client';

// The visibility pill's legend (each editor's docs/specs/006-<kind>/offline-mode.md "The visibility legend"): who can see
// this item. A hero in the current state's tone draws its reach as rings around you, lit out to how far
// the item goes; under it the audiences sit on one scale from Offline to Everyone (Offline first, the
// narrowest: owner 2026-11-19, it used to stand apart below and read as unrelated), the current stop filled to, and
// hovering a stop shows that audience in the hero; then, for someone who may share, Change Who Can See This opens
// Share. An item can be several at once (Team and Shared, Shared and Public: owner 2026-11-19): every stop that applies
// is filled in its own hue, the track runs to the widest, and the hero names them together. For the eye only:
// the pill carries the current state's words for assistive technology and opens Share itself.
import { useState, type ReactNode } from 'react';
import { ChevronRightIcon, lucideGlyph, SOLID_BRAND_DARK_CONTROL } from '@liveworkspace/ui';
import { lucideGlobe, lucideLink, lucideLock, lucideUsers } from '@liveworkspace/icons/lucide';
import { ThisBrowserIcon } from '../primitives/ThisBrowserPill';
import {
  SHARE_LADDER,
  SHARE_STATE_META,
  shareStatesLabel,
  widestShareState,
  type ShareState,
  type VisibilityActions,
} from './share-states';
import { VISIBILITY_TONE } from '@liveworkspace/explorer/visibility-tones';

const LockGlyph = lucideGlyph(lucideLock, 14);
const LinkGlyph = lucideGlyph(lucideLink, 14);
const TeamGlyph = lucideGlyph(lucideUsers, 14);
const GlobeGlyph = lucideGlyph(lucideGlobe, 14);

// Each state's look: its glyph, its stop on the scale, the hero's wash, and its ink for the rings.
const LOOK: Record<
  ShareState,
  { icon: ReactNode; reach: string; stop: string; hero: string; ink: string; eyebrow: string }
> = {
  private: {
    icon: <LockGlyph />,
    reach: 'Private',
    stop: VISIBILITY_TONE.private.solid,
    hero: VISIBILITY_TONE.private.wash,
    ink: VISIBILITY_TONE.private.ink,
    eyebrow: VISIBILITY_TONE.private.ink,
  },
  shared: {
    icon: <LinkGlyph />,
    reach: 'Shared',
    stop: VISIBILITY_TONE.shared.solid,
    hero: VISIBILITY_TONE.shared.wash,
    ink: VISIBILITY_TONE.shared.ink,
    eyebrow: VISIBILITY_TONE.shared.ink,
  },
  team: {
    icon: <TeamGlyph />,
    reach: 'Team',
    stop: VISIBILITY_TONE.team.solid,
    hero: VISIBILITY_TONE.team.wash,
    ink: VISIBILITY_TONE.team.ink,
    eyebrow: VISIBILITY_TONE.team.ink,
  },
  community: {
    icon: <GlobeGlyph />,
    reach: 'Everyone',
    stop: VISIBILITY_TONE.public.solid,
    hero: VISIBILITY_TONE.public.wash,
    ink: VISIBILITY_TONE.public.ink,
    eyebrow: VISIBILITY_TONE.public.ink,
  },
  offline: {
    icon: <ThisBrowserIcon size={14} />,
    reach: 'Offline',
    stop: VISIBILITY_TONE.browser.solid,
    hero: VISIBILITY_TONE.browser.wash,
    ink: VISIBILITY_TONE.browser.ink,
    eyebrow: VISIBILITY_TONE.browser.ink,
  },
};

// The reach picture: you at the centre and a ring per wider audience, lit out to the state's own. Offline
// has no reach past you: the browser window holds you, the rings all dark.
function ReachRings({ state }: { state: ShareState }) {
  // Offline and Private both stop at you: rings light from Link outwards.
  const lit = Math.max(0, SHARE_LADDER.indexOf(state) - 1);
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

// What the hero shows: one audience (the item's own, or a hovered stop's), or every one that applies together.
type HeroShown = ShareState | 'all';

function Hero({ shown, states }: { shown: HeroShown; states: readonly ShareState[] }) {
  // The combination's wash and rings are the widest's: how far the item reaches.
  const state = shown === 'all' ? widestShareState(states) : shown;
  const look = LOOK[state];
  const combined = states.length > 1;
  return (
    <div
      data-legend-hero={shown}
      className={`flex items-center gap-3 rounded-t-xl bg-gradient-to-b px-4 pb-3 pt-4 transition-colors duration-short ${look.hero}`}
    >
      <ReachRings state={state} />
      {/* Every state's words share one grid cell, only the shown one visible, so the hero keeps the tallest's
          height and the popover never changes size as the stops are hovered; each is centred in it, so a shorter
          one sits level with the rings rather than at the top. */}
      <div className="grid min-w-0 flex-1">
        {HERO_STATES.map((s) => (
          <HeroText key={s} state={s} current={states.includes(s)} shown={s === shown} />
        ))}
        {combined ? <HeroTogether states={states} shown={shown === 'all'} /> : null}
      </div>
    </div>
  );
}

const HERO_STATES: readonly ShareState[] = SHARE_LADDER;

function HeroText({
  state,
  current,
  shown,
}: {
  state: ShareState;
  current: boolean;
  shown: boolean;
}) {
  const m = SHARE_STATE_META[state];
  const look = LOOK[state];
  return (
    <div
      className={`min-w-0 self-center [grid-area:1/1] ${shown ? '' : 'invisible'}`}
      aria-hidden={shown ? undefined : true}
    >
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
  );
}

// Every audience that applies, named together: each glyph in its hue, then one line per audience in its hue's dot.
function HeroTogether({ states, shown }: { states: readonly ShareState[]; shown: boolean }) {
  const widest = LOOK[widestShareState(states)];
  return (
    <div
      data-legend-together=""
      className={`min-w-0 self-center [grid-area:1/1] ${shown ? '' : 'invisible'}`}
      aria-hidden={shown ? undefined : true}
    >
      <p className={`text-[10.5px] font-semibold uppercase tracking-wide ${widest.eyebrow}`}>
        Who Can See This
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-base font-semibold leading-tight text-slate-900 dark:text-slate-50">
        <span className="flex items-center gap-0.5">
          {states.map((s) => (
            <span key={s} className={LOOK[s].ink}>
              {LOOK[s].icon}
            </span>
          ))}
        </span>
        {shareStatesLabel(states)}
      </p>
      <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-slate-600 dark:text-slate-300">
        {states.map((s) => (
          <li key={s} className="flex gap-1.5">
            <span
              aria-hidden
              className={`mt-[5px] size-1.5 shrink-0 rounded-full bg-current ${LOOK[s].ink}`}
            />
            {SHARE_STATE_META[s].description}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The audiences on one scale, the track filled up to the widest that applies, every one that applies marked.
function ReachScale({
  states,
  peek,
  onPeek,
  actions,
}: {
  states: readonly ShareState[];
  // Pressing a stop moves the item to that audience (VisibilityActions); a stop without one is for reading.
  actions?: VisibilityActions | undefined;
  peek: ShareState | null;
  onPeek: (state: ShareState | null) => void;
}) {
  const at = SHARE_LADDER.indexOf(widestShareState(states));
  const fill = at <= 0 ? 0 : (at / (SHARE_LADDER.length - 1)) * 100;
  return (
    <div className="px-4 pb-1 pt-3">
      <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        From Offline to Everyone
      </p>
      <div className="relative">
        {/* The track runs between the first and last stops' centres. */}
        <span className="absolute left-[10%] right-[10%] top-[13px] h-1 rounded-full bg-slate-100 dark:bg-slate-800">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-slate-400 via-emerald-400 via-blue-400 to-pink-400 dark:from-slate-500 dark:via-emerald-500 dark:via-blue-500 dark:to-pink-500"
            style={{ width: `${fill}%` }}
          />
        </span>
        <ol className="relative grid grid-cols-5" onMouseLeave={() => onPeek(null)}>
          {SHARE_LADDER.map((s, i) => {
            const on = states.includes(s);
            const reached = at >= 0 && i <= at;
            const peeked = s === peek && !on;
            return (
              <li
                key={s}
                data-current={on ? '' : undefined}
                onMouseEnter={() => onPeek(s)}
                onClick={!on ? actions?.[s] : undefined}
                data-stop-action={!on && actions?.[s] ? '' : undefined}
                className={`group flex flex-col items-center gap-1.5 ${
                  !on && actions?.[s] ? 'cursor-pointer' : 'cursor-default'
                }`}
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
                  className={`text-center text-[11px] leading-tight ${
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

export function VisibilityLegend({
  current,
  states: statesIn,
  onManage,
  actions,
  align = 'center',
}: {
  // The leading state (shareStateOf).
  current: ShareState;
  // Every state that applies, in ladder order (shareStatesOf); the leading state alone when absent.
  states?: readonly ShareState[] | undefined;
  // Centred under the pill (the header), or laid out by a host that places it (`floating`: the Explorer's card portals
  // it over the panel, whose scroll would clip it).
  align?: 'center' | 'floating';
  // Opens Share; absent where the reader may not change who can see the item.
  onManage?: () => void;
  // Pressing the Offline stop takes the item offline (owner 2026-11-19), through the app's Take Offline confirm.
  actions?: VisibilityActions;
}) {
  // A hovered stop shows its audience in the hero; leaving puts the current state back.
  const [peek, setPeek] = useState<ShareState | null>(null);
  const states = statesIn?.length ? statesIn : [current];
  const shown: HeroShown = peek ?? (states.length > 1 ? 'all' : states[0]!);
  return (
    // The top padding bridges the gap to the pill, so the pointer can cross into the legend.
    <div
      aria-hidden
      data-visibility-legend=""
      className={`w-[24rem] max-w-[calc(100vw-2rem)] pt-2 text-left ${
        align === 'floating' ? '' : 'absolute top-full z-10 left-1/2 -translate-x-1/2'
      }`}
    >
      <div className="animate-dialog-in overflow-hidden rounded-xl border border-slate-200 bg-white pb-3 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50">
        <Hero shown={shown} states={states} />
        <ReachScale states={states} peek={peek} onPeek={setPeek} actions={actions} />
        {onManage ? (
          <div className="px-3 pt-3">
            <button
              type="button"
              tabIndex={-1}
              onClick={onManage}
              className={`group flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
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
