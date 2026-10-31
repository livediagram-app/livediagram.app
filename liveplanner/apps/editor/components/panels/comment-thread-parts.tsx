'use client';

// The parts of a comment thread every surface draws the same way (docs/specs/008-canvas/canvas-and-palette.md
// "Comments", "On Plan cards"): the list of comments, the composer with @-mentions, and the Resolve / Reopen
// control. The canvas's comment popover and a Plan card's item panel both compose them; the panel draws them
// `comfortable` (a feed: larger text, the composer beside your own avatar), the popover `compact`.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useAutoHeight } from '@liveworkspace/workbench/hooks/ui/useAutoHeight';
import { useReactionTray } from '@liveworkspace/workbench/components/comments/CommentReactions';
import {
  ScopedAddReactionButton,
  ScopedCommentReactions,
} from '@liveworkspace/workbench/components/comments/CommentReactionsContext';
import {
  Button,
  CheckIcon,
  GlyphDisc,
  IDENTITY_FILL,
  PictureDisc,
  TrashIcon,
  Tooltip,
  identityVars,
  lucideGlyph,
} from '@liveplanner/ui';
import { lucidePencil, lucideSparkles } from '@liveworkspace/icons/lucide';
import type { Comment, CommentMention, CommentThread } from '@liveplanner/project';
import { MentionMenu } from '@/components/primitives/MentionMenu';
import { MentionText } from '@/components/primitives/MentionText';
import { useMentionAutocomplete } from '@/hooks/ui/useMentionAutocomplete';
import { useMentionScope } from '@/components/canvas/collab/comment/MentionContext';
import { initialsOf } from '@/lib/identity';
import { useOwnPicture } from '@/lib/own-picture';
import { formatRelativeTimeCompact, useRelativeNow } from '@/lib/relative-time';
import { conversationRailClass } from '@/components/plan/threads/timeline-parts';

// A card thread's rail (docs/specs/026-plan/items.md "Where it shows"): `through` when the reply composer follows the
// comments, `end` when the last comment ends it (a resolved thread).
type CommentRail = 'through' | 'end';

type CommentDensity = 'compact' | 'comfortable';

// The tallest the composer grows before it scrolls, in px (about eight lines).
const COMPOSER_MAX_PX = 160;
const COMPOSER_MAX = { px: COMPOSER_MAX_PX };

