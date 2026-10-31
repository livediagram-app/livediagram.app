'use client';

// One comment thread on a card (docs/specs/026-plan/items.md "Where it shows"): a rounded tile whose header opens and
// closes it (its title, the people in it, how many comments and when it was last active, the shared chip and the ⋯
// menu), and, open, its comments, Resolve or Reopen, and a reply composer. A resolved thread is drawn quieter, with
// who resolved it. Rename edits the title in place.

import { useId, useMemo, useRef, useState } from 'react';
import {
  CheckIcon,
  CommentIcon,
  ConfirmPopover,
  GlyphDisc,
  IDENTITY_FILL,
  TrashIcon,
  Tooltip,
  identityVars,
  lucideGlyph,
} from '@liveplanner/ui';
import {
  lucideChevronDown,
  lucideLink,
  lucidePencil,
  lucideRotateCcw,
} from '@liveworkspace/icons/lucide';
import {
  threadOnlyBy,
  threadParticipants,
  threadTitle,
  type CardThread,
} from '@liveplanner/project';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import {
  CommentReactionsProvider,
  type CommentReactionScope,
} from '@liveworkspace/workbench/components/comments/CommentReactionsContext';
import {
  CommentComposer,
  CommentThreadList,
  type ComposerDraft,
} from '@/components/panels/comment-thread-parts';
import { initialsOf } from '@/lib/identity';
import { formatRelativeTimeCompact, useRelativeNow } from '@/lib/relative-time';
import { ThreadSharedChip } from './ThreadSharedChip';
import { ThreadTitleEditor } from './ThreadTitleEditor';
import { ANNOUNCE, commentCount, deleteThreadMessage, resolvedByLabel } from './thread-words';
import type { CardThreadsContextValue } from './CardThreadsContext';

const Chevron = lucideGlyph(lucideChevronDown, 14);
const RenameIcon = lucideGlyph(lucidePencil, 14);
const AddIcon = lucideGlyph(lucideLink, 14);
const ReopenIcon = lucideGlyph(lucideRotateCcw, 14);

// Why Delete Thread… is greyed: someone else's comment is in it, so it is resolved instead.
export const DELETE_REASON = 'Others have commented: resolve it instead.';

// The avatars of up to three people in a thread, then how many more.
const FACES = 3;

function Faces({ thread }: { thread: CardThread }) {
  const people = threadParticipants(thread);
  const shown = people.slice(0, FACES);
  const more = people.length - shown.length;
  return (
    <span className="flex items-center" aria-hidden>
      {shown.map((p, i) => (
        <GlyphDisc
          key={`${p.name}-${p.color}`}
          size={20}
          as="span"
          style={identityVars(p.color)}
          className={`text-[8px] font-semibold tracking-tight text-white ring-2 ring-white dark:ring-slate-900 ${IDENTITY_FILL} ${i ? '-ml-1' : ''}`}
        >
          {initialsOf(p.name)}
        </GlyphDisc>
      ))}
      {more > 0 ? (
        <span className="ml-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          +{more}
        </span>
      ) : null}
    </span>
  );
}

