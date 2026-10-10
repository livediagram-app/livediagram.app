import type { ReactNode } from 'react';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type {
  MovablePanelPlacementProps,
  MovablePanelPopoverProps,
} from '@/components/primitives/MovablePanel.types';
import type { HelpArticleKey } from '@/lib/help-articles';

// The chrome every MODE panel wears: Avatar, Eraser, Format, Laser, Spotlight.
//
// These five are the panels that exist only while their tool does (docs/specs/008-canvas/laser-panel.md for
// the Laser, docs/specs/008-canvas/avatar-mode.md for Avatar, and the same shape for the rest). They are
// deliberately identical outside their bodies — same corner, same width, same
// collapse behaviour — because the top-right
// column has to read as one edge rather than five panels that each drifted a
// little.
//
// All five wrote that out by hand: the same props in the same order,
// differing only in `title`. This is the second half of the job
// MovablePanelPlacementProps started; that type stopped nine panels
// re-declaring the placement props, and these five went on re-typing the
// forwarding block underneath.

/** Everything a mode panel forwards to its MovablePanel. */
export type ModePanelProps = MovablePanelPlacementProps & MovablePanelPopoverProps;

/** Extras a mode panel may put in its header: a settings gear, a help link. */
type ModePanelExtras = {
  headerActions?: ReactNode;
  /** The article explaining this mode (docs/specs/018-help/contextual-help-links.md), shown as `?` in the header. */
  helpArticle?: HelpArticleKey;
};

export function ModePanel({
  title,
  children,
  position,
  onMoveTo,
  onReset,
  dock,
  headerActions,
  helpArticle,
  popoverOpen,
  popoverAnchor,
  asPopover,
  dismissOnOutside,
  onPopoverClose,
}: ModePanelProps & ModePanelExtras & { title: string; children: ReactNode }) {
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
      headerActions={headerActions}
      helpArticle={helpArticle}
      {...dock}
      // As a popover over a cluster button (the Slide Deck in Illustrate mode).
      popoverOpen={popoverOpen}
      popoverAnchor={popoverAnchor}
      asPopover={asPopover}
      dismissOnOutside={dismissOnOutside}
      onPopoverClose={onPopoverClose}
      collapsible
    >
      {children}
    </MovablePanel>
  );
}
