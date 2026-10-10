'use client';

import type { ReactNode } from 'react';
import type { Element, TabVote } from '@livediagram/document';
import type { DockAnchor } from '@/lib/canvas-chrome';
import type { HelpArticleKey } from '@/lib/help-articles';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { FacilitatedNote } from '@/components/panels/session-studio/studio-ui';
import { TimerPane } from '@/components/panels/session-studio/TimerPane';
import { VotePane } from '@/components/panels/session-studio/VotePane';
import { PollPane } from '@/components/panels/session-studio/PollPane';
import { PollPanel } from '@/components/panels/PollPanel';
import { VotePanel } from '@/components/panels/VotePanel';
import type { CanvasProps } from './Canvas.types';
import type { SessionSegment } from './SessionClusterStrip';

// What a Session strip button opens (docs/specs/012-collaboration/session-tools.md "The Session strip"):
// the tool's live panel while it runs (the Timer pane's live dial, the Vote panel, the Poll panel),
// and its Session Studio set-up pane while it is idle, so starting one from the strip is the same
// form as starting it from the tab menu.

const NO_MOVE = () => {};

export type SessionPopoverProps = {
  segment: SessionSegment;
  anchor?: DockAnchor;
  onClose: () => void;
  session: SessionToolsProps;
  // A view-role visitor: running tools only, read-only.
  readOnly: boolean;
  // Who the dot-vote knows us by (the collab key).
  voteSelfId: string;
  pollPanel: CanvasProps['pollPanel'];
  vote: {
    tabVote: TabVote | undefined;
    elements: Element[];
    participantCount: number;
    results: { id: string; votes: number }[];
    reviewIndex: number | null;
    onJumpToResult: (index: number) => void;
    isHost: boolean;
  };
};

export function SessionPopover({
  segment,
  anchor,
  onClose,
  session,
  readOnly,
  voteSelfId,
  pollPanel,
  vote,
}: SessionPopoverProps) {
  if (segment === 'session-vote' && vote.tabVote) {
    return (
      <VotePanel
        vote={vote.tabVote}
        elements={vote.elements}
        participantCount={vote.participantCount}
        results={vote.results}
        reviewIndex={vote.reviewIndex}
        onJumpToResult={vote.onJumpToResult}
        onEndVote={session.onEndVote}
        onRevealVote={session.onRevealVote}
        onClearVote={session.onClearVote}
        isHost={vote.isHost}
        readOnly={readOnly}
        popoverAnchor={anchor}
        onPopoverClose={onClose}
      />
    );
  }
  if (segment === 'session-poll' && pollPanel) {
    return (
      <PollPanel
        poll={pollPanel.poll}
        answers={pollPanel.answers}
        isHost={pollPanel.isHost}
        onEnd={pollPanel.onEnd}
        onKeepResults={pollPanel.onKeepResults}
        onDismiss={() => {
          pollPanel.onDismiss();
          onClose();
        }}
        popoverAnchor={anchor}
        onPopoverClose={onClose}
      />
    );
  }
  if (segment === 'session-timer') {
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
  if (readOnly) return null;
  if (segment === 'session-vote') {
    return (
      <SessionToolPopover
        title="Vote"
        help="sessionVoting"
        anchor={anchor}
        onClose={onClose}
        facilitatedBy={session.facilitatedBy}
      >
        <VotePane {...session} selfId={voteSelfId} />
      </SessionToolPopover>
    );
  }
  return (
    <SessionToolPopover
      title="Poll"
      help="sessionPolls"
      anchor={anchor}
      onClose={onClose}
      facilitatedBy={session.facilitatedBy}
    >
      <PollPane
        {...session}
        // Starting a poll puts its question on screen for everyone, this popover included; it
        // steps aside, and the Poll button carries the results from here on.
        onStartPoll={(draft) => {
          session.onStartPoll(draft);
          onClose();
        }}
      />
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
