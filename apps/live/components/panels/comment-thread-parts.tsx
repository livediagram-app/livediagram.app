'use client';

// The parts of a comment thread every surface draws the same way (docs/specs/008-canvas/canvas-and-palette.md
// "Comments", "On Plan cards"): the list of comments, the composer with @-mentions, and the Resolve / Reopen
// control. The canvas's comment popover and a Plan card's item panel both compose them; the panel draws them
// `comfortable` (a feed: larger text, the composer beside your own avatar), the popover `compact`.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  Button,
  CheckIcon,
  IDENTITY_FILL,
  TrashIcon,
  Tooltip,
  identityVars,
} from '@livediagram/ui';
import type { Comment, CommentMention, CommentThread } from '@livediagram/document';
import { MentionMenu } from '@/components/primitives/MentionMenu';
import { MentionText } from '@/components/primitives/MentionText';
import { useMentionAutocomplete } from '@/hooks/ui/useMentionAutocomplete';
import { useMentionScope } from '@/components/canvas/collab/comment/MentionContext';
import { initialsOf } from '@/lib/identity';
import { AuthorDisc } from '@/components/primitives/AuthorDisc';
import { formatRelativeTimeCompact, useRelativeNow } from '@/lib/relative-time';

export type CommentDensity = 'compact' | 'comfortable';

// The tallest the composer grows before it scrolls, in px (about eight lines).
export const COMPOSER_MAX_PX = 160;

// The send shortcut as this platform names it: ⌘ on Apple devices, Ctrl elsewhere.
export function sendShortcutLabel(): string {
  const platform =
    typeof navigator === 'undefined'
      ? ''
      : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
          ?.platform ?? navigator.platform);
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘ Enter to send' : 'Ctrl Enter to send';
}

// Anyone who may comment may resolve and reopen (docs/specs/024-agents/agent-presence.md "Comments"). Open: a quiet
// **Resolve** button. Resolved: a green **Resolved** badge with a **Reopen** button beside it.
export function CommentResolveToggle({
  resolved,
  onResolve,
  onUnresolve,
}: {
  resolved: boolean;
  onResolve: () => void;
  onUnresolve: () => void;
}) {
  if (!resolved)
    return (
      <button
        type="button"
        onClick={onResolve}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <CheckIcon size={12} />
        Resolve
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckIcon size={11} />
        Resolved
      </span>
      <button
        type="button"
        onClick={onUnresolve}
        className="cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        Reopen
      </button>
    </span>
  );
}

// The comments, oldest first. Editors delete any comment; a read-only session only its own (server-enforced too:
// other comments' author ids are redacted to undefined for it, so the match naturally fails).
export function CommentThreadList({
  thread,
  readOnly,
  selfId,
  onDeleteComment,
  density = 'compact',
  className = 'max-h-72 overflow-y-auto px-3 py-1',
}: {
  thread: CommentThread | undefined;
  readOnly: boolean;
  selfId: string;
  onDeleteComment: (commentId: string) => void;
  density?: CommentDensity;
  className?: string;
}) {
  const resolved = thread?.resolved ?? false;
  const comments = thread?.comments ?? [];
  if (comments.length === 0)
    return (
      <p
        className={`${density === 'comfortable' ? 'py-1 text-[13px]' : 'px-3 py-3 text-xs'} text-slate-500 dark:text-slate-400`}
      >
        No comments yet. Start the conversation.
      </p>
    );
  return (
    <ul className={className}>
      {comments.map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          resolved={resolved}
          density={density}
          onDelete={
            !readOnly || (c.authorId !== undefined && c.authorId === selfId)
              ? () => onDeleteComment(c.id)
              : undefined
          }
        />
      ))}
    </ul>
  );
}

