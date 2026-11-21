'use client';

// The parts the item pictures are drawn from, beside scene-parts.tsx (blueprint item-ui.md "Pictures"): the bolt
// that lights as a trigger fires, a page of text lines, a strip of tabs over its page, a small board of shapes, a
// line that flows from one thing to the next, and the camera. Fixed sizes throughout, so a vignette reads the same
// on a picker's tile and in half of a template's picture. Moved by automation-scenes.css. Decoration only.

import type { CSSProperties, ReactNode } from 'react';
import { ZapGlyph } from '../../scene-parts';
import { PANEL, at, type ToneClasses } from '../../tile-picker/tile-scene';

/** The camera, as History draws it. */
export function CameraGlyph({ size = 14, ...rest }: { size?: number; 'aria-hidden'?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

/** The bolt that lights as the trigger fires. */
export function Fire({
  tone,
  d,
  className = '-right-1.5 -top-2',
}: {
  tone: ToneClasses;
  d: number;
  className?: string;
}) {
  return (
    <span
      className={`ats-t ats-in ats-pop absolute z-10 grid size-4 place-items-center rounded-md shadow-[0_4px_10px_-3px_rgba(15,23,42,0.4)] ${tone.solid} ${className}`}
      style={at('none', 'scale(0.3) rotate(-25deg)', d)}
    >
      <ZapGlyph aria-hidden />
    </span>
  );
}

const LINE = 'h-[3px] rounded-full';
export const INK = `${LINE} bg-slate-300 dark:bg-slate-600`;
export const INK_SOFT = `${LINE} bg-slate-200 dark:bg-slate-700`;

/** A page: a white sheet with a heading line and text lines, and whatever the scene puts on it. */
export function Page({
  className = 'h-[44px] w-[52px]',
  lines = 3,
  children,
}: {
  className?: string;
  lines?: number;
  children?: ReactNode;
}) {
  const widths = ['w-full', 'w-4/5', 'w-3/5'];
  return (
    <div className={`relative flex shrink-0 flex-col gap-[4px] p-1.5 ${PANEL} ${className}`}>
      <span className={`w-1/2 ${INK}`} />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <span key={i} className={`${widths[i % widths.length]} ${INK_SOFT}`} />
      ))}
      {children}
    </div>
  );
}

const TAB =
  'flex h-[10px] w-[22px] shrink-0 items-center rounded-t-[4px] px-[4px] shadow-[0_0_0_1px_rgba(15,23,42,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]';

/** One tab of a strip: the open one white, the rest set back (`surface`: its own colour instead). */
export function Tab({
  open = false,
  surface,
  className = '',
  style,
  children,
}: {
  open?: boolean;
  surface?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const paint =
    surface ?? (open ? 'bg-white dark:bg-slate-800' : 'bg-white/60 dark:bg-slate-800/50');
  return (
    <span className={`${TAB} ${paint} ${className}`} style={style}>
      {children ?? <span className={`w-full ${open ? INK : INK_SOFT}`} />}
    </span>
  );
}

/** An item's tabs over the open tab's page: `tabs` are the strip, `children` what stands on the page. */
export function TabStrip({
  tabs,
  className = 'w-[92px]',
  children,
}: {
  tabs: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative flex shrink-0 flex-col ${className}`}>
      <div className="flex items-end gap-[3px] pl-1.5">{tabs}</div>
      <div className={`relative flex h-[30px] flex-col gap-[4px] p-1.5 ${PANEL}`}>
        <span className={`w-2/5 ${INK}`} />
        <span className={`w-4/5 ${INK_SOFT}`} />
        {children}
      </div>
    </div>
  );
}

/** A small board of shapes, each resting where `rest` puts it and playing back to its place. */
export function Board({
  tone,
  className = 'h-[44px] w-[60px]',
  rest,
  children,
}: {
  tone: ToneClasses;
  className?: string;
  // Where each of the three shapes rests (a transform); none: in its place.
  rest?: readonly [string, string, string];
  children?: ReactNode;
}) {
  const shape = (i: 0 | 1 | 2, classes: string) => (
    <span
      className={`absolute rounded-[3px] ${classes} ${rest ? 'ats-t ats-drag' : ''}`}
      style={rest ? at('none', rest[i], 120 + i * 90) : undefined}
    />
  );
  return (
    <div className={`relative shrink-0 ${PANEL} ${className}`}>
      {shape(0, `left-[7px] top-[7px] h-[11px] w-[18px] ${tone.soft}`)}
      {shape(1, 'right-[7px] top-[9px] h-[11px] w-[18px] bg-slate-200 dark:bg-slate-600')}
      {shape(2, 'bottom-[7px] left-[20px] h-[9px] w-[20px] bg-slate-200 dark:bg-slate-600')}
      {children}
    </div>
  );
}

/** A line from one thing to the next, its dashes running as the scene plays. */
export function FlowLine({ tone, className = 'w-6' }: { tone: ToneClasses; className?: string }) {
  return (
    <svg viewBox="0 0 40 12" preserveAspectRatio="none" className={`h-3 shrink-0 ${className}`}>
      <path
        d="M1 6H39"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        fill="none"
      />
      <path d="M1 6H39" className={`ats-in ats-flow ${tone.line}`} strokeWidth="1.8" fill="none" />
    </svg>
  );
}

/** A square white tile holding one glyph in the tone's ink. */
export function GlyphTile({
  tone,
  className = 'size-9',
  round = false,
  children,
}: {
  tone: ToneClasses;
  className?: string;
  round?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative grid shrink-0 place-items-center ${PANEL} ${round ? 'rounded-full' : ''} ${className}`}
    >
      <span className={tone.label}>{children}</span>
    </div>
  );
}

/** A comment's bubble: who, and a line of what they said. It floats over a page, or sits `inline` in a row. */
export function CommentBubble({
  inline = false,
  className = '',
  style,
  who = 'bg-rose-500',
  children,
}: {
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
  who?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={`${inline ? 'relative' : 'absolute rounded-bl-none'} z-10 flex items-center gap-0.5 rounded-md bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700 ${className}`}
      style={style}
    >
      <span className={`size-2.5 shrink-0 rounded-full ${who}`} />
      <span className="h-[3px] w-7 rounded-full bg-slate-300 dark:bg-slate-500" />
      {children}
    </span>
  );
}
