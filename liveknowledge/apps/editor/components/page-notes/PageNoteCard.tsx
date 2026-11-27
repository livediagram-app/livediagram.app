'use client';

// One comment or action on the page's words, as the Comments list shows it (docs/specs/030-knowledgebase/
// page-comments.md "Listed with the page's comments"): the note's glyph in its colour, the words it is on as a quote
// (or "Its words were deleted" with a Detached chip), then its newest comment or its assignee and due day. The whole
// card is one button: it brings the words into view and opens the thread or the action.
import { Chip, GlyphDisc, IDENTITY_FILL, identityVars, lucideGlyph } from '@liveknowledge/ui';
import { lucideCircleCheck, lucideMessageSquare } from '@liveworkspace/icons/lucide';
import { actionDueWords } from '@liveworkspace/index-client/action-due';
import { presenceColourOf } from '@liveworkspace/settings/presence';
import { ACTION_STATUS_LABELS } from '@liveknowledge/document';
import { initialsOf } from '@/lib/identity';
import { relativeSince } from '@/lib/relative-time';
import type { PageNote } from '@/lib/page-notes/page-notes';

const CommentIcon = lucideGlyph(lucideMessageSquare, 16);
const ActionIcon = lucideGlyph(lucideCircleCheck, 16);

/** What a press on a note's card does. */
export type OpenPageNote = (note: PageNote) => void;

export function PageNoteCard({
  note,
  now,
  onOpen,
}: {
  note: PageNote;
  now: number;
  onOpen: OpenPageNote;
}) {
  const action = note.action;
  const who = action ? action.assignee.name?.trim() || 'Teammate' : null;
  const due = action ? actionDueWords(action.due, now) : null;
  const kindWord = note.kind === 'action' ? 'Action' : 'Comment';
  const name = note.quote
    ? `${kindWord} on “${note.quote.length > 80 ? `${note.quote.slice(0, 80)}…` : note.quote}”`
    : `${kindWord}, its words were deleted`;
  return (
    <button
      type="button"
      data-page-note={note.kind}
      data-note-state={note.open ? 'open' : 'closed'}
      data-detached={note.quote === null ? '' : undefined}
      aria-label={name}
      onClick={() => onOpen(note)}
      className={`group/note flex w-full cursor-pointer gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-left shadow-sm shadow-slate-900/[0.03] transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900 ${
        note.open ? '' : 'opacity-70'
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
          note.kind === 'action'
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
        }`}
      >
        {note.kind === 'action' ? <ActionIcon /> : <CommentIcon />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {note.quote !== null ? (
          <span
            data-note-quote=""
            className={`line-clamp-2 border-l-2 pl-2 text-[13px] italic leading-snug text-slate-700 dark:text-slate-200 ${
              note.kind === 'action'
                ? 'border-emerald-400 dark:border-emerald-500'
                : 'border-indigo-400 dark:border-indigo-500'
            }`}
          >
            {note.quote}
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] italic text-slate-500 dark:text-slate-400">
            Its words were deleted
            <Chip className="bg-amber-50 px-1.5 py-px text-[11px] font-semibold not-italic text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
              Detached
            </Chip>
          </span>
        )}
        {action ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <GlyphDisc
              size={20}
              as="span"
              aria-hidden
              style={identityVars(presenceColourOf(who!, action.assignee.color))}
              className={`shrink-0 text-[9px] font-semibold text-white ${IDENTITY_FILL}`}
            >
              {initialsOf(who!)}
            </GlyphDisc>
            <span className="min-w-0 truncate font-medium text-slate-900 dark:text-slate-50">
              {action.name}
            </span>
            <span className="text-slate-500 dark:text-slate-400">· {who}</span>
            {due ? (
              <span
                data-note-due={due.tone}
                className={
                  due.tone === 'past' && note.open
                    ? 'font-medium text-red-700 dark:text-red-300'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                · {due.text}
              </span>
            ) : null}
            {!note.open ? (
              <span className="text-slate-500 dark:text-slate-400">
                · {ACTION_STATUS_LABELS[action.status]}
              </span>
            ) : null}
          </span>
        ) : note.latest ? (
          <span className="flex min-w-0 items-center gap-2 text-[13px]">
            <GlyphDisc
              size={20}
              as="span"
              aria-hidden
              style={identityVars(note.latest.authorColor)}
              className={`shrink-0 text-[9px] font-semibold text-white ${IDENTITY_FILL}`}
            >
              {initialsOf(note.latest.agent ?? note.latest.authorName)}
            </GlyphDisc>
            <span className="shrink-0 font-medium text-slate-900 dark:text-slate-50">
              {note.latest.authorName}
            </span>
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {relativeSince(note.latest.createdAt, now)}
            </span>
            <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
              {note.latest.text}
            </span>
          </span>
        ) : null}
        {note.kind === 'comment' && note.count > 1 ? (
          <span className="text-xs font-medium text-slate-500 group-hover/note:text-slate-700 dark:text-slate-400 dark:group-hover/note:text-slate-200">
            {note.count} comments
          </span>
        ) : null}
      </span>
    </button>
  );
}
