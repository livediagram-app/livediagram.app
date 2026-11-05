'use client';

import type { ReactNode } from 'react';
import type { DockAnchor } from '@/lib/canvas-chrome';
import type { HelpArticleKey } from '@/lib/help-articles';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { FacilitatedNote } from '@/components/panels/session-studio/studio-ui';
import { TimerPane } from '@/components/panels/session-studio/TimerPane';
import type { SessionSegment } from './SessionClusterStrip';

// What the Session strip's Timer button opens (docs/specs/012-collaboration/session-tools.md "The Session strip"):
// the Timer pane, its live dial while a timer runs and its set-up while idle, so starting one from the strip is
// the same form as starting it from the tab menu.

const NO_MOVE = () => {};

export type SessionPopoverProps = {
  segment: SessionSegment;
  anchor?: DockAnchor;
  onClose: () => void;
  session: SessionToolsProps;
  // A view-role visitor: running tools only, read-only.
  readOnly: boolean;
};

export function SessionPopover({ anchor, onClose, session, readOnly }: SessionPopoverProps) {
  // A view-role visitor only reaches this while a timer runs (the strip offers them nothing idle).
  if (readOnly) {
    return session.timer ? (
      <SessionToolPopover title="Timer" help="sessionTimer" anchor={anchor} onClose={onClose}>
        <TimerPane {...session} readOnly />
      </SessionToolPopover>
    ) : null;
  }
  return (
    <SessionToolPopover
      title="Timer"
      help="sessionTimer"
      anchor={anchor}
      onClose={onClose}
      facilitatedBy={session.facilitatedBy}
    >
      <TimerPane {...session} />
    </SessionToolPopover>
  );
}

// A Studio pane in a popover over its strip button. While somebody else facilitates, the pane is
// disabled under the same note the Studio shows (docs/specs/012-collaboration/facilitator.md).
function SessionToolPopover({
  title,
  help,
  anchor,
  onClose,
  facilitatedBy,
  children,
}: {
  title: string;
  help: HelpArticleKey;
  anchor?: DockAnchor;
  onClose: () => void;
  facilitatedBy?: string | null;
  children: ReactNode;
}) {
  const blocked = Boolean(facilitatedBy);
  return (
    <MovablePanel
      title={title}
      helpArticle={help}
      position={null}
      defaultCorner="bottom-right"
      onMoveTo={NO_MOVE}
      popoverOpen
      popoverAnchor={anchor}
      asPopover
      popoverWidth="w-72"
      dismissOnOutside
      onPopoverClose={onClose}
    >
      <div className="flex flex-col gap-3 px-3 pb-3">
        {blocked ? <FacilitatedNote name={facilitatedBy!} /> : null}
        <fieldset disabled={blocked} className="min-w-0 border-0 p-0 disabled:opacity-60">
          {children}
        </fieldset>
      </div>
    </MovablePanel>
  );
}