// The composer: a textarea with @-mentions (docs/specs/012-collaboration/comment-mentions.md) that grows with its
// text, and a Comment button that waits for some; Cmd/Ctrl+Enter sends (the hint shows while it has focus), Enter
// alone keeps newline support. `self` draws your own avatar beside it (the item panel's feed).
export function CommentComposer({
  onAddComment,
  fieldRef,
  density = 'compact',
  self,
  className,
}: {
  onAddComment: (text: string, mentions: CommentMention[]) => void;
  // Lets the host focus the field (the popover does, once placed, on desktop).
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  density?: CommentDensity;
  self?: { name: string; color: string } | null;
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = fieldRef ?? ownRef;
  const mentionScope = useMentionScope();
  const mention = useMentionAutocomplete({
    value: draft,
    setValue: setDraft,
    scope: mentionScope,
    fieldRef: ref,
  });
  const comfortable = density === 'comfortable';
  // Grows with its text up to COMPOSER_MAX_PX, then scrolls. The height is border-box, so it adds the borders to the
  // content's scrollHeight: without them the field is 2px short of its text and shows a scrollbar on one line. It
  // only scrolls (and so only ever shows a scrollbar) once it is at its tallest.
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = 'auto';
    const borders = field.offsetHeight - field.clientHeight;
    const needed = field.scrollHeight + borders;
    field.style.height = `${Math.min(needed, COMPOSER_MAX_PX)}px`;
    field.style.overflowY = needed > COMPOSER_MAX_PX ? 'auto' : 'hidden';
  }, [draft, ref]);
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddComment(text, mention.take(text));
    setDraft('');
  };
  return (
    <footer
      className={
        className ??
        (comfortable
          ? 'relative flex gap-2.5 pt-1'
          : 'relative border-t border-slate-100 p-2 dark:border-slate-800')
      }
    >
      {mention.open ? (
        <MentionMenu
          items={mention.items}
          highlight={mention.highlight}
          hint={mention.hint}
          onPick={mention.pick}
        />
      ) : null}
      {self ? (
        <span
          aria-hidden
          style={identityVars(self.color)}
          className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${IDENTITY_FILL}`}
        >
          <span className="text-optical-centre">{initialsOf(self.name)}</span>
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            mention.onType(e);
          }}
          {...mention.bind}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
          rows={comfortable ? 1 : 2}
          style={{ maxHeight: COMPOSER_MAX_PX }}
          className={`block w-full resize-none rounded-lg border border-slate-200 bg-white text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ${
            comfortable ? 'px-3 py-2 text-[13px] leading-relaxed' : 'px-2 py-1.5 text-xs'
          }`}
        />
        <div className="mt-1.5 flex min-h-6 items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400 dark:text-slate-400" aria-live="polite">
            {focused ? sendShortcutLabel() : ''}
          </p>
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
      </div>
    </footer>
  );
}

function CommentRow({
  comment,
  resolved,
  density,
  onDelete,
}: {
  comment: Comment;
  resolved: boolean;
  density: CommentDensity;
  // Undefined when this session may not delete it, so the row never renders a delete affordance.
  onDelete?: () => void;
}) {
  const now = useRelativeNow();
  const comfortable = density === 'comfortable';
  const when = new Date(comment.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <li
      className={`group flex ${comfortable ? 'gap-2.5 py-2.5' : 'gap-2 py-2'} ${resolved ? 'opacity-60' : ''}`}
    >
      <span className="mt-0.5 inline-flex">
        <AuthorDisc
          commentId={comment.id}
          authorId={comment.authorId}
          size={comfortable ? 28 : 24}
          as="div"
          aria-hidden
          style={identityVars(comment.authorColor)}
          className={`text-[10px] font-semibold text-white ${IDENTITY_FILL}`}
        >
          {initialsOf(comment.authorName)}
        </AuthorDisc>
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`flex items-baseline gap-1.5 ${comfortable ? 'text-[13px]' : 'text-[11px]'}`}
        >
          <span className="truncate font-medium text-slate-900 dark:text-slate-50">
            {comment.authorName}
          </span>
          <Tooltip label={when}>
            <time
              dateTime={new Date(comment.createdAt).toISOString()}
              aria-label={when}
              tabIndex={0}
              className="shrink-0 text-[11px] text-slate-400 outline-none focus-visible:underline dark:text-slate-400"
            >
              {formatRelativeTimeCompact(now - comment.createdAt)}
            </time>
          </Tooltip>
        </div>
        <p
          className={`mt-0.5 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 ${
            comfortable ? 'text-[13px] leading-relaxed' : 'text-xs'
          }`}
        >
          <MentionText
            text={comment.text}
            mentions={comment.mentions}
            chipClassName="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          />
        </p>
      </div>
      {!resolved && onDelete ? (
        <Tooltip label="Delete comment">
          <button
            type="button"
            aria-label="Delete comment"
            onClick={onDelete}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center self-start rounded-md text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
          >
            <TrashIcon size={12} />
          </button>
        </Tooltip>
      ) : null}
    </li>
  );
}
