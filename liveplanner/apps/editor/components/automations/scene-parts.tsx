'use client';

// The parts the living previews are drawn from (docs/specs/026-plan/automations.md: the template tiles' scenes and
// the Add an Action tiles'): mini columns, cards, avatars, pills, the pointer, a bubble. The tones and the moving-part
// helpers (`at`, `after`) the classes in app/automation-scenes.css read are the shared picker's (tile-scene.tsx).
// Decoration only.

import type { CSSProperties, ReactNode } from 'react';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideCalendar,
  lucideCheck,
  lucideFlag,
  lucideLink,
  lucideMail,
  lucideMessageSquare,
  lucidePackage,
  lucideSparkles,
  lucideTriangleAlert,
  lucideZap,
} from '@liveworkspace/icons/lucide';
import { after, type ToneClasses } from '@/components/tile-picker/tile-scene';

// The tiles' tones and moving-part helpers live with the shared picker (tile-scene.tsx), for the form builder's
// gallery too; re-exported here for the scenes.
export {
  PANEL,
  TONES,
  after,
  at,
  type SceneTone,
  type ToneClasses,
} from '@/components/tile-picker/tile-scene';

export const CheckGlyph = lucideGlyph(lucideCheck, 8);
export const FlagGlyph = lucideGlyph(lucideFlag, 9);
export const MailGlyph = lucideGlyph(lucideMail, 11);
export const MessageGlyph = lucideGlyph(lucideMessageSquare, 9);
export const AlertGlyph = lucideGlyph(lucideTriangleAlert, 8);
export const ZapGlyph = lucideGlyph(lucideZap, 9);
export const ArchiveGlyph = lucideGlyph(lucidePackage, 11);
export const CalendarGlyph = lucideGlyph(lucideCalendar, 8);
export const LinkGlyph = lucideGlyph(lucideLink, 9);
export const SparklesGlyph = lucideGlyph(lucideSparkles, 10);

// One card slot across to the next column: the card's width, the column's padding and border, and the gap.
export const NEXT_COLUMN = 'translateX(calc(100% + 22px))';

export function Column({
  tone,
  label,
  count,
  className = '',
  children,
}: {
  tone: ToneClasses;
  label: string;
  count?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg bg-white/75 p-1.5 ring-1 backdrop-blur-[1px] dark:bg-slate-900/55 ${tone.ring} ${className}`}
    >
      <div className="flex items-center gap-1 px-0.5">
        <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />
        <span
          className={`truncate text-[8.5px] font-semibold uppercase tracking-[0.07em] ${tone.label}`}
        >
          {label}
        </span>
        {count === undefined ? null : (
          <span className="relative ml-auto inline-grid h-3 min-w-3 place-items-center rounded bg-slate-900/[0.05] px-0.5 text-[8px] font-semibold tabular-nums text-slate-500 dark:bg-white/10 dark:text-slate-400">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** A column count that ticks over as the scene plays. */
export function Count({ from, to, d = 420 }: { from: number; to: number; d?: number }) {
  return (
    <>
      <span className="ats-out col-start-1 row-start-1" style={after(d)}>
        {from}
      </span>
      <span className="ats-in col-start-1 row-start-1" style={after(d)}>
        {to}
      </span>
    </>
  );
}

export function Card({
  ghost = false,
  wide = 'w-4/5',
  className = '',
  children,
}: {
  ghost?: boolean;
  wide?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative h-[26px] shrink-0 rounded-md bg-white px-1.5 pt-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.1),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-slate-800 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.06)] ${ghost ? 'opacity-55' : ''} ${className}`}
    >
      <div className={`h-1 rounded-full bg-slate-300 dark:bg-slate-600 ${wide}`} />
      <div className="mt-[5px] h-1 w-2/5 rounded-full bg-slate-200 dark:bg-slate-700" />
      {children}
    </div>
  );
}

export const AVATARS = {
  AL: 'bg-sky-500',
  JR: 'bg-rose-500',
  KP: 'bg-amber-500',
  MS: 'bg-teal-500',
} as const;

export function Avatar({
  who,
  className = '',
  style,
}: {
  who: keyof typeof AVATARS;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`absolute grid size-3.5 place-items-center rounded-full text-[6px] font-bold text-white ring-[1.5px] ring-white dark:ring-slate-800 ${AVATARS[who]} ${className}`}
      style={style}
    >
      <span className="text-optical-centre">{who}</span>
    </span>
  );
}

export function Pill({
  className = '',
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className={`absolute inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1 py-px text-[7.5px] font-bold leading-[11px] shadow-sm ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

/** The pointer that does the moving, with a collaborator's name tag when someone's hand it is. */
export function Cursor({ name, className = '' }: { name?: string; className?: string }) {
  return (
    <span className={`pointer-events-none absolute z-20 flex items-start ${className}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        className="drop-shadow-[0_1px_1px_rgba(15,23,42,0.35)]"
      >
        <path
          d="M2.5 1.5 13 7.2l-4.6 1.2-2 4.4z"
          className="fill-slate-900 stroke-white dark:fill-white dark:stroke-slate-900"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {name ? (
        <span className="-ml-0.5 mt-2.5 rounded bg-sky-500 px-1 text-[7px] font-semibold leading-[11px] text-white shadow-sm">
          {name}
        </span>
      ) : null}
    </span>
  );
}

export function Bubble({
  tone,
  className = '',
  style,
  children,
}: {
  tone: ToneClasses;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className={`absolute grid size-5 place-items-center rounded-md shadow-[0_4px_10px_-3px_rgba(15,23,42,0.4)] ${tone.solid} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

// The pickers' shared pieces: a floating panel, a small chip, the card an action or trigger works on, a column.
export function Chip({
  className = '',
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded px-1 text-[7px] font-bold leading-[11px] ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

/** The card the action works on, at the stage's centre. */
export function Subject({
  children,
  className = 'w-[46%]',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <Card>{children}</Card>
    </div>
  );
}

/** A mini column outline, for the actions that move a card between them. */
export function Lane({ tone, children }: { tone: ToneClasses; children?: ReactNode }) {
  return (
    <div
      className={`relative flex h-[42px] w-[40%] shrink-0 flex-col justify-center rounded-lg bg-white/70 p-1.5 ring-1 dark:bg-slate-900/50 ${tone.ring}`}
    >
      {children}
    </div>
  );
}
