'use client';

// One segment of the call strip (docs/specs/012-collaboration/proximity-audio.md "The microphone"): an icon button
// with a hover card, named beside its icon when the dock shows names, in one of four tones, parted from the segment
// before it by a hairline when `divided`.
import type { ReactNode } from 'react';
import { HoverCard } from '@livehuddle/ui';
import { CLUSTER_CONTROL_REST } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import { useDockNames } from '@liveworkspace/workbench/hooks/ui/useDockNames';

export type SegmentTone = 'rest' | 'live' | 'warn' | 'muted' | 'hand';

export function Segment(props: {
  label: string;
  name: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  divided?: boolean;
  tone?: SegmentTone;
  children?: ReactNode;
}) {
  const named = useDockNames();
  const tone =
    props.tone === 'live'
      ? 'text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-500/15'
      : props.tone === 'warn'
        ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10'
        : props.tone === 'muted'
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10'
          : props.tone === 'hand'
            ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25'
            : CLUSTER_CONTROL_REST;
  return (
    <HoverCard title={props.title} description={props.description}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.label}
        aria-pressed={props.pressed}
        className={`relative flex h-11 items-center ${props.onClick ? 'cursor-pointer' : 'cursor-default'} justify-center transition disabled:cursor-wait disabled:opacity-60 ${
          named ? 'gap-2 px-3.5 text-sm font-medium' : 'w-11'
        } ${props.divided ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${tone}`}
      >
        {props.children}
        {props.icon}
        {named ? <span aria-hidden>{props.name}</span> : null}
      </button>
    </HoverCard>
  );
}
