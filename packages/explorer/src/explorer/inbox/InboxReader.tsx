'use client';

// The Inbox's reading pane (one-explorer-contracts.md "Inbox"): the row chosen in the list, read in full. Top to
// bottom: where it is (the app's Living Prism, the team glyph, the item › the tab › the element or board), what it
// is as a large title, who and why ("Priya mentioned you · 25 mins ago · Task"), the verbs (Reply, Resolve or Mark
// Done where this page can carry them out, Open in the app always), the item's thumbnail where the host draws one,
// then the thread, the action's note or the form's responses, and a reply field where replying is offered.
//
// Its verbs come from the host (`InboxHost.actions`), asked per row; nothing is offered that the page can't do. On a
// phone and in the editor's panel the pane takes the list's place, with Back.

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { APP_KINDS } from '@liveworkspace/index-client';
import { BackBar, Button } from '@liveworkspace/ui';
import type { InboxComment, InboxTarget, InboxVerb, ItemPlace } from '../../types';
import { relativeSince, useNow } from '../../time';
import { CheckIcon, CommentIcon, OpenIcon, ReplyIcon, SendIcon, TeamIcon } from '../../ui/icons';
import { kindWords, siteOf } from '../../words';
import { AppMark } from '../badges';
import { useExplorer } from '../context';
import { ThisBrowserPill } from '../ThisBrowser';
import { CardGlyph, entryFacts, Lead, reasonIcon, type EntryFacts } from './InboxRows';
import { BoundedCache, itemCache, useSettledRead } from './paneData';
import { firstName, type InboxEntry } from './sections';

/** Where a row opens in its app: an action's popover, a thread's comments, a card on the board that shows it (or by
 *  itself), a form's responses on their board (else the form). */
export function entryPlace(e: InboxEntry): ItemPlace {
  switch (e.kind) {
    case 'Card':
    case 'CardThread': {
      const card = e.row.card!;
      // A card's own thread row names the card by `card.id` and the thread by its element (one-explorer-contracts.md
      // "What an item pushes"); a row from before threads named the card by its element.
      const thread = e.kind === 'CardThread' && card.id ? e.row.elementId : null;
      return {
        tabId: card.board?.tabId ?? null,
        elementId: card.board?.elementId ?? null,
        cardId: card.id ?? e.row.elementId,
        ...(thread ? { threadId: thread } : {}),
      };
    }
    case 'Action':
      return { tabId: e.row.tabId, elementId: e.row.elementId, open: 'action' };
    case 'Thread':
      return { tabId: e.row.tabId, elementId: e.row.elementId, open: 'comments' };
    case 'FormResponses':
      return { tabId: e.row.boardTabId ?? e.row.tabId };
  }
}

/** The row as the host's verbs find it; null for a form, which has none. */
export function entryTarget(e: InboxEntry): InboxTarget | null {
  if (e.kind === 'FormResponses') return null;
  const r = e.row;
  return {
    kind: e.kind,
    app: r.app,
    itemId: r.itemId,
    tabId: r.tabId,
    elementId: r.elementId,
    actionId: e.kind === 'Action' || e.kind === 'Card' ? e.row.actionId : null,
    local: r.local === true,
  };
}

/** The verbs the pane offers for a row on this page: the host's say, kept to the ones that make sense for the
 *  row's kind (a thread replies and resolves, an action or a card is marked done). */
export function offeredVerbs(
  e: InboxEntry,
  offers: ((t: InboxTarget) => readonly InboxVerb[]) | undefined,
): InboxVerb[] {
  const target = entryTarget(e);
  if (!target || !offers) return [];
  const said = offers(target);
  const fits: readonly InboxVerb[] =
    e.kind === 'Thread' || e.kind === 'CardThread' ? ['reply', 'resolve'] : ['done'];
  return fits.filter((v) => said.includes(v));
}

/** What the Inbox's keyboard asks of the pane. */
export type ReaderHandle = {
  reply: () => boolean;
  primary: () => boolean;
  open: () => void;
  focusTitle: () => void;
};

const KBD =
  'ml-1 inline-flex min-w-[1.25rem] [@media(pointer:coarse)]:hidden items-center justify-center rounded border border-current/25 px-1 font-sans text-[10px] font-medium leading-4 opacity-70';

