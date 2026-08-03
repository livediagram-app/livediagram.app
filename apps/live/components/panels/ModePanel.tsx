import type { ReactNode } from 'react';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { MovablePanelPlacementProps } from '@/components/primitives/MovablePanel.types';

// The chrome every MODE panel wears: Avatar, Eraser, Format, Laser, Spotlight.
//
// These five are the panels that exist only while their tool does (spec/111 for
// the Laser, spec/101 for Avatar, and the same shape for the rest). They are
// deliberately identical outside their bodies — same corner, same width as the
// Palette they stack under, same collapse behaviour — because the top-right
// column has to read as one edge rather than five panels that each drifted a
// little.
//
// All five wrote that out by hand: the same twelve props in the same order,
// differing only in `title`. This is the second half of the job
// MovablePanelPlacementProps started; that type stopped nine panels
// re-declaring the placement props, and these five went on re-declaring the
// three that live outside it (`stackBelowY`, `forceDockMode`, `onMobileClose`)
// and re-typing the forwarding block underneath.

/**
 * Everything a mode panel forwards to its MovablePanel. The three beyond
 * MovablePanelPlacementProps are the ones each panel used to re-declare.
 */
export type ModePanelProps = MovablePanelPlacementProps & {
  stackBelowY?: number;
  forceDockMode?: boolean;
  onMobileClose?: () => void;
};

export function ModePanel({
  title,
  children,
  position,
  onMoveTo,
  onReset,
  dock,
  stackBelowY,
  mobileOpenOverride,
  mobileDockAnchor,
  forceDockMode,
  onMobileClose,
}: ModePanelProps & { title: string; children: ReactNode }) {
  return (
    <MovablePanel
      title={title}
      position={position}
      defaultCorner="top-right-stacked"
      // Matches the Palette this stacks under, so the top-right column reads as
      // one edge rather than two.
      width="w-auto sm:w-64"
      onMoveTo={onMoveTo}
      onReset={onReset}
      stackBelowY={stackBelowY}
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
      {...dock}
      collapsible
    >
      {children}
    </MovablePanel>
  );
}
