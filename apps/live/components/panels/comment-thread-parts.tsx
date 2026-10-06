'use client';

// The parts of a comment thread every surface draws the same way (docs/specs/008-canvas/canvas-and-palette.md
// "Comments", "On Plan cards"): the list of comments, the composer with @-mentions, and the Resolve / Resolved
// toggle. The canvas's comment popover and a Plan card's item panel both compose them.
import { useRef, useState, type RefObject } from 'react';
import { Button, IDENTITY_FILL, TrashIcon, identityVars } from '@livediagram/ui';
import type { Comment, CommentMention, CommentThread } from '@livediagram/document';
import { MentionMenu } from '@/components/primitives/MentionMenu';
import { MentionText } from '@/components/primitives/MentionText';
import { useMentionAutocomplete } from '@/hooks/ui/useMentionAutocomplete';
import { useMentionScope } from '@/components/canvas/collab/comment/MentionContext';
import { initialsOf } from '@/lib/identity';
import { AuthorDisc } from '@/components/primitives/AuthorDisc';
import { formatRelativeTimeCompact, useRelativeNow } from '@/lib/relative-time';

// Anyone who may comment may resolve and reopen (docs/specs/024-agents/agent-presence.md "Comments").
export function CommentResolveToggle({
  resolved,
  onResolve,
  onUnresolve,
}: {
  resolved: boolean;
  onResolve: () => void;
  onUnresolve: () => void;
}) {
  return (
    <button
      type="button"
      onClick={resolved ? onUnresolve : onResolve}
      className={
        resolved
          ? 'rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25'
          : 'rounded px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }
      aria-pressed={resolved}
    >
      {resolved ? 'Resolved' : 'Resolve'}
    </button>
  );
}

// The comments, oldest first. Editors delete any comment; a read-only session only its own (server-enforced too:
// other comments' author ids are redacted to undefined for it, so the match naturally fails).
export function CommentThreadList({
  thread,
  readOnly,
  selfId,
  onDeleteComment,
  className = 'max-h-72 overflow-y-auto px-3 py-1',
}: {
  thread: CommentThread | undefined;
  readOnly: boolean;
  selfId: string;
  onDeleteComment: (commentId: string) => void;
  className?: string;
}) {
  const resolved = thread?.resolved ?? false;
  const comments = thread?.comments ?? [];
  return (
    <ul className={className}>
      {comments.length === 0 ? (
        <li className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          No comments yet.
        </li>
      ) : (
        comments.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            resolved={resolved}
            onDelete={
              !readOnly || (c.authorId !== undefined && c.authorId === selfId)
                ? () => onDeleteComment(c.id)
                : undefined
            }
          />
        ))
      )}
    </ul>
  );
}

// The composer: a textarea with @-mentions (docs/specs/012-collaboration/comment-mentions.md) and a Comment button;
// Cmd/Ctrl+Enter sends, Enter alone keeps newline support.
export function CommentComposer({
  onAddComment,
  fieldRef,
  className = 'relative border-t border-slate-100 p-2 dark:border-slate-800',
}: {
  onAddComment: (text: string, mentions: CommentMention[]) => void;
  // Lets the host focus the field (the popover does, once placed, on desktop).
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = fieldRef ?? ownRef;
  const mentionScope = useMentionScope();
  const mention = useMentionAutocomplete({
    value: draft,
    setValue: setDraft,
    scope: mentionScope,
    fieldRef: ref,
  });
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddComment(text, mention.take(text));
    setDraft('');
  };
  return (
    <footer className={className}>
      {mention.open ? (
        <MentionMenu
          items={mention.items}
          highlight={mention.highlight}
          hint={mention.hint}
          onPick={mention.pick}
        />
      ) : null}
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          mention.onType(e);
        }}
        {...mention.bind}
        onKeyDown={(e) => {
          // The @-mention list, while open, owns Enter / Tab / arrows / Esc.
          if (mention.onKeyDown(e)) return;
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Add a comment…"
        aria-label="Add a comment"
        rows={2}
        className="w-full resize-none rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-[10px] text-slate-400 dark:text-slate-400">⌘↵ to send</p>
        <Button
          size="xs"
          onClick={submit}
          disabled={!draft.trim()}
          // Keeps the compact density: overrides append after the size scale, so they win.
          className="px-3 py-1 text-[11px]"
        >
          Comment
        </Button>
      </div>
    </footer>
  );
}

function CommentRow({
  comment,
  resolved,
  onDelete,
}: {
  comment: Comment;
  resolved: boolean;
  // Undefined when this session may not delete it, so the row never renders a delete affordance.
  onDelete?: () => void;
}) {
  const now = useRelativeNow();
  return (
    <li className={`group flex gap-2 py-2 ${resolved ? 'opacity-60' : ''}`}>
      <span className="mt-0.5 inline-flex">
        <AuthorDisc
          commentId={comment.id}
          authorId={comment.authorId}
          size={24}
          as="div"
          aria-hidden
          style={identityVars(comment.authorColor)}
          className={`text-[10px] font-semibold text-white ${IDENTITY_FILL}`}
        >
          {initialsOf(comment.authorName)}
        </AuthorDisc>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
            {comment.authorName}
          </span>
          <span className="text-slate-400 dark:text-slate-400">
            {formatRelativeTimeCompact(now - comment.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">
          <MentionText
            text={comment.text}
            mentions={comment.mentions}
            chipClassName="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          />
        </p>
      </div>
      {!resolved && onDelete ? (
        <button
          type="button"
          aria-label="Delete comment"
          onClick={onDelete}
          className="self-start rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100 focus-visible:opacity-100 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
        >
          <TrashIcon size={12} />
        </button>
      ) : null}
    </li>
  );
}
