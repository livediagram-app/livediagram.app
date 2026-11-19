'use client';

// An access request's verbs in the Inbox's reading pane (liveworkspace/docs/specs/004-index/request-access.md "In
// the Inbox"): Share as <the default level> (e), a chevron beside it with the levels the item's app offers, and
// Decline. The index carries both out (`grantAccessRequest`, `declineAccessRequest`), so every page with the Inbox
// offers them; it lists a request only to a manager of its item, and refuses anyone else. Done, the row leaves (the
// pane's `onGone`); a request another manager answered first leaves too; the cap and Archived keep it, saying why.

import { useCallback, useRef, useState } from 'react';
import {
  APP_DEFAULT_LINK_LEVEL,
  APP_LINK_LEVELS,
  IndexError,
  linkLevelOffered,
  type App,
  type IndexClient,
  type Level,
} from '@liveworkspace/index-client';
import { Button, Tooltip } from '@liveworkspace/ui';
import { LEVEL_PASS, levelBlurb } from '../../dialogs/share/parts';
import type { InboxTelemetry } from '../../types';
import { CheckIcon, ChevronDownIcon, CloseIcon, ShareIcon } from '../../ui/icons';
import { PortalMenu } from '../../ui/Menu';
import { firstName, type InboxAccessEntry, type InboxEntry } from './sections';

/** The level a request is shared at with one press: Viewer where the app offers it, else the app's default. */
export const grantLevel = (app: App): Level =>
  linkLevelOffered(app, 'view') ? 'view' : APP_DEFAULT_LINK_LEVEL[app];

type Failure = 'limit' | 'archived' | 'share' | 'decline';

const FAILURE_TEXT = (f: Failure, item: string): string => {
  switch (f) {
    case 'limit':
      return `${item} has as many passes as it can hold. Delete one in Share, then try again.`;
    case 'archived':
      return `Move ${item} out of Archived to share it.`;
    case 'share':
      return 'Couldn’t share it. Try again.';
    case 'decline':
      return 'Couldn’t decline it. Try again.';
  }
};

export type AccessAnswer = {
  busy: 'share' | 'decline' | null;
  failed: Failure | null;
  share: (level?: Level) => Promise<void>;
  decline: () => Promise<void>;
};

/** Sharing and declining one request. `onGone` takes the row out; `announce` speaks the outcome. Any other row on
 *  show (the pane is one component patched in place) does nothing. */
export function useAccessAnswer({
  entry,
  client,
  onGone,
  announce,
  onTelemetry,
}: {
  entry: InboxEntry;
  client: IndexClient;
  onGone: (key: string) => void;
  announce: (message: string) => void;
  onTelemetry?: InboxTelemetry;
}): AccessAnswer {
  const [state, setState] = useState<{
    key: string;
    busy: AccessAnswer['busy'];
    failed: Failure | null;
  }>({ key: entry.key, busy: null, failed: null });
  // A new row on show: no stale press or error (the pane is patched in place).
  const held = state.key === entry.key ? state : { key: entry.key, busy: null, failed: null };
  const busyRef = useRef(false);
  const r = entry.kind === 'AccessRequest' ? entry.row : null;
  const who = firstName(r?.requesterName) ?? 'them';
  const item = r?.itemTitle || 'Untitled';
  const itemId = r?.itemId ?? null;
  const requestId = r?.id ?? null;
  const app = r?.app ?? null;

  const answer = useCallback(
    async (verb: 'share' | 'decline', level: Level) => {
      if (busyRef.current || !itemId || !requestId) return;
      busyRef.current = true;
      const key = entry.key;
      setState({ key, busy: verb, failed: null });
      try {
        if (verb === 'share') {
          await client.grantAccessRequest(itemId, requestId, { level });
          onTelemetry?.('Resolved', 'AccessGranted');
          announce(`Shared ${item} with ${who} as ${LEVEL_PASS[level].title}`);
        } else {
          await client.declineAccessRequest(itemId, requestId);
          onTelemetry?.('Resolved', 'AccessDeclined');
          announce(`Declined ${who === 'them' ? 'the' : `${who}’s`} request`);
        }
        setState({ key, busy: null, failed: null });
        onGone(key);
      } catch (e) {
        const code = e instanceof IndexError ? e.code : null;
        if (code === 'access_request_not_found') {
          // Another manager answered first: nothing is left to do here.
          announce('Already answered');
          setState({ key, busy: null, failed: null });
          onGone(key);
        } else {
          const failed: Failure =
            code === 'share_link_limit'
              ? 'limit'
              : code === 'archived'
                ? 'archived'
                : verb === 'share'
                  ? 'share'
                  : 'decline';
          setState({ key, busy: null, failed });
        }
      } finally {
        busyRef.current = false;
      }
    },
    [client, itemId, requestId, entry.key, item, who, announce, onGone, onTelemetry],
  );

  const share = useCallback(
    (level?: Level) => answer('share', level ?? (app ? grantLevel(app) : 'view')),
    [answer, app],
  );
  const decline = useCallback(() => answer('decline', 'view'), [answer]);
  return { busy: held.busy, failed: held.failed, share, decline };
}

