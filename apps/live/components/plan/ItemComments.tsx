'use client';

// A card's comments in the item panel (docs/specs/026-plan/items.md "Comments"): the same thread list, composer
// and resolve toggle as the canvas's comment popover (comment-thread-parts), on the card's `comments` field.
// Anyone who may comment writes, resolves and reopens; editors delete any comment, others their own.
import { itemThread } from '@livediagram/document';
import type { Item } from '@livediagram/items';
import type { ItemCommentAction } from '@/lib/api/items';
import {
  CommentComposer,
  CommentResolveToggle,
  CommentThreadList,
} from '@/components/panels/comment-thread-parts';

export type ItemCommentsContext = {
  // Participate access: anyone who may read the document (as on the canvas).
  canComment: boolean;
  // The author id on this person's own comments.
  selfId: string;
  onComment: (action: ItemCommentAction) => void;
};

export function ItemComments({
  item,
  canEdit,
  comments,
}: {
  item: Item;
  canEdit: boolean;
  comments: ItemCommentsContext;
}) {
  const thread = itemThread(item);
  const resolved = thread?.resolved ?? false;
  const count = thread?.comments.length ?? 0;
  const { canComment, selfId, onComment } = comments;
  return (
    <div data-item-comments className="rounded-lg border border-slate-200 dark:border-slate-700">
      {count > 0 && canComment ? (
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {count === 1 ? '1 comment' : `${count} comments`}
          </span>
          <CommentResolveToggle
            resolved={resolved}
            onResolve={() => onComment({ kind: 'resolve', resolved: true })}
            onUnresolve={() => onComment({ kind: 'resolve', resolved: false })}
          />
        </div>
      ) : null}
      <CommentThreadList
        thread={thread}
        readOnly={!canEdit}
        selfId={selfId}
        onDeleteComment={(commentId) => onComment({ kind: 'delete', commentId })}
        className="max-h-96 overflow-y-auto px-3 py-1"
      />
      {!resolved && canComment ? (
        <CommentComposer
          onAddComment={(text, mentions) =>
            onComment({ kind: 'add', text, ...(mentions.length ? { mentions } : {}) })
          }
        />
      ) : null}
    </div>
  );
}
