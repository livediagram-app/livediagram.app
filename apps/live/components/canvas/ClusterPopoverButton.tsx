'use client';

import type { ReactNode } from 'react';
import { HoverCard } from '@livediagram/ui';
import { CLUSTER_STRIP, CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';
import { useDockNames } from '@/hooks/ui/useDockNames';

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
  // Its name beside its icon on a wide desktop (useDockNames); narrower, the icon alone. Absent,
  // the button is its icon on every screen.
  name?: string;
  // A count for the button (the Trash's): beside its name when named, else tucked into its corner (the
  // strip clips anything outside it), where it would otherwise sit over the name.
  badge?: ReactNode;
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
      className={CLUSTER_STRIP}
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
  name,
  badge,
}: SegmentProps) {
  const named = useDockNames() && !!name;
  const button = (
    <button
      ref={buttonRef}
      type="button"
      data-tour-id={dataTourId}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => onTogglePopover(e.currentTarget)}
      aria-label={label}
      aria-expanded={popoverOpen}
      className={`relative flex h-11 items-center justify-center transition ${
        named ? 'gap-2 px-3.5 text-sm font-medium' : 'w-11'
      } ${divided ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${
        popoverOpen
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : CLUSTER_CONTROL_REST
      }`}
    >
      {icon}
      {named ? <span aria-hidden>{name}</span> : null}
      {badge ? (
        <span
          aria-hidden
          className={
            named ? 'pointer-events-none flex' : 'pointer-events-none absolute right-0.5 top-0.5'
          }
        >
          {badge}
        </span>
      ) : null}
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