const KBD =
  'ml-1 inline-flex min-w-[1.25rem] [@media(pointer:coarse)]:hidden items-center justify-center rounded border border-current/25 px-1 font-sans text-[10px] font-medium leading-4 opacity-70';
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60';
// The split button's halves: one brand pill, the chevron set off by a hairline.
const HALF = `inline-flex min-h-9 cursor-pointer items-center gap-1.5 bg-brand-700 text-sm font-medium text-white transition-colors duration-micro hover:bg-brand-800 active:bg-brand-900 motion-reduce:transition-none dark:bg-brand-600 dark:hover:bg-brand-500 dark:active:bg-brand-700 max-md:min-h-11 ${FOCUS}`;
const SECONDARY = `inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors duration-micro hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:active:bg-slate-600 max-md:min-h-11 ${FOCUS}`;

/** Share as <level> with its level menu, and Decline, for the pane's verbs row. */
export function AccessRequestVerbs({
  entry,
  answer,
}: {
  entry: InboxAccessEntry;
  answer: AccessAnswer;
}) {
  const app = entry.row.app;
  const level = grantLevel(app);
  const levels = APP_LINK_LEVELS[app];
  const who = firstName(entry.row.requesterName) ?? 'them';
  const [menuOpen, setMenuOpen] = useState(false);
  const chevron = useRef<HTMLButtonElement>(null);
  const working = answer.busy !== null;
  return (
    <>
      <span
        className="inline-flex shrink-0 overflow-hidden rounded-lg shadow-sm"
        data-inbox-access-share=""
      >
        <Tooltip label={`Make a ${LEVEL_PASS[level].title} pass for ${who}`}>
          <Button
            variant="none"
            className={`${HALF} rounded-l-lg pl-3 pr-2.5`}
            aria-keyshortcuts="e"
            // Keeps the keyboard while it works (busy-buttons.md); a failure's alert is then beside it.
            busy={working}
            onClick={() => void answer.share(level)}
          >
            <ShareIcon size={15} />
            {answer.busy === 'share' ? 'Sharing…' : `Share as ${LEVEL_PASS[level].title}`}
            <kbd className={KBD} aria-hidden>
              E
            </kbd>
          </Button>
        </Tooltip>
        {levels.length > 1 ? (
          <Tooltip label="Share at another level">
            <button
              ref={chevron}
              type="button"
              aria-label="Choose the level to share at"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={working}
              data-inbox-access-levels=""
              onClick={() => setMenuOpen((o) => !o)}
              className={`${HALF} border-l border-white/25 px-2`}
            >
              <ChevronDownIcon size={14} />
            </button>
          </Tooltip>
        ) : null}
      </span>
      {menuOpen ? (
        <PortalMenu
          anchor={chevron.current}
          onClose={() => setMenuOpen(false)}
          label="Share at"
          wide
        >
          {levels.map((l) => {
            const pass = LEVEL_PASS[l];
            return (
              <button
                key={l}
                type="button"
                role="menuitem"
                tabIndex={-1}
                data-inbox-access-level={l}
                onClick={() => {
                  setMenuOpen(false);
                  void answer.share(l);
                }}
                className={`flex w-full cursor-pointer items-start gap-2.5 px-3 py-2 text-left outline-none transition-colors duration-micro hover:bg-slate-100 focus-visible:bg-slate-100 motion-reduce:transition-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5 ${pass.solid}`}
                >
                  <pass.Icon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13px] font-semibold ${pass.text}`}>
                    {pass.title}
                  </span>
                  <span className="block text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {levelBlurb(l, app)}
                  </span>
                </span>
                {l === level ? (
                  <span className="mt-1 shrink-0 text-slate-500 dark:text-slate-400">
                    <CheckIcon size={14} />
                    <span className="sr-only">(the default)</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </PortalMenu>
      ) : null}
      <Tooltip label={`Say no. ${who === 'them' ? 'They hear' : `${who} hears`} nothing.`}>
        <Button
          variant="none"
          className={SECONDARY}
          busy={working}
          data-inbox-access-decline=""
          onClick={() => void answer.decline()}
        >
          <CloseIcon size={14} />
          {answer.busy === 'decline' ? 'Declining…' : 'Decline'}
        </Button>
      </Tooltip>
    </>
  );
}

/** Why the last press failed, under the verbs. */
export function AccessRequestFailure({
  entry,
  answer,
}: {
  entry: InboxAccessEntry;
  answer: AccessAnswer;
}) {
  if (!answer.failed) return null;
  return (
    <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
      {FAILURE_TEXT(answer.failed, entry.row.itemTitle || 'This item')}
    </p>
  );
}
