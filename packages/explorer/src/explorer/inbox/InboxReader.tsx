'use client';

// The Inbox's reading pane (one-explorer-contracts.md "Inbox"): the row chosen in the list, read in full. Top to
// bottom: where it is (the app's Living Prism, the team glyph, the item › the tab › the element or board), what it
// is as a large title, who and why ("Priya mentioned you · 25 mins ago · Task"), the verbs (Reply, Resolve or Mark
// Done, or Accept and Dismiss on a suggested edit, where this page can carry them out, Open in the app always), the
// item's thumbnail where the host draws one, then the thread, the action's note, the form's responses or the
// suggested change, and a reply field where replying is offered.
//
// Its verbs come from the host (`InboxHost.actions`), asked per row; nothing is offered that the page can't do. On a
// phone and in the editor's panel the pane takes the list's place, with Back.

import { Callout } from '@liveworkspace/ui/callout';
import {
  lazy,
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { APP_KINDS, levelAtLeast } from '@liveworkspace/index-client';
import { BackBar, Button } from '@liveworkspace/ui';
import { HeaderIconButton } from '../../ui/HeaderIconButton';
import type { InboxComment, InboxVerb } from '../../types';
import {
  CheckIcon,
  EyeIcon,
  MarkUnreadIcon,
  OpenIcon,
  ReplyIcon,
  SendIcon,
  TeamIcon,
} from '../../ui/icons';
import { kindWords } from '../../words';
import { siteOf } from '../../words';
import { AppMark } from '../badges';
import { useExplorer } from '../context';
import { ThisBrowserPill } from '../ThisBrowser';
import { entryFacts } from './InboxRows';
import { BoundedCache, itemCache, useSettledRead } from './paneData';
import { firstName, type InboxEntry } from './sections';
import { entryPlace, entryTarget, offeredVerbs } from './inbox-entry-place';
import { Body, Byline } from './InboxReaderBody';
import { AccessRequestFailure, AccessRequestVerbs, useAccessAnswer } from './AccessRequestPane';
import { KBD, PRIMARY, SECONDARY } from './pane-buttons';
import { suggestionOffered } from './suggestion-answer';
import { openInPlace } from './open-in-place';

// A suggested edit's Accept, Dismiss and failure line load only when one is opened, off the Explorer's first load.
const SuggestionActions = lazy(() =>
  import('./SuggestionPane').then((m) => ({ default: m.SuggestionActions })),
);

// Where a row leads lives in ./inbox-entry-place; re-exported so callers' imports stay as they were.
export { entryPlace, entryTarget, offeredVerbs } from './inbox-entry-place';

/** What the Inbox's keyboard asks of the pane. */
export type ReaderHandle = {
  reply: () => boolean;
  primary: () => boolean;
  open: () => void;
  focusTitle: () => void;
};

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
  /** On a phone or in the panel: the pane stands in for the list, with Back. */
  onBack?: () => void;
  /** The row's work was done here (resolved, marked done): it leaves the list. */
  onGone: (key: string) => void;
  announce: (message: string) => void;
  /** The row is unread now: the pane offers Mark Read in place of Mark Unread. */
  unread?: boolean;
  /** Mark Unread or Mark Read (u). */
  onToggleRead?: (entry: InboxEntry) => void;
  /** A verb was done on the row (a reply, a resolve): it reads as read. */
  onActed?: (entry: InboxEntry) => void;
};