// The send shortcut as this platform names it: ⌘ on Apple devices, Ctrl elsewhere.
function sendShortcutLabel(): string {
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
  onEditComment,
  density = 'compact',
  className = 'max-h-72 overflow-y-auto px-3 py-1',
  canComment = true,
  emptyText,
  rail,
}: {
  thread: Pick<CommentThread, 'comments' | 'resolved'> | undefined;
  readOnly: boolean;
  // Whether this session may write a comment: only then is it invited to start the conversation (a Viewer only
  // looks, docs/specs/013-workspace/share-roles.md).
  canComment?: boolean;
  selfId: string;
  onDeleteComment: (commentId: string) => void;
  // Edit on this person's own comments (a card's threads, docs/specs/026-plan/items.md "Where it shows"); absent, no
  // comment offers it.
  onEditComment?: (commentId: string, text: string, mentions: CommentMention[]) => void;
  density?: CommentDensity;
  className?: string;
  // What an empty list says, when its host has its own words.
  emptyText?: string;
  // A card thread draws its comments on a rail from the header's disc; absent, none.
  rail?: CommentRail;
}) {
  const resolved = thread?.resolved ?? false;
  const comments = thread?.comments ?? [];
  if (comments.length === 0)
    return (
      <p
        className={`${density === 'comfortable' ? 'py-1 text-[13px]' : 'px-3 py-3 text-xs'} text-slate-500 dark:text-slate-400`}
      >
        {emptyText ??
          (canComment ? 'No comments yet. Start the conversation.' : 'No comments yet.')}
      </p>
    );
  return (
    <ul className={className}>
      {comments.map((c, i) => (
        <CommentRow
          key={c.id}
          comment={c}
          resolved={resolved}
          density={density}
          rail={rail && (rail === 'end' && i === comments.length - 1 ? 'end' : 'through')}
          onDelete={
            !readOnly || (c.authorId !== undefined && c.authorId === selfId)
              ? () => onDeleteComment(c.id)
              : undefined
          }
          onEdit={
            onEditComment && canComment && c.authorId !== undefined && c.authorId === selfId
              ? (text, mentions) => onEditComment(c.id, text, mentions)
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
/** What a composer's `secondary` action reads: the typed text (trimmed), its mentions, and a way to empty the field. */
export interface ComposerDraft {
  text: string;
  mentions: () => CommentMention[];
  clear: () => void;
}

export function CommentComposer({
  onAddComment,
  fieldRef,
  density = 'compact',
  self,
  className,
  placeholder = 'Add a comment…',
  fieldLabel = 'Add a comment',
  submitLabel = 'Comment',
  onCancel,
  onDraft,
  below,
  secondary,
  rail = false,
}: {
  onAddComment: (text: string, mentions: CommentMention[]) => void;
  // Lets the host focus the field (the popover does, once placed, on desktop).
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  density?: CommentDensity;
  self?: { name: string; color: string } | null;
  className?: string;
  // A card thread's starter and reply say their own words (docs/specs/026-plan/items.md "Where it shows").
  placeholder?: string;
  fieldLabel?: string;
  submitLabel?: string;
  // A Cancel beside the send button, which Escape presses too (the thread starter).
  onCancel?: () => void;
  // The draft as it is typed (the starter's title preview).
  onDraft?: (text: string) => void;
  // A line under the field (the starter's title preview).
  below?: React.ReactNode;
  // A quieter action on the bottom row, left of the send button (a card thread's Resolve). A function gets the
  // draft, so the action can send it along (Comment and Resolve): `mentions` reads the picks without spending them,
  // `clear` empties the field once the text is posted.
  secondary?: React.ReactNode | ((draft: ComposerDraft) => React.ReactNode);
  // The end of a card thread's rail, running into your disc.
  rail?: boolean;
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
  // Your own avatar beside the composer wears your Google picture, on your own screen always.
  const { picture: ownPicture } = useOwnPicture();
  // Grows with its text up to COMPOSER_MAX_PX, then scrolls (useAutoHeight).
  useAutoHeight(ref, draft, COMPOSER_MAX);
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddComment(text, mention.take(text));
    setDraft('');
    onDraft?.('');
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
      {rail ? <span aria-hidden className={conversationRailClass('into')} /> : null}
      {self ? (
        <PictureDisc
          size={28}
          aria-hidden
          pictureUrl={ownPicture}
          name={self.name}
          style={identityVars(self.color)}
          className={`relative mt-1 text-[10px] font-semibold text-white ${IDENTITY_FILL} ${rail ? RAIL_RING : ''}`}
        >
          {initialsOf(self.name)}
        </PictureDisc>
      ) : null}
      <div className="min-w-0 flex-1">
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onDraft?.(e.target.value);
            mention.onType(e);
          }}
          {...mention.bind}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            // The @-mention list, while open, owns Enter / Tab / arrows / Esc.
            if (mention.onKeyDown(e)) return;
            if (onCancel && e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label={fieldLabel}
          rows={comfortable ? 1 : 2}
          style={{ maxHeight: COMPOSER_MAX_PX }}
          className={`block w-full resize-none rounded-lg border border-slate-200 bg-white text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ${
            comfortable ? 'px-3 py-2 text-[13px] leading-relaxed' : 'px-2 py-1.5 text-xs'
          }`}
        />
        {below}
        <div className="mt-1.5 flex min-h-6 items-center justify-between gap-2">
          {/* A key combination, so only where there is a keyboard to press it: a touch screen sends with Comment. */}
          <p
            className="text-[11px] text-slate-500 pointer-coarse:invisible dark:text-slate-400"
            aria-live="polite"
          >
            {focused ? sendShortcutLabel() : ''}
          </p>
          <span className="flex items-center gap-1.5">
            {typeof secondary === 'function'
              ? secondary({
                  text: draft.trim(),
                  mentions: () => mention.peek(draft.trim()),
                  clear: () => {
                    mention.take(draft.trim());
                    setDraft('');
                    onDraft?.('');
                  },
                })
              : secondary}
            {onCancel ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={onCancel}
                className="px-3 py-1 text-[11px] pointer-coarse:py-2"
              >
                Cancel
              </Button>
            ) : null}
            <Button
              size="xs"
              onClick={submit}
              disabled={!draft.trim()}
              // Keeps the compact density: overrides append after the size scale, so they win.
              className="px-3 py-1 text-[11px] pointer-coarse:py-2"
            >
              {submitLabel}
            </Button>
          </span>
        </div>
      </div>
    </footer>
  );
}

// The quiet mark above an agent's comment (docs/specs/026-plan/items.md "Generated by AI").
const AiIcon = lucideGlyph(lucideSparkles, 11);
const EditIcon = lucideGlyph(lucidePencil, 12);

function CommentRow({
  comment,
  resolved,
  density,
  onDelete,
  onEdit,
  rail,
}: {
  comment: Comment;
  resolved: boolean;
  density: CommentDensity;
  rail?: 'through' | 'end' | undefined;
  // Undefined when this session may not delete it, so the row never renders a delete affordance.
  onDelete?: () => void;
  // The same for an edit: only on this person's own comment, where its host offers editing.
  onEdit?: (text: string, mentions: CommentMention[]) => void;
}) {
  const now = useRelativeNow();
  const comfortable = density === 'comfortable';
  const [editing, setEditing] = useState(false);
  // Its reactions (docs/specs/012-collaboration/comment-reactions.md): the trigger beside Edit and Delete opens the
  // tray under the text, where the chips are. The scope (the canvas's, or a card thread's) says how one is sent.
  const tray = useReactionTray();
  const when = new Date(comment.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <li
      className={`group flex ${rail ? 'relative' : ''} ${comfortable ? 'gap-2.5 py-2.5' : 'gap-2 py-2'} ${resolved ? 'opacity-70' : ''}`}
    >
      {rail ? <span aria-hidden className={conversationRailClass(rail)} /> : null}
      <span className="relative mt-0.5 inline-flex">
        <GlyphDisc
          size={comfortable ? 28 : 24}
          as="div"
          aria-hidden
          style={identityVars(comment.authorColor)}
          className={`text-[10px] font-semibold text-white ${IDENTITY_FILL} ${rail ? (resolved ? RAIL_RING_RESOLVED : RAIL_RING) : ''}`}
        >
          {initialsOf(comment.authorName)}
        </GlyphDisc>
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
              className="shrink-0 text-[11px] text-slate-500 outline-none focus-visible:underline dark:text-slate-400"
            >
              {formatRelativeTimeCompact(now - comment.createdAt)}
            </time>
          </Tooltip>
          {comment.editedAt ? (
            <span
              data-comment-edited=""
              className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400"
            >
              · Edited
            </span>
          ) : null}
        </div>
        {comment.ai ? (
          <p
            data-comment-ai=""
            className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          >
            <AiIcon aria-hidden />
            Generated by AI
          </p>
        ) : null}
        {editing && onEdit ? (
          <CommentEditField
            initial={comment.text}
            mentions={comment.mentions ?? []}
            comfortable={comfortable}
            onCancel={() => setEditing(false)}
            onSave={(text, mentions) => {
              setEditing(false);
              if (text !== comment.text) onEdit(text, mentions);
            }}
          />
        ) : (
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
        )}
        <ScopedCommentReactions
          commentId={comment.id}
          reactions={comment.reactions}
          tray={tray}
          density={density}
          closed={resolved}
        />
      </div>
      <ScopedAddReactionButton tray={tray} density={density} closed={resolved || editing} />
      {!resolved && !editing && (onEdit || onDelete) ? (
        <div className="flex shrink-0 gap-0.5 self-start opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
          {onEdit ? (
            <Tooltip label="Edit comment">
              <button
                type="button"
                aria-label="Edit comment"
                onClick={() => setEditing(true)}
                className={ROW_ACTION}
              >
                <EditIcon aria-hidden />
              </button>
            </Tooltip>
          ) : null}
          {onDelete ? (
            <Tooltip label="Delete comment">
              <button
                type="button"
                aria-label="Delete comment"
                onClick={onDelete}
                className={ROW_ACTION}
              >
                <TrashIcon size={12} />
              </button>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// A railed disc's ring, the colour of the thread card behind it, so the rail stops at the disc's edge.
const RAIL_RING = 'ring-[3px] ring-white dark:ring-slate-900';
const RAIL_RING_RESOLVED = 'ring-[3px] ring-slate-50 dark:ring-slate-900';

// A row's Edit and Delete: at least 32 px on a touch screen (docs/specs/026-plan/items.md "Keyboard and screen
// readers"), quiet until hovered or focused with a mouse.
const ROW_ACTION =
  'flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 motion-reduce:transition-none pointer-coarse:h-8 pointer-coarse:w-8 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

// A comment's text, edited in place: Save (or Cmd/Ctrl+Enter) keeps it, Cancel (or Escape) leaves it as it was. The
// comment's mentions stay while their handles are still in the text.
function CommentEditField({
  initial,
  mentions,
  comfortable,
  onSave,
  onCancel,
}: {
  initial: string;
  mentions: readonly CommentMention[];
  comfortable: boolean;
  onSave: (text: string, mentions: CommentMention[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(ref, draft, COMPOSER_MAX);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const save = () => {
    const text = draft.trim();
    if (!text) return;
    onSave(
      text,
      mentions.filter((m) => text.includes(`@${m.handle}`)),
    );
  };
  return (
    <div className="mt-1">
      <textarea
        ref={ref}
        value={draft}
        aria-label="Edit comment"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
        style={{ maxHeight: COMPOSER_MAX_PX }}
        className={`block w-full resize-none rounded-lg border border-slate-200 bg-white text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${
          comfortable ? 'px-3 py-2 text-[13px] leading-relaxed' : 'px-2 py-1.5 text-xs'
        }`}
      />
      <div className="mt-1.5 flex justify-end gap-1.5">
        <Button size="xs" variant="ghost" onClick={onCancel} className="px-3 py-1 text-[11px]">
          Cancel
        </Button>
        <Button size="xs" onClick={save} disabled={!draft.trim()} className="px-3 py-1 text-[11px]">
          Save
        </Button>
      </div>
    </div>
  );
}
