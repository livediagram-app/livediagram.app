'use client';

// A card's comments in the item panel (docs/specs/026-plan/items.md "Comments"): the same thread list, composer
// and resolve control as the canvas's comment popover (comment-thread-parts), on the card's `comments` field, drawn
// as a feed: no box, a quiet header with the count and Resolve, the comments at a comfortable size, and the composer
// beside your own avatar. Anyone who may comment writes, resolves and reopens; editors delete any comment, others
// their own.
import { itemThread } from '@livediagram/document';
import type { Item } from '@livediagram/items';
import type { ItemCommentAction } from '@/lib/api/items';
import {
  CommentComposer,
  CommentResolveToggle,
  CommentThreadList,
} from '@/components/panels/comment-thread-parts';
import { usePlan } from './PlanContext';

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
  const self = usePlan()?.self ?? null;
  const thread = itemThread(item);
  const resolved = thread?.resolved ?? false;
  const count = thread?.comments.length ?? 0;
  const { canComment, selfId, onComment } = comments;
  return (
    <div data-item-comments className="flex flex-col gap-1">
      {count > 0 ? (
        <div className="flex min-h-7 items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {count === 1 ? '1 comment' : `${count} comments`}
          </span>
          {canComment ? (
            <CommentResolveToggle
              resolved={resolved}
              onResolve={() => onComment({ kind: 'resolve', resolved: true })}
              onUnresolve={() => onComment({ kind: 'resolve', resolved: false })}
            />
          ) : null}
        </div>
      ) : null}
      <CommentThreadList
        thread={thread}
        readOnly={!canEdit}
        selfId={selfId}
        density="comfortable"
        onDeleteComment={(commentId) => onComment({ kind: 'delete', commentId })}
        className="-mx-1 max-h-96 divide-y divide-slate-100 overflow-y-auto px-1 dark:divide-slate-800"
      />
      {!resolved && canComment ? (
        <CommentComposer
          density="comfortable"
          self={self}
          onAddComment={(text, mentions) =>
            onComment({ kind: 'add', text, ...(mentions.length ? { mentions } : {}) })
          }
        />
      ) : null}
    </div>
  );
}
