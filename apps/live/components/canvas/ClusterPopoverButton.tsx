'use client';

import type { ReactNode } from 'react';
import { HoverCard } from '@livediagram/ui';

// A bottom-right cluster button that opens a panel as a popover hanging ABOVE it, as the Layers
// button does, and shows pressed while it is open: Slides in Illustrate mode, Card Types in Plan
// mode, each where Layers sits in the other modes. Two or more can share one frame, as Undo and Redo
// do (ClusterStrip of ClusterPopoverSegments): Plan's Find a Card and Card Types.
//
// `data-dock-button` makes a second press close the popover through the toggle rather than the
// panel's outside-click closing it on pointer-down and the click reopening it.

type SegmentProps = {
  label: string;
  hoverTitle: string;
  hoverDescription: string;
  icon: ReactNode;
  popoverOpen: boolean;
  onTogglePopover: (button: HTMLElement) => void;
  // The button itself, for a caller that opens its popover from elsewhere.
  buttonRef?: React.Ref<HTMLButtonElement>;
  // A guided tour's anchor (docs/specs/026-plan/plan-tour.md).
  dataTourId?: string;
  // A segment after the first in a strip: a hairline parts it from the one before.
  divided?: boolean;
};

// The frame a cluster button (or a strip of them) sits in.
export function ClusterStrip({
  children,
  dataTourId,
}: {
  children: ReactNode;
  dataTourId?: string;
}) {
  return (
    <div
      data-dock-button=""
      data-tour-id={dataTourId}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto flex animate-fade-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      {children}
    </div>
  );
}

// One button of a strip.
export function ClusterPopoverSegment({
  label,
  hoverTitle,
  hoverDescription,
  icon,
  popoverOpen,
  onTogglePopover,
  buttonRef,
  dataTourId,
  divided = false,
}: SegmentProps) {
  const button = (
    <button
      ref={buttonRef}
      type="button"
      data-tour-id={dataTourId}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => onTogglePopover(e.currentTarget)}
      aria-label={label}
      aria-expanded={popoverOpen}
      className={`flex h-11 w-11 items-center justify-center transition ${
        divided ? 'border-l border-slate-100 dark:border-slate-800' : ''
      } ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {icon}
    </button>
  );
  // No hover card while open: it would sit over the panel it names.
  return popoverOpen ? (
    button
  ) : (
    <HoverCard title={hoverTitle} description={hoverDescription}>
      {button}
    </HoverCard>
  );
}

// A cluster button on its own: a strip of one.
export function ClusterPopoverButton({ dataTourId, ...props }: Omit<SegmentProps, 'divided'>) {
  return (
    <ClusterStrip dataTourId={dataTourId}>
      <ClusterPopoverSegment {...props} />
    </ClusterStrip>
  );
}
