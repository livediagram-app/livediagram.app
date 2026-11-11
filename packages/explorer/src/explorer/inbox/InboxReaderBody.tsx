'use client';

// The reading pane's prose (InboxReader): the byline that says who and why, and the body under the verbs (the
// thread and its comments, an action's or a card's note, a form's unseen responses).
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
  const who = f.who === 'You' ? 'You' : (firstName(f.who) ?? f.who);
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

const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function Body({
  entry,
  facts: f,
  comments,
  sent,
}: {
  entry: InboxEntry;
  facts: EntryFacts;
  comments: InboxComment[] | null | undefined;
  sent: InboxComment[];
}) {
  switch (entry.kind) {
    case 'Thread':
    case 'CardThread': {
      const r = entry.row;
      const read = comments && comments.length ? comments : null;
      const shown: InboxComment[] = read ?? [
        {
          id: 'latest',
          authorName: f.who === 'You' ? null : f.who,
          authorColor: r.latestAuthorColor || undefined,
          authorId: f.who === 'You' ? null : (r.latestAuthorId ?? null),
          mine: f.who === 'You',
          text: r.latestText,
          at: r.latestAt,
        },
      ];
      const earlier = read ? 0 : Math.max(0, r.commentCount - 1);
      return (
        <div className="flex flex-col gap-3" data-inbox-thread="">
          <h3 className={SECTION_LABEL}>
            Thread · {r.commentCount} {r.commentCount === 1 ? 'comment' : 'comments'}
          </h3>
          {earlier > 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <CommentIcon size={14} />
              {earlier} earlier {earlier === 1 ? 'comment' : 'comments'}, in{' '}
              {siteOf(entry.row.app).name}
            </p>
          ) : null}
          <ol className="flex flex-col gap-3">
            {/* A read is keyed past every reply sent from here (threadBump), so once one lands it holds them. */}
            {[...shown, ...(read ? [] : sent)].map((c) => (
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