export function ThreadTile({
  thread,
  itemId,
  expanded,
  onToggle,
  ctx,
  titleOf,
  onAddToCard,
  tileRef,
}: {
  thread: CardThread;
  // The card it is viewed on.
  itemId: string;
  expanded: boolean;
  onToggle: () => void;
  ctx: CardThreadsContextValue;
  // A card of this plan's title, for the shared chip's list.
  titleOf: (itemId: string) => string | null;
  onAddToCard: (thread: CardThread) => void;
  tileRef?: (el: HTMLElement | null) => void;
}) {
  const bodyId = useId();
  const now = useRelativeNow();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuButton, setMenuButton] = useState<HTMLButtonElement | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const headerRef = useRef<HTMLButtonElement>(null);
  const { canComment, isEditor, selfId, selfKey, self, threads, announce } = ctx;
  const resolved = thread.resolved;
  // Reacting to a comment in this thread (docs/specs/012-collaboration/comment-reactions.md): whoever may comment
  // here, through the thread's own write, which shows it at once and reaches everyone through the room's thread op.
  const threadId = thread.id;
  const reactions = useMemo<CommentReactionScope>(
    () => ({
      selfKey,
      selfName: self?.name,
      canReact: canComment,
      toggle: (commentId, emoji, on) =>
        void threads.act({ kind: 'react', threadId, commentId, emoji, on, key: selfKey }),
    }),
    [selfKey, self, canComment, threads, threadId],
  );
  // A title cleared back to the automatic one reads '' until the answer lands: worked out here meanwhile.
  const title = threadTitle(thread);
  // Only a thread made of this person's own comments is deleted, Editors' alike; with anyone else's in it, it is
  // resolved instead (docs/specs/026-plan/items.md "Deleting a thread").
  const mayDelete = threadOnlyBy(thread, selfId);
  const at = resolved ? (thread.resolvedAt ?? thread.updatedAt) : thread.updatedAt;
  const when = new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };
  const resolve = (value: boolean) => {
    void threads.act({ kind: 'resolve', threadId: thread.id, resolved: value }).then((ok) => {
      if (ok !== false) announce(value ? ANNOUNCE.resolved : ANNOUNCE.reopened);
    });
  };

  // Comment and Resolve: the typed reply first, then the resolve, as one action. A reply that fails resolves nothing
  // and keeps the draft; a reply that lands clears it even if the resolve then fails.
  const replyAndResolve = (draft: ComposerDraft) => {
    const mentions = draft.mentions();
    void threads
      .act({
        kind: 'reply',
        threadId: thread.id,
        text: draft.text,
        ...(mentions.length ? { mentions } : {}),
      })
      .then(async (ok) => {
        if (ok === false) return;
        draft.clear();
        const done = await threads.act({ kind: 'resolve', threadId: thread.id, resolved: true });
        announce(done === false ? ANNOUNCE.replied : ANNOUNCE.repliedAndResolved);
      });
  };

  return (
    <li
      ref={tileRef}
      data-thread={thread.id}
      data-thread-resolved={resolved ? '' : undefined}
      className={`rounded-xl border transition-colors motion-reduce:transition-none ${
        resolved
          ? 'border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40'
          : expanded
            ? 'border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-1 py-1.5 pl-1.5 pr-1">
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1">
            <ThreadTitleEditor
              title={threadTitle(thread)}
              onDone={(title) => {
                setRenaming(false);
                headerRef.current?.focus();
                if (title === null || title === threadTitle(thread)) return;
                void threads.act({ kind: 'rename', threadId: thread.id, title }).then((ok) => {
                  if (ok !== false) announce(ANNOUNCE.renamed);
                });
              }}
            />
          </div>
        ) : (
          <button
            ref={headerRef}
            type="button"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={onToggle}
            onKeyDown={(e) => {
              if (e.key === 'F2' && canComment) {
                e.preventDefault();
                setRenaming(true);
              }
            }}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-400/60 motion-reduce:transition-none pointer-coarse:py-2"
          >
            <span
              aria-hidden
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                resolved
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
              }`}
            >
              {resolved ? <CheckIcon size={11} /> : <CommentIcon size={11} />}
            </span>
            <span className="min-w-0 flex-1">
              <Tooltip label={title}>
                <span
                  data-thread-title=""
                  className={`block truncate text-[13px] font-semibold leading-5 ${
                    resolved
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-slate-900 dark:text-slate-50'
                  }`}
                >
                  {title}
                </span>
              </Tooltip>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Faces thread={thread} />
                <span>{commentCount(thread.comments.length)}</span>
                <span aria-hidden>·</span>
                {resolved ? (
                  <>
                    <span>{resolvedByLabel(thread.resolvedBy)}</span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <Tooltip label={when}>
                  <time dateTime={new Date(at).toISOString()}>
                    {formatRelativeTimeCompact(now - at)}
                  </time>
                </Tooltip>
              </span>
            </span>
            <span
              aria-hidden
              className={`mt-1 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
            >
              <Chevron />
            </span>
          </button>
        )}
        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
          {thread.cards.length > 1 ? (
            <ThreadSharedChip thread={thread} ctx={ctx} itemId={itemId} titleOf={titleOf} />
          ) : null}
          {canComment ? (
            <EllipsisTriggerButton
              ref={setMenuButton}
              label={`More for the thread “${title}”`}
              expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            />
          ) : null}
        </div>
      </div>
      {menuOpen ? (
        <PortalMenu anchor={menuButton} placement="below" onClose={() => setMenuOpen(false)}>
          <MenuActionRow
            plain
            label="Rename"
            icon={<RenameIcon />}
            onClick={run(() => setRenaming(true))}
          />
          <MenuActionRow
            plain
            label="Add to Card…"
            icon={<AddIcon />}
            onClick={run(() => onAddToCard(thread))}
          />
          <MenuActionRow
            plain
            label={resolved ? 'Reopen' : 'Resolve'}
            icon={resolved ? <ReopenIcon /> : <CheckIcon size={14} />}
            onClick={run(() => resolve(!resolved))}
          />
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            disabled={!mayDelete}
            label="Delete Thread…"
            icon={<TrashIcon />}
            onClick={run(() => setConfirming(true))}
          />
          {mayDelete ? null : (
            <p
              role="none"
              data-thread-delete-reason=""
              className="max-w-56 px-3 pb-2 pl-[2.625rem] text-[11px] leading-snug text-slate-500 dark:text-slate-400"
            >
              {DELETE_REASON}
            </p>
          )}
        </PortalMenu>
      ) : null}
      {confirming && menuButton ? (
        <ConfirmPopover
          anchor={menuButton}
          message={deleteThreadMessage(thread.cards.length)}
          confirmLabel="Delete Thread"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void threads.act({ kind: 'deleteThread', threadId: thread.id }).then((ok) => {
              if (ok !== false) announce(ANNOUNCE.deleted);
            });
          }}
        />
      ) : null}
      {expanded ? (
        <div
          id={bodyId}
          data-thread-body=""
          className="animate-card-rise border-t border-slate-100 px-3 pb-3 pt-1 motion-reduce:animate-none dark:border-slate-800"
        >
          <CommentReactionsProvider value={reactions}>
            <CommentThreadList
              thread={thread}
              readOnly={!isEditor}
              canComment={canComment}
              selfId={selfId}
              density="comfortable"
              onDeleteComment={(commentId) =>
                void threads.act({ kind: 'delete', threadId: thread.id, commentId }).then((ok) => {
                  if (ok !== false)
                    announce(ok === null ? ANNOUNCE.deleted : ANNOUNCE.commentDeleted);
                })
              }
              onEditComment={(commentId, text, mentions) =>
                void threads
                  .act({
                    kind: 'edit',
                    threadId: thread.id,
                    commentId,
                    text,
                    ...(mentions.length ? { mentions } : {}),
                  })
                  .then((ok) => {
                    if (ok !== false) announce(ANNOUNCE.commentEdited);
                  })
              }
              className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800"
            />
          </CommentReactionsProvider>
          {resolved ? (
            canComment ? (
              <div className="mt-1 flex justify-end">
                <ResolveButton resolved onClick={() => resolve(false)} />
              </div>
            ) : null
          ) : canComment ? (
            <CommentComposer
              density="comfortable"
              self={ctx.self}
              placeholder="Reply…"
              fieldLabel={`Reply to “${title}”`}
              submitLabel="Reply"
              // Resolve sits on the composer's row, left of Reply: whoever may reply may resolve.
              // With text typed it reads Comment and Resolve and posts the text first.
              secondary={(draft) => (
                <ResolveButton
                  resolved={false}
                  withComment={draft.text !== ''}
                  onClick={() => (draft.text ? replyAndResolve(draft) : resolve(true))}
                />
              )}
              onAddComment={(text, mentions) =>
                void threads
                  .act({
                    kind: 'reply',
                    threadId: thread.id,
                    text,
                    ...(mentions.length ? { mentions } : {}),
                  })
                  .then((ok) => {
                    if (ok !== false) announce(ANNOUNCE.replied);
                  })
              }
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ResolveButton({
  resolved,
  withComment = false,
  onClick,
}: {
  resolved: boolean;
  // Text is typed in the reply box: the button posts it, then resolves.
  withComment?: boolean;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition motion-reduce:transition-none pointer-coarse:py-2 ${
        resolved
          ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
      }`}
    >
      {resolved ? <ReopenIcon aria-hidden /> : <CheckIcon size={12} />}
      {resolved ? 'Reopen' : withComment ? 'Comment and Resolve' : 'Resolve'}
    </button>
  );
  return withComment ? (
    <Tooltip label="Post your reply, then resolve the thread">{button}</Tooltip>
  ) : (
    button
  );
}
