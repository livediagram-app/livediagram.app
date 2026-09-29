'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import type { CommentMention, ShapeElement } from '@livediagram/document';

import { useRelativeNow } from '@/lib/relative-time';
import { CollabPanel, tint } from '@/components/canvas/collab/collab-chrome';
import { CollabAccentScope } from '@/components/canvas/collab/collab-accent';
import { CollabComposer } from '@/components/canvas/collab/CollabComposer';
import { CommentBubbles } from '@/components/canvas/collab/comment/CommentBubbles';
import { CollabDoneChip } from '@/components/canvas/collab/CollabDoneChip';
import { useMentionScope } from '@/components/canvas/collab/comment/MentionContext';
import {
  AccentBar,
  CheckGlyph,
  DiscussGlyph,
  EmptyRows,
  QA_ACCENT,
  QA_ACCENT_INK,
  ReopenGlyph,
  stopPointer,
} from '@/components/canvas/collab/qa/qa-parts';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';

// The face of a Comment panel (docs/specs/012-collaboration/comment-pin.md): a card on the board that carries a
// comment thread and shows it in place, as a conversation.
//
// It carries NO comment machinery of its own. Every element can already hold a
// `commentThread`, and the composer, resolve / unresolve, author identity,
// realtime and persistence all already work against that field, keyed by
// element id. A panel is an element whose only job is to hold one and show it
// in place, so this file is a layout.
//
// The point of a panel over the anchored popover is that it STAYS. A popover
// is one reader's transient view; a panel connected to what it is about sits
// on the board, in the export, and in everyone's session, which is what makes
// a remark part of the document rather than a note somebody left.
//
// Built from the modern collab parts ("The look"): the accent scope, the
// CollabPanel frame (reflowing, like the Q&A board: resizing makes room for
// more of the thread, not bigger type), and the shared composer.

// Same cap the api enforces on a comment (packages/document element-deltas).
const COMMENT_MAX_TEXT = 5000;

export function CommentPanelFace({
  element,
  label,
  textColor,
  surface,
  selfId,
  onAddComment,
  onDeleteComment,
  onResolve,
  onUnresolve,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  /** The card's own fill, for the accent scope. */
  surface: string;
  selfId: string;
  // Absent on a surface with no comment session (the read-only embed, the
  // export renderer), which renders the panel readable but inert.
  onAddComment?: (text: string, mentions: CommentMention[]) => void;
  onDeleteComment?: (commentId: string) => void;
  onResolve?: () => void;
  onUnresolve?: () => void;
}) {
  const now = useRelativeNow();
  const mentionScope = useMentionScope();
  const thread = element.commentThread;
  const comments = thread?.comments ?? [];
  const resolved = thread?.resolved === true;
  // Comments past this index arrived after the card first painted.
  const [initialCount] = useState(comments.length);

  // Keep the newest in view: on first paint and whenever a comment lands. The
  // list's parent is CollabPanel's scrolling body.
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (comments.length === 0) return;
    const scroller = listRef.current?.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [comments.length]);

  const aside = resolved ? (
    <CollabDoneChip>Resolved</CollabDoneChip>
  ) : comments.length > 0 && onResolve ? (
    // The thread's one other act, top right: no count there, since the
    // bubbles already show how many there are.
    <ResolveChip onPress={onResolve} />
  ) : undefined;

  const footer = !onAddComment ? undefined : resolved ? (
    onUnresolve ? (
      <AccentBar onPress={onUnresolve} icon={<ReopenGlyph size={12} />}>
        Reopen Thread
      </AccentBar>
    ) : undefined
  ) : (
    <CollabComposer
      textColor={textColor}
      placeholder={comments.length ? 'Reply…' : 'Write a comment…'}
      ariaLabel="Write a comment"
      sendLabel="Send comment"
      maxLength={COMMENT_MAX_TEXT}
      onSubmit={onAddComment}
      mentionScope={mentionScope}
    />
  );

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        reflow
        title={label.trim() || 'Comments'}
        textColor={textColor}
        aside={aside}
        footer={footer}
      >
        <div ref={listRef} className={resolved ? 'opacity-55' : undefined}>
          {comments.length === 0 ? (
            <EmptyRows
              textColor={textColor}
              title="Start the Conversation"
              rows={0}
              glyph={<DiscussGlyph size={14} />}
            >
              {onAddComment ? 'Replies stay on the board for everyone to read.' : undefined}
            </EmptyRows>
          ) : (
            <CommentBubbles
              comments={comments}
              selfId={selfId}
              textColor={textColor}
              now={now}
              freshFrom={initialCount}
              onDelete={onDeleteComment}
            />
          )}
        </div>
      </CollabPanel>
    </CollabAccentScope>
  );
}

// In the header's top-right slot: the thread's one other act, a small chip in
// the accent (the Idea box's Anonymous badge's shape).
function ResolveChip({ onPress }: { onPress: () => void }) {
  const press = usePressWithoutDrag(onPress);
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 text-[10px] font-semibold transition hover:brightness-110"
      style={{ color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.14) }}
    >
      <CheckGlyph size={10} />
      Resolve
    </button>
  );
}
