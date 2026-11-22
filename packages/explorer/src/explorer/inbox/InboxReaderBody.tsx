'use client';

// The reading pane's prose (InboxReader): the byline that says who and why, and the body under the verbs (the
// thread and its comments, an action's or a card's note, a form's unseen responses).
import type { InboxUpdate, UpdateKind } from '@liveworkspace/index-client';
import type { InboxComment } from '../../types';
import { relativeSince, useNow } from '../../time';
import { CommentIcon } from '../../ui/icons';
import { kindWords, siteOf } from '../../words';
import { CardStatusChip } from '../badges';
import { CardGlyph, Lead, reasonIcon, type EntryFacts } from './InboxRows';
import { firstName, type InboxEntry } from './sections';

/** Who and why, in a sentence: "Priya mentioned you · 25 mins ago · Task". */
export function Byline({ entry, facts: f }: { entry: InboxEntry; facts: EntryFacts }) {
  const now = useNow();
  const when = now ? relativeSince(entry.at, now) : '';
  let sentence: string;
  // A first name for a named person; "You" and "A teammate" as they are.
  const who = f.person?.name ? (firstName(f.who) ?? f.who) : f.who;
  switch (entry.kind) {
    case 'Action':
    case 'Card':
      sentence = entry.forMe
        ? `${who} assigned this to you`
        : `You assigned this to ${firstName(entry.row.assigneeName) ?? 'a teammate'}`;
      break;
    case 'Thread':
    case 'CardThread':
      sentence =
        f.reason?.kind === 'mention'
          ? `${who} mentioned you`
          : f.reason?.kind === 'yours'
            ? `${who} commented on your ${siteKindLower(entry)}`
            : f.reason?.kind === 'agent'
              ? 'Your agent wrote'
              : who === 'You'
                ? 'You replied'
                : `${who} replied`;
      break;
    case 'FormResponses':
      sentence = f.reason?.label ?? 'New responses';
      break;
    case 'AccessRequest':
      sentence = `${who} wants access to ${f.item}`;
      break;
    case 'Update':
      sentence = updateSentence(entry.row, f.person?.id ?? null, who);
      break;
  }
  return (
    <p
      data-inbox-byline=""
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-600 dark:text-slate-300"
    >
      {f.reason ? (
        <span aria-hidden className="text-slate-500 dark:text-slate-400">
          {reasonIcon(f.reason.kind, 14)}
        </span>
      ) : null}
      <span className="font-medium text-slate-800 dark:text-slate-100">{sentence}</span>
      {when ? <span aria-hidden>·</span> : null}
      {when ? <span>{when}</span> : null}
      {f.cardType ? (
        <>
          <span aria-hidden>·</span>
          <span
            data-inbox-card-type={f.cardType.type}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 [&_svg]:size-3"
          >
            <span aria-hidden className="inline-flex">
              <CardGlyph type={f.cardType.type} />
            </span>
            {f.cardType.label}
          </span>
          <CardStatusChip column={f.column} />
        </>
      ) : null}
    </p>
  );
}

const siteKindLower = (e: InboxEntry) => kindWords(e.row.app).lowerOne;

/** An update's byline: who changed the page and how many changes it folds ("Priya and 2 others changed this page ·
 *  4 changes"); a review that came due, which nobody did, says so. `by` is the person the row names (never the
 *  reader), counted once among the others. */
export function updateSentence(
  u: Pick<InboxUpdate, 'actorCount' | 'count' | 'kinds' | 'actors'>,
  by: string | null,
  who: string,
): string {
  const changes = u.count > 1 ? ` · ${u.count} changes` : '';
  if (!by) {
    return u.kinds.length === 1 && u.kinds[0] === 'review_due'
      ? 'Its review came due'
      : `This page changed${changes}`;
  }
  const others = Math.max(0, u.actorCount - 1);
  const people = others === 0 ? who : `${who} and ${others} ${others === 1 ? 'other' : 'others'}`;
  return `${people} changed this page${changes}`;
}

/** Each kind of an update, in plain words, as its pane lists them. */
export function updateLines(u: Pick<InboxUpdate, 'kinds' | 'actors'>, viewerId: string | null) {
  const decider = firstName(u.actors.find((a) => a.id !== viewerId)?.name) ?? 'a teammate';
  const words: Record<UpdateKind, string> = {
    saved: 'Edited and saved',
    review_due: 'Its verification lapsed: it is due for review',
    approved: `Approved by ${decider}`,
    rejected: `Rejected by ${decider}`,
    moved: 'Moved to another place in the tree',
    deleted: 'Deleted: it is in the knowledgebase’s Trash',
  };
  return u.kinds.map((kind) => ({ kind, text: words[kind] }));
}

