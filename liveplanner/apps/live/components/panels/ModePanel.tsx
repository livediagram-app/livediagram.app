import type { ReactNode } from 'react';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type {
  MovablePanelPlacementProps,
  MovablePanelPopoverProps,
} from '@/components/primitives/MovablePanel.types';
import type { HelpArticleKey } from '@/lib/help-articles';

// The chrome every MODE panel wears: Format.
//
// These are the panels that exist only while their tool does (docs/specs/008-canvas/format-panel.md). They are
// deliberately identical outside their bodies (same corner, same width, same
// collapse behaviour) because the bottom-right column, above the bottom
// cluster, has to read as one edge rather than panels that each drifted
// a little.
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
  /** A tour's anchor on the panel (docs/specs/007-editor/editor-tour.md). */
  dataTourId?: string;
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
  dataTourId,
  popoverOpen,
  popoverAnchor,
  asPopover,
  dismissOnOutside,
  onPopoverClose,
  popoverWidth,
}: ModePanelProps &
  ModePanelExtras & {
    title: string;
    children: ReactNode;
    // The popover's width, where its content wants more room than the corner panel's.
    popoverWidth?: string;
  }) {
  return (
    <MovablePanel
      title={title}
      position={position}
      defaultCorner="bottom-right"
      // One width for the whole bottom-right column, so it reads as one edge.
      width="w-auto sm:w-64"
      onMoveTo={onMoveTo}
      onReset={onReset}
      headerActions={headerActions}
      helpArticle={helpArticle}
      {...(dataTourId ? { dataTourId } : {})}
      {...dock}
      // As a popover over a cluster button (the Slide Deck in Pages mode).
      popoverOpen={popoverOpen}
      popoverAnchor={popoverAnchor}
      asPopover={asPopover}
      dismissOnOutside={dismissOnOutside}
      onPopoverClose={onPopoverClose}
      {...(popoverWidth ? { popoverWidth } : {})}
      collapsible
    >
      {children}
    </MovablePanel>
  );
}