export const InboxReader = forwardRef<ReaderHandle, Props>(function InboxReader(
  { entry, onBack, onGone, announce, unread = false, onToggleRead, onActed },
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
  const isThread = entry.kind === 'Thread' || entry.kind === 'CardThread';
  // The item, for its thumbnail where the host draws one, and for the reader's share role on a thread
  // (inbox-reading.md "Share roles"): Reply and Resolve need Participant or more; a Viewer reads it and opens it.
  // Offered while it reads and when the read fails (the app refuses what the role can't do). One read for both.
  const wantsItem = Boolean(renderThumbnail) && !f.local;
  const item = useSettledRead(
    wantsItem || (isThread && !f.local) ? entry.row.itemId : null,
    itemCache(client),
    () =>
      client.getItem(entry.row.itemId).then(
        (r) => r.item,
        () => null,
      ),
  );
  const access = item?.access ?? null;
  const viewOnly = isThread && access !== null && !levelAtLeast(access, 'participate');
  const verbs = !viewOnly ? offeredVerbs(entry, actions?.offers) : [];
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
  // Replies sent from here this visit, shown and counted under the thread until a read of it holds them, even a
  // read that comes back before the app has them (InboxReaderBody `sentMissingFrom`).
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

  // The thread's comments, where the host can read them; keyed by its latest comment, so a new one reads again.
  const loadThread = actions?.loadThread;
  const threadKey =
    isThread && loadThread && target ? `${entry.key}@${entry.at}:${threadBump}` : null;
  const comments = useSettledRead(
    threadKey,
    actions ? threadCache(actions) : new BoundedCache(),
    target && loadThread ? (signal) => loadThread(target, signal) : null,
  );

  // An access request's verbs, the index's own (./AccessRequestPane).
  const accessRequest = entry.kind === 'AccessRequest' ? entry : null;
  const answer = useAccessAnswer({
    entry,
    client,
    onGone,
    announce,
    onTelemetry: inboxHost?.onTelemetry,
  });
  // A suggested edit's Accept and Dismiss, the app's own (./SuggestionPane).
  const suggestion = entry.kind === 'Suggestion' ? entry : null;
  const suggestionVerbs = suggestion !== null && suggestionOffered(entry, actions);
  const suggestionAccept = useRef<(() => Promise<void>) | null>(null);
  const [suggestionFailureSlot, setSuggestionFailureSlot] = useState<HTMLDivElement | null>(null);

  const run = useCallback(
    async (verb: 'resolve' | 'done') => {
      const fn = verb === 'resolve' ? actions?.resolve : actions?.done;
      if (!fn || !target || busy) return;
      setBusy(verb);
      setFailed(null);
      try {
        await fn(target);
        inboxHost?.onTelemetry?.('Resolved', verb === 'resolve' ? 'Thread' : entry.kind);
        onActed?.(entry);
        announce(verb === 'resolve' ? `Resolved ${f.title}` : `Marked ${f.title} done`);
        onGone(entry.key);
      } catch {
        setFailed(verb);
      } finally {
        setBusy(null);
      }
    },
    [actions, target, busy, inboxHost, entry, f.title, announce, onGone, onActed],
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
      onActed?.(entry);
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
        if (accessRequest) {
          void answer.share();
          return true;
        }
        if (suggestionVerbs) {
          void suggestionAccept.current?.();
          return true;
        }
        if (!primaryVerb) return false;
        void run(primaryVerb);
        return true;
      },
      open: () => openRef.current?.closest('a')?.click(),
      focusTitle: () => titleRef.current?.focus(),
    }),
    [canReply, primaryVerb, run, accessRequest, answer, suggestionVerbs],
  );

  // A rule's notice names no team; every other row names its item's.
  const teamId = 'itemTeamId' in entry.row ? entry.row.itemTeamId : null;
  const team = teamId ? teamName(teamId) : null;
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
        <AppMark app={entry.row.app} size={15} />
        {teamId ? (
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
        {onToggleRead ? (
          <span className="ml-auto flex shrink-0 pl-2">
            <HeaderIconButton
              label={unread ? 'Mark Read' : 'Mark Unread'}
              onClick={() => onToggleRead(entry)}
              dataId={unread ? 'inbox-mark-read' : 'inbox-mark-unread'}
            >
              {unread ? <CheckIcon size={15} /> : <MarkUnreadIcon size={15} />}
            </HeaderIconButton>
          </span>
        ) : null}
      </nav>
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        data-inbox-reader-title=""
        className={`font-semibold leading-tight tracking-tight text-slate-900 outline-none dark:text-slate-50 ${onBack ? 'text-xl' : 'text-2xl'}`}
      >
        {f.cardNumber == null ? null : (
          <span className="mr-1.5 font-medium tabular-nums text-slate-400 dark:text-slate-500">
            {f.cardNumber}
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
        {accessRequest ? <AccessRequestVerbs entry={accessRequest} answer={answer} /> : null}
        {suggestion ? (
          <Suspense fallback={null}>
            <SuggestionActions
              entry={suggestion}
              actions={actions}
              onGone={onGone}
              announce={announce}
              onTelemetry={inboxHost?.onTelemetry}
              acceptRef={suggestionAccept}
              failureSlot={suggestionFailureSlot}
            />
          </Suspense>
        ) : null}
        <Link
          href={href}
          onClick={(e) => {
            inboxHost?.onTelemetry?.('Selected', entry.kind);
            // The open item's own place: a page load, or only the address would move (./open-in-place).
            openInPlace(e, href);
          }}
          className={
            canReply || primaryVerb || accessRequest || suggestionVerbs ? SECONDARY : PRIMARY
          }
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
      {viewOnly ? (
        <p
          data-inbox-view-only=""
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
        >
          <EyeIcon size={14} />
          You can view this {kindWords(entry.row.app).lowerOne} but not reply or resolve.
        </p>
      ) : null}
      {accessRequest ? <AccessRequestFailure entry={accessRequest} answer={answer} /> : null}
      {suggestion ? <div ref={setSuggestionFailureSlot} className="contents" /> : null}
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
      <Body entry={entry} facts={f} comments={comments} sent={sent} viewerId={viewerId} />
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
            placeholder={`Reply to ${f.person?.name ? (firstName(f.who) ?? 'the thread') : 'the thread'}…`}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-micro focus-visible:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-500/40 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
          />
          <div className="flex items-center justify-between gap-2">
            {failed === 'reply' ? (
              <Callout tone="error" role="alert">
                Couldn’t send your reply. Try again.
              </Callout>
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
