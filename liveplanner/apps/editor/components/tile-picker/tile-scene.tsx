// What a gallery picker's tile pictures are drawn on (TilePicker: Add an Action, Pick a Trigger, Add a Question):
// the stage, a tone's wash with dots fading in from the left, each tone's classes, the white panel a scene's piece
// sits on, and the moving-part helpers (`at`, `after`) the classes in app/automation-scenes.css read. A tile's
// `data-picker-tile` plays its scene on hover or focus. Decoration only.

import type { CSSProperties, ReactNode } from 'react';

export type SceneTone = 'emerald' | 'blue' | 'red' | 'orange' | 'violet';

export type ToneClasses = {
  wash: string;
  dots: string;
  ring: string;
  label: string;
  dot: string;
  solid: string;
  soft: string;
  line: string;
  // An answer box's edge as it is answered (Add a Question).
  border: string;
};

// Written out whole, so Tailwind sees every class.
export const TONES: Readonly<Record<SceneTone, ToneClasses>> = {
  emerald: {
    wash: 'from-emerald-50 via-emerald-50/50 to-white dark:from-emerald-500/[0.16] dark:via-emerald-500/[0.06] dark:to-slate-900',
    dots: 'text-emerald-900/[0.09] dark:text-emerald-300/[0.12]',
    ring: 'ring-emerald-900/[0.07] dark:ring-emerald-300/15',
    label: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-600 text-white dark:bg-emerald-500',
    soft: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-100',
    line: 'stroke-emerald-500',
    border: 'border-emerald-400 dark:border-emerald-400/70',
  },
  blue: {
    wash: 'from-blue-50 via-blue-50/50 to-white dark:from-blue-500/[0.16] dark:via-blue-500/[0.06] dark:to-slate-900',
    dots: 'text-blue-900/[0.09] dark:text-blue-300/[0.12]',
    ring: 'ring-blue-900/[0.07] dark:ring-blue-300/15',
    label: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    solid: 'bg-blue-600 text-white dark:bg-blue-500',
    soft: 'bg-blue-100 text-blue-800 dark:bg-blue-500/25 dark:text-blue-100',
    line: 'stroke-blue-500',
    border: 'border-blue-400 dark:border-blue-400/70',
  },
  red: {
    wash: 'from-red-50 via-red-50/50 to-white dark:from-red-500/[0.16] dark:via-red-500/[0.06] dark:to-slate-900',
    dots: 'text-red-900/[0.08] dark:text-red-300/[0.12]',
    ring: 'ring-red-900/[0.07] dark:ring-red-300/15',
    label: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    solid: 'bg-red-600 text-white dark:bg-red-500',
    soft: 'bg-red-100 text-red-800 dark:bg-red-500/25 dark:text-red-100',
    line: 'stroke-red-500',
    border: 'border-red-400 dark:border-red-400/70',
  },
  orange: {
    wash: 'from-orange-50 via-orange-50/50 to-white dark:from-orange-500/[0.16] dark:via-orange-500/[0.06] dark:to-slate-900',
    dots: 'text-orange-900/[0.09] dark:text-orange-300/[0.12]',
    ring: 'ring-orange-900/[0.07] dark:ring-orange-300/15',
    label: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
    solid: 'bg-orange-500 text-white',
    soft: 'bg-orange-100 text-orange-800 dark:bg-orange-500/25 dark:text-orange-100',
    line: 'stroke-orange-500',
    border: 'border-orange-400 dark:border-orange-400/70',
  },
  violet: {
    wash: 'from-brand-50 via-brand-50/50 to-white dark:from-brand-500/[0.18] dark:via-brand-500/[0.06] dark:to-slate-900',
    dots: 'text-brand-900/[0.09] dark:text-brand-300/[0.12]',
    ring: 'ring-brand-900/[0.07] dark:ring-brand-300/15',
    label: 'text-brand-700 dark:text-brand-300',
    dot: 'bg-brand-500',
    solid: 'bg-brand-700 text-white dark:bg-brand-600',
    soft: 'bg-brand-100 text-brand-800 dark:bg-brand-500/25 dark:text-brand-100',
    line: 'stroke-brand-500',
    border: 'border-brand-400 dark:border-brand-400/70',
  },
};

// A moving part: where it rests, where it plays to, and its delay as it plays.
export const at = (p: string, r = 'none', d = 0): CSSProperties =>
  ({ '--ats-r': r, '--ats-p': p, '--ats-d': `${d}ms` }) as CSSProperties;
export const after = (d: number): CSSProperties => ({ '--ats-d': `${d}ms` }) as CSSProperties;

// A scene's white piece: a panel, a field, a calendar.
export const PANEL =
  'rounded-lg bg-white shadow-[0_4px_12px_-6px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]';

const DOTS: CSSProperties = {
  backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.2px)',
  backgroundSize: '10px 10px',
  maskImage: 'linear-gradient(115deg, transparent 25%, #000 95%)',
  WebkitMaskImage: 'linear-gradient(115deg, transparent 25%, #000 95%)',
};

/** The picture at the top of a picker tile: the tone's wash and dots, the scene centred on it. */
export function TileStage({ tone, children }: { tone: ToneClasses; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={`relative flex h-[72px] shrink-0 items-center justify-center gap-2 overflow-hidden border-b border-slate-100 bg-gradient-to-br px-4 dark:border-slate-800 ${tone.wash}`}
    >
      <span className={`pointer-events-none absolute inset-0 ${tone.dots}`} style={DOTS} />
      {children}
    </span>
  );
}
