'use client';

import { useLayoutEffect, useRef } from 'react';

import type { ShapeElement } from '@liveplanner/project';

import { useRelativeNow } from '@/lib/relative-time';
import { CollabPanel } from '@/components/canvas/collab/collab-chrome';
import { CollabAccentScope } from '@/components/canvas/collab/collab-accent';
import { CommentBubbles } from '@/components/canvas/collab/comment/CommentBubbles';
import { CollabDoneChip } from '@/components/canvas/collab/CollabDoneChip';
import { DiscussGlyph, EmptyRows } from '@/components/canvas/collab/collab-parts';

// The face of a stored Comment panel (docs/specs/012-collaboration/comment-pin.md, retired): a card on the canvas that
// shows the comment thread it carries, as a conversation, READ-ONLY.
//
// Comment threads on canvas elements are retired (docs/specs/026-plan/plan-mode.md "No comment thread on any canvas
// element", Work Tracker 751): no Plan surface places a panel, and one that arrives with a tab (an older project, an
// import, a paste) keeps its `commentThread` untouched. So the face still shows what was said, for every role, and
// offers nothing to add to it: no composer, no Resolve chip, no Reopen bar, no delete.
//
// Built from the modern collab parts ("The look"): the accent scope and the CollabPanel frame (reflowing: resizing
// makes room for more of the thread, not bigger type).

export function CommentPanelFace({
  element,
  label,
  textColor,
  surface,
  selfId,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  /** The card's own fill, for the accent scope. */
  surface: string;
  // Who is reading, so their own comments sit on the right.
  selfId: string;
}) {
  const now = useRelativeNow();
  const thread = element.commentThread;
  const comments = thread?.comments ?? [];
  const resolved = thread?.resolved === true;

  // Keep the newest in view on first paint and whenever the stored thread changes (a remote undo, a reload). The
  // list's parent is CollabPanel's scrolling body.
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (comments.length === 0) return;
    const scroller = listRef.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [comments.length]);

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        reflow
        title={label.trim() || 'Comments'}
        textColor={textColor}
        aside={resolved ? <CollabDoneChip>Resolved</CollabDoneChip> : undefined}
      >
        <div ref={listRef} className={resolved ? 'opacity-55' : undefined}>
          {comments.length === 0 ? (
            <EmptyRows
              textColor={textColor}
              title="No comments yet"
              rows={0}
              glyph={<DiscussGlyph size={14} />}
            />
          ) : (
            <CommentBubbles comments={comments} selfId={selfId} textColor={textColor} now={now} />
          )}
        </div>
      </CollabPanel>
    </CollabAccentScope>
  );
}