const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function Body({
  entry,
  facts: f,
  comments,
  sent,
  viewerId = null,
}: {
  entry: InboxEntry;
  facts: EntryFacts;
  comments: InboxComment[] | null | undefined;
  sent: InboxComment[];
  viewerId?: string | null;
}) {
  switch (entry.kind) {
    case 'Thread':
    case 'CardThread': {
      const r = entry.row;
      const read = comments && comments.length ? comments : null;
      // The latest comment as the row holds it, by whoever wrote it (on a mention, not who mentioned the reader).
      const latest = f.latest;
      const shown: InboxComment[] = read ?? [
        {
          id: 'latest',
          authorName: latest?.mine ? null : (latest?.person.name ?? null),
          authorColor: r.latestAuthorColor || undefined,
          authorId: latest?.mine ? null : (latest?.person.id ?? null),
          mine: latest?.mine ?? false,
          text: r.latestText,
          at: r.latestAt,
        },
      ];
      const earlier = read ? 0 : Math.max(0, r.commentCount - 1);
      // Replies sent from here that the thread's read does not hold yet (none read, or read before the app had
      // them): shown and counted at once, so a reply never disappears or the count drops back.
      const unread = read ? sentMissingFrom(read, sent) : sent;
      const count = (read ? Math.max(read.length, r.commentCount) : r.commentCount) + unread.length;
      return (
        <div className="flex flex-col gap-3" data-inbox-thread="">
          <h3 className={SECTION_LABEL} data-inbox-thread-count={count}>
            Thread · {count} {count === 1 ? 'comment' : 'comments'}
          </h3>
          {earlier > 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <CommentIcon size={14} />
              {earlier} earlier {earlier === 1 ? 'comment' : 'comments'}, in{' '}
              {siteOf(entry.row.app).name}
            </p>
          ) : null}
          <ol className="flex flex-col gap-3">
            {/* A read is keyed past every reply sent from here (threadBump); one it still lacks stays below it. */}
            {[...shown, ...unread].map((c) => (
              <Comment key={c.id} c={c} />
            ))}
          </ol>
        </div>
      );
    }
    case 'Action':
    case 'Card': {
      const r = entry.row;
      return (
        <div className="flex flex-col gap-2">
          {r.description ? (
            <>
              <h3 className={SECTION_LABEL}>Note</h3>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">
                {r.description}
              </p>
            </>
          ) : null}
        </div>
      );
    }
    case 'AccessRequest': {
      const r = entry.row;
      const name = firstName(r.requesterName) ?? 'them';
      return (
        <div className="flex flex-col gap-3" data-inbox-access="">
          {r.note?.trim() ? (
            <>
              <h3 className={SECTION_LABEL}>Note</h3>
              <blockquote
                data-inbox-access-note=""
                className="m-0 whitespace-pre-line break-words border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                {r.note.trim()}
              </blockquote>
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">They left no note.</p>
          )}
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Sharing makes a pass for {name} in Share. Delete it there to take the access away.
            Declining tells them nothing.
          </p>
        </div>
      );
    }
    case 'Update': {
      const lines = updateLines(entry.row, viewerId);
      return (
        <div className="flex flex-col gap-2" data-inbox-update="">
          <h3 className={SECTION_LABEL}>What changed</h3>
          <ul className="flex flex-col gap-1.5">
            {lines.map((line) => (
              <li
                key={line.kind}
                data-inbox-update-kind={line.kind}
                className="flex items-start gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200"
              >
                <span
                  aria-hidden
                  className="mt-[0.6875rem] size-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500"
                />
                {line.text}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            You watch this page. Unwatch it from the page to stop hearing about it.
          </p>
        </div>
      );
    }
    case 'FormResponses': {
      const r = entry.row;
      return (
        <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
          {r.unseen} {r.unseen === 1 ? 'response' : 'responses'} to {r.heading || 'this form'} you
          haven’t seen. {r.boardTabId ? 'They land on its board.' : 'They’re on the form.'}
        </p>
      );
    }
  }
}

/** The replies sent from here that a read of the thread lacks: each matched against one of the reader's own comments
 *  in the read with the same text, once, so two identical replies need two in the read. */
export function sentMissingFrom(
  read: readonly InboxComment[],
  sent: InboxComment[],
): InboxComment[] {
  if (sent.length === 0) return sent;
  const held = new Map<string, number>();
  for (const c of read) if (c.mine) held.set(c.text, (held.get(c.text) ?? 0) + 1);
  return sent.filter((c) => {
    const n = held.get(c.text) ?? 0;
    if (n === 0) return true;
    held.set(c.text, n - 1);
    return false;
  });
}

function Comment({ c }: { c: InboxComment }) {
  const now = useNow();
  const name = c.mine ? 'You' : (c.authorName ?? 'A teammate');
  return (
    <li className="flex gap-3">
      <Lead
        person={{
          id: c.mine ? null : c.authorId,
          name: c.mine ? null : c.authorName,
          color: c.authorColor,
          picture: c.mine ? null : c.authorPicture,
        }}
        compact
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">
          <span className="font-semibold text-slate-900 dark:text-slate-50">{name}</span>
          {now && c.at ? (
            <span className="ml-1.5 text-slate-500 dark:text-slate-400">
              {relativeSince(c.at, now)}
            </span>
          ) : null}
        </p>
        <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700 dark:text-slate-200">
          {c.text}
        </p>
      </div>
    </li>
  );
}
