import type { ReactNode } from 'react';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { MovablePanelPlacementProps } from '@/components/primitives/MovablePanel.types';
import type { HelpArticleKey } from '@/lib/help-articles';

// The chrome every MODE panel wears: Eraser, Format, Laser, Spotlight.
//
// These four are the panels that exist only while their tool does (docs/specs/008-canvas/laser-panel.md for
// the Laser, and the same shape for the rest). They are
// deliberately identical outside their bodies (same corner, same width, same
// collapse behaviour) because the bottom-right column, above the bottom
// cluster, has to read as one edge rather than four panels that each drifted
// a little.
//
// All of them wrote that out by hand: the same props in the same order,
// differing only in `title`. This is the second half of the job
// MovablePanelPlacementProps started; that type stopped nine panels
// re-declaring the placement props, and these went on re-typing the
// forwarding block underneath.

/** Everything a mode panel forwards to its MovablePanel. */
export type ModePanelProps = MovablePanelPlacementProps;

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
}: ModePanelProps &
  ModePanelExtras & {
    title: string;
    children: ReactNode;
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
      {...dock}
      collapsible
    >
      {children}
    </MovablePanel>
  );
}