const PANE_BUTTON =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-micro motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-11';
const PRIMARY = `${PANE_BUTTON} bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500`;
const SECONDARY = `${PANE_BUTTON} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;

const threadCaches = new WeakMap<object, BoundedCache<InboxComment[] | null>>();
function threadCache(host: object): BoundedCache<InboxComment[] | null> {
  let c = threadCaches.get(host);
  if (!c) {
    c = new BoundedCache();
    threadCaches.set(host, c);
  }
  return c;
}

type Props = {
  entry: InboxEntry;
  showApp: boolean;
  /** On a phone or in the panel: the pane stands in for the list, with Back. */
  onBack?: () => void;
  /** The row's work was done here (resolved, marked done): it leaves the list. */
  onGone: (key: string) => void;
  announce: (message: string) => void;
};

export const InboxReader = forwardRef<ReaderHandle, Props>(function InboxReader(
  { entry, showApp, onBack, onGone, announce },
  ref,
) {
  const { client, Link, itemHref, inboxHost, renderThumbnail, viewerId, teamName } = useExplorer();
  const actions = inboxHost?.actions;
  const f = entryFacts(entry, viewerId);
  const site = siteOf(entry.row.app);
  const href = itemHref(
    { id: entry.row.itemId, app: entry.row.app, kind: APP_KINDS[entry.row.app], sharedVia: null },
    entryPlace(entry),
  );
  const verbs = offeredVerbs(entry, actions?.offers);
  const canReply = verbs.includes('reply') && Boolean(actions?.reply);
  const primaryVerb: 'resolve' | 'done' | null =
    verbs.includes('resolve') && actions?.resolve
      ? 'resolve'
      : verbs.includes('done') && actions?.done
        ? 'done'
        : null;
  const target = entryTarget(entry);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLSpanElement>(null);
  const [busy, setBusy] = useState<InboxVerb | null>(null);
  const [failed, setFailed] = useState<InboxVerb | null>(null);
  const [draft, setDraft] = useState('');
  // Replies sent from here this visit, shown under the thread until a read of it holds them.
  const [sent, setSent] = useState<InboxComment[]>([]);
  const [threadBump, setThreadBump] = useState(0);
  // A new row: a fresh draft, no stale error.
  const [shownKey, setShownKey] = useState(entry.key);
  // The row on show now, for a reply that finishes after the choice moved on (the pane is patched in place).
  const entryKeyRef = useRef(entry.key);
  useEffect(() => {
    entryKeyRef.current = entry.key;
  });
  if (shownKey !== entry.key) {
    setShownKey(entry.key);
    setDraft('');
    setFailed(null);
    setSent([]);
  }

  // The item, for its thumbnail: only where the host draws one and the index holds the item.
  const wantsItem = Boolean(renderThumbnail) && !f.local;
  const item = useSettledRead(wantsItem ? entry.row.itemId : null, itemCache(client), () =>
    client.getItem(entry.row.itemId).then(
      (r) => r.item,
      () => null,
    ),
  );
  // The thread's comments, where the host can read them; keyed by its latest comment, so a new one reads again.
  const isThread = entry.kind === 'Thread' || entry.kind === 'CardThread';
  const loadThread = actions?.loadThread;
  const threadKey =
    isThread && loadThread && target ? `${entry.key}@${entry.at}:${threadBump}` : null;
  const comments = useSettledRead(
    threadKey,
    actions ? threadCache(actions) : new BoundedCache(),
    target && loadThread ? (signal) => loadThread(target, signal) : null,
  );

  const run = useCallback(
    async (verb: 'resolve' | 'done') => {
      const fn = verb === 'resolve' ? actions?.resolve : actions?.done;
      if (!fn || !target || busy) return;
      setBusy(verb);
      setFailed(null);
      try {
        await fn(target);
        inboxHost?.onTelemetry?.('Resolved', verb === 'resolve' ? 'Thread' : entry.kind);
        announce(verb === 'resolve' ? `Resolved ${f.title}` : `Marked ${f.title} done`);
        onGone(entry.key);
      } catch {
        setFailed(verb);
      } finally {
        setBusy(null);
      }
    },
    [actions, target, busy, inboxHost, entry.kind, entry.key, f.title, announce, onGone],
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || !actions?.reply || !target || busy) return;
    setBusy('reply');
    setFailed(null);
    const from = entry.key;
    try {
      await actions.reply(target, text);
      inboxHost?.onTelemetry?.('Added', 'Reply');
      announce('Reply sent');
      // Sent, but the choice has moved on: the row on show keeps its own draft and thread.
      if (entryKeyRef.current !== from) return;
      // The emptied draft disables Send: the keyboard goes back to the reply box rather than the page body.
      if (document.activeElement === sendRef.current) replyRef.current?.focus();
      setDraft('');
      setSent((s) => [
        ...s,
        { id: `sent-${s.length}`, authorName: null, mine: true, text, at: Date.now() },
      ]);
      if (threadKey) setThreadBump((n) => n + 1);
    } catch {
      if (entryKeyRef.current === from) setFailed('reply');
    } finally {
      setBusy(null);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      reply: () => {
        if (!canReply) return false;
        replyRef.current?.focus();
        return true;
      },
      primary: () => {
        if (!primaryVerb) return false;
        void run(primaryVerb);
        return true;
      },
      open: () => openRef.current?.closest('a')?.click(),
      focusTitle: () => titleRef.current?.focus(),
    }),
    [canReply, primaryVerb, run],
  );

  const team = entry.row.itemTeamId ? teamName(entry.row.itemTeamId) : null;
  const thumb = wantsItem && item ? renderThumbnail?.(item, 'card') : null;

  return (
    <section
      aria-labelledby={titleId}
      data-inbox-reader={entry.kind}
      className="flex min-h-0 min-w-0 flex-col gap-4"
    >
      {/* The shared back bar (docs/specs/004-interface-design/back-bar.md), on a phone and in the panel. */}
      {onBack ? <BackBar label="Inbox" onClick={onBack} gap="tight" /> : null}
      <nav
        aria-label="Where it is"
        className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400"
      >
        {showApp ? <AppMark app={entry.row.app} size={15} /> : null}
        {entry.row.itemTeamId ? (
          <span title={team ?? 'Team'} className="inline-flex shrink-0 text-slate-400">
            <TeamIcon size={13} />
            <span className="sr-only">{team ? `In ${team}` : 'A team’s'}</span>
          </span>
        ) : null}
        <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
          {f.item}
        </span>
        {f.where.map((w, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              ›
            </span>
            <span className="min-w-0 truncate">{w}</span>
          </span>
        ))}
        {f.local ? <ThisBrowserPill /> : null}
      </nav>
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        data-inbox-reader-title=""
        className={`font-semibold leading-tight tracking-tight text-slate-900 outline-none dark:text-slate-50 ${onBack ? 'text-xl' : 'text-2xl'}`}
      >
        {f.cardKey == null ? null : (
          <span className="mr-1.5 font-medium tabular-nums text-slate-400 dark:text-slate-500">
            #{f.cardKey}
          </span>
        )}
        {f.title}
      </h2>
      <Byline entry={entry} facts={f} />
      <div className="flex flex-wrap items-center gap-2" data-inbox-verbs="">
        {canReply ? (
          <button
            type="button"
            className={PRIMARY}
            aria-keyshortcuts="r"
            onClick={() => replyRef.current?.focus()}
          >
            <ReplyIcon size={15} />
            Reply
            <kbd className={KBD} aria-hidden>
              R
            </kbd>
          </button>
        ) : null}
        {primaryVerb ? (
          <Button
            variant="none"
            className={canReply ? SECONDARY : PRIMARY}
            aria-keyshortcuts="e"
            // Keeps the keyboard while it works (busy-buttons.md); a failure's alert is then beside it.
            busy={busy !== null}
            onClick={() => void run(primaryVerb)}
          >
            <CheckIcon size={15} />
            {busy === primaryVerb
              ? primaryVerb === 'resolve'
                ? 'Resolving…'
                : 'Marking done…'
              : primaryVerb === 'resolve'
                ? 'Resolve'
                : 'Mark Done'}
            <kbd className={KBD} aria-hidden>
              E
            </kbd>
          </Button>
        ) : null}
        <Link
          href={href}
          onClick={() => inboxHost?.onTelemetry?.('Selected', entry.kind)}
          className={canReply || primaryVerb ? SECONDARY : PRIMARY}
        >
          <span ref={openRef} data-inbox-open="" className="inline-flex items-center gap-1.5">
            <OpenIcon size={14} />
            Open in {site.name}
            <kbd className={KBD} aria-hidden>
              ↵
            </kbd>
          </span>
        </Link>
      </div>
      {failed && failed !== 'reply' ? (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {failed === 'resolve' ? 'Couldn’t resolve this thread.' : 'Couldn’t mark this done.'} Try
          again, or open it in {site.name}.
        </p>
      ) : null}
      {thumb ? (
        <figure className="m-0">
          <div
            data-inbox-thumb=""
            className="aspect-[16/7] max-h-60 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 [&>*]:size-full"
          >
            {thumb}
          </div>
          <figcaption className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {f.item}
            {f.where.length ? `, ${f.where.join(' › ')}` : ''}
          </figcaption>
        </figure>
      ) : null}
      <Body entry={entry} facts={f} comments={comments} sent={sent} />
      {canReply ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor={`${titleId}-reply`}>
            Reply
          </label>
          <textarea
            id={`${titleId}-reply`}
            ref={replyRef}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
              if (e.key === 'Escape') {
                e.stopPropagation();
                e.currentTarget.blur();
              }
            }}
            placeholder={`Reply to ${f.who === 'You' ? 'the thread' : (firstName(f.who) ?? 'the thread')}…`}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-micro focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-500/40 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
          />
          <div className="flex items-center justify-between gap-2">
            {failed === 'reply' ? (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                Couldn’t send your reply. Try again.
              </p>
            ) : (
              <span
                aria-hidden
                className="text-xs text-slate-500 dark:text-slate-400 [@media(pointer:coarse)]:invisible"
              >
                <kbd className={KBD} aria-hidden>
                  ⌘
                </kbd>
                <kbd className={KBD} aria-hidden>
                  ↵
                </kbd>{' '}
                to send
              </span>
            )}
            <Button
              ref={sendRef}
              type="submit"
              variant="none"
              className={PRIMARY}
              disabled={draft.trim() === ''}
              busy={busy !== null}
            >
              <SendIcon size={14} />
              {busy === 'reply' ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
});

/** Who and why, in a sentence: "Priya mentioned you · 25 mins ago · Task". */
function Byline({ entry, facts: f }: { entry: InboxEntry; facts: EntryFacts }) {
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
        </>
      ) : null}
    </p>
  );
}

const siteKindLower = (e: InboxEntry) => kindWords(e.row.app).lowerOne;

const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

function Body({
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
