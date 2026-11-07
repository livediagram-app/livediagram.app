'use client';

// One button of the call group (docs/specs/012-collaboration/proximity-audio.md "The microphone"), on the Call dock
// (docs/specs/008-canvas/avatar-mode.md "The Call dock"): Say's tinted strip button (owner, 2026-11-06: "the same
// background as Say"), with a hover card, named beside its glyph on a desktop (CallNames), in one of five tones. On (live) is the solid brand, so a live mic, a camera on or a share reads at a
// glance against the tint; amber warns, rose is muted.
import { createContext, useContext, type ReactNode } from 'react';
import { HoverCard, SOLID_BRAND_DARK_CONTROL } from '@livehuddle/ui';
import { TOOLBAR_TRIGGER_TONE } from '@liveworkspace/workbench/components/palette/PaletteDropdown';
import {
  STRIP_CONTROL_GLYPH,
  STRIP_CONTROL_LABEL,
  STRIP_CONTROL_NAMED,
  STRIP_TINT_BUTTON,
} from '@/components/chrome/toolbar-surface';

export type SegmentTone = 'rest' | 'live' | 'warn' | 'muted' | 'hand';

/** Whether the call group names its buttons: on a desktop, never on a phone (CallDock; owner 2026-11-07). */
export const CallNames = createContext(false);

const TONE: Record<SegmentTone, string> = {
  // Say's own rest tone: the brand tint.
  rest: TOOLBAR_TRIGGER_TONE,
  live: `bg-brand-700 text-white hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`,
  warn: 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25',
  muted:
    'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25',
  hand: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25',
};

export function Segment(props: {
  label: string;
  name: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  tone?: SegmentTone;
  children?: ReactNode;
}) {
  const named = useContext(CallNames);
  return (
    <HoverCard title={props.title} description={props.description}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.label}
        aria-pressed={props.pressed}
        className={`${STRIP_TINT_BUTTON} ${props.onClick ? 'cursor-pointer' : 'cursor-default'} ${
          TONE[props.tone ?? 'rest']
        } disabled:cursor-wait disabled:opacity-60 ${named ? STRIP_CONTROL_NAMED : STRIP_CONTROL_GLYPH}`}
      >
        {/* Under the glyph and the name (the microphone's level meter), which sit over it. */}
        {props.children}
        <span aria-hidden className="relative flex h-[18px] w-[18px] items-center justify-center">
          {props.icon}
        </span>
        {named ? (
          <span aria-hidden className={`relative ${STRIP_CONTROL_LABEL}`}>
            {props.name}
          </span>
        ) : null}
      </button>
    </HoverCard>
  );
}
