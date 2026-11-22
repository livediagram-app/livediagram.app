'use client';

// A suggested edit in the Inbox's reading pane (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox",
// "Suggested edits"; liveknowledge's 030-knowledgebase/ai-knowledge.md "Edits suggested by agents"): the agent's
// reason quoted, the change as the lines it removes (struck, rose, a minus) and adds (blue, a plus), and the verbs
// Accept (e) and Dismiss, carried out by the app's own suggestion routes through the host's `InboxActions`. Done, the
// row leaves (the pane's `onGone`) and the pane moves on as after Resolve; refused, the pane says why and the row
// stays. Everything shown is other people's text, drawn as text, never as HTML.

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { Button, Tooltip } from '@liveworkspace/ui';
import { InboxActionError } from '../../inbox-refusal';
import type { InboxActions, InboxTelemetry } from '../../types';
import { CheckIcon, CloseIcon } from '../../ui/icons';
import { KBD, PRIMARY, SECONDARY } from './pane-buttons';
import { entryTarget } from './inbox-entry-place';
import type { InboxEntry, InboxSuggestionEntry } from './sections';
import { suggestionOffered } from './suggestion-answer';

type Verb = 'accept' | 'dismiss';
export type SuggestionFailureKind = 'editor' | 'stale' | Verb;

/** Why a press failed, from what the app answered. */
export function suggestionFailureOf(e: unknown, verb: Verb): SuggestionFailureKind {
  if (e instanceof InboxActionError) {
    if (e.status === 403) return 'editor';
    if (e.status === 409 && e.code === 'suggestion_stale') return 'stale';
  }
  return verb;
}

// The app's answer for a suggestion already accepted or dismissed (in the app, or in another tab): nothing is left to
// do here, so the row leaves.
const isAlreadyAnswered = (e: unknown) =>
  e instanceof InboxActionError && e.status === 404 && e.code === 'suggestion_not_found';

export type SuggestionAnswer = {
  /** Accept and Dismiss are offered on this page: the host's actions carry both out for this row. */
  offered: boolean;
  busy: Verb | null;
  failed: SuggestionFailureKind | null;
  accept: () => Promise<void>;
  dismiss: () => Promise<void>;
};

/** Accepting and dismissing one suggested edit. Any other row on show (the pane is one component patched in place)
 *  does nothing. */
export function useSuggestionAnswer({
  entry,
  actions,
  onGone,
  announce,
  onTelemetry,
}: {
  entry: InboxEntry;
  actions: InboxActions | undefined;
  onGone: (key: string) => void;
  announce: (message: string) => void;
  onTelemetry?: InboxTelemetry;
}): SuggestionAnswer {
  const [state, setState] = useState<{
    key: string;
    busy: Verb | null;
    failed: SuggestionFailureKind | null;
  }>({ key: entry.key, busy: null, failed: null });
  // A new row on show: no stale press or error.
  const held = state.key === entry.key ? state : { key: entry.key, busy: null, failed: null };
  const busyRef = useRef(false);
  const offered = suggestionOffered(entry, actions);
  const page = entry.kind === 'Suggestion' ? entry.row.tabName || 'the page' : '';

  const answer = useCallback(
    async (verb: Verb) => {
      const fn = verb === 'accept' ? actions?.accept : actions?.dismiss;
      const row = entryTarget(entry);
      if (busyRef.current || !offered || !row || !fn) return;
      busyRef.current = true;
      const key = entry.key;
      setState({ key, busy: verb, failed: null });
      try {
        await fn(row);
        onTelemetry?.('Resolved', 'Suggestion');
        announce(verb === 'accept' ? `Accepted the edit to ${page}` : 'Dismissed the edit');
        setState({ key, busy: null, failed: null });
        onGone(key);
      } catch (e) {
        if (isAlreadyAnswered(e)) {
          announce('Already answered');
          setState({ key, busy: null, failed: null });
          onGone(key);
        } else {
          setState({ key, busy: null, failed: suggestionFailureOf(e, verb) });
        }
      } finally {
        busyRef.current = false;
      }
    },
    [actions, offered, entry, page, announce, onGone, onTelemetry],
  );
  const accept = useCallback(() => answer('accept'), [answer]);
  const dismiss = useCallback(() => answer('dismiss'), [answer]);
  return { offered, busy: held.busy, failed: held.failed, accept, dismiss };
}

/** What the pane says when a press fails: the app's 403 (not an Editor), its 409 `suggestion_stale` (the passage
 *  changed since), or anything else. */
export function suggestionFailureText(f: SuggestionFailureKind): string {
  switch (f) {
    case 'editor':
      return 'Only an Editor can accept or dismiss this.';
    case 'stale':
      return 'The page has changed since this was suggested. Open the page to make the change by hand, or dismiss it.';
    case 'accept':
      return 'The edit could not be accepted. Try again.';
    case 'dismiss':
      return 'The edit could not be dismissed. Try again.';
  }
}

/** Accept (e) and Dismiss, for the pane's verbs row. */
export function SuggestionVerbs({
  entry,
  answer,
}: {
  entry: InboxSuggestionEntry;
  answer: SuggestionAnswer;
}) {
  if (!answer.offered) return null;
  const working = answer.busy !== null;
  const page = entry.row.tabName || 'the page';
  return (
    <>
      <Tooltip label={`Make this change to ${page}`}>
        <Button
          variant="none"
          className={PRIMARY}
          aria-keyshortcuts="e"
          // Keeps the keyboard while it works (busy-buttons.md); a failure's alert is then beside it.
          busy={working}
          data-inbox-suggestion-accept=""
          onClick={() => void answer.accept()}
        >
          <CheckIcon size={15} />
          {answer.busy === 'accept' ? 'Accepting…' : 'Accept'}
          <kbd className={KBD} aria-hidden>
            E
          </kbd>
        </Button>
      </Tooltip>
      <Tooltip label={`Leave ${page} as it is`}>
        <Button
          variant="none"
          className={SECONDARY}
          busy={working}
          data-inbox-suggestion-dismiss=""
          onClick={() => void answer.dismiss()}
        >
          <CloseIcon size={14} />
          {answer.busy === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
        </Button>
      </Tooltip>
    </>
  );
}

/** Why the last press failed, under the verbs. */
export function SuggestionFailure({ answer }: { answer: SuggestionAnswer }) {
  if (!answer.failed) return null;
  return (
    <p
      role="alert"
      data-inbox-suggestion-failed={answer.failed}
      className="text-sm text-rose-700 dark:text-rose-300"
    >
      {suggestionFailureText(answer.failed)}
    </p>
  );
}

/** A text's lines, for the change: none for an empty text (an append removes nothing). */
export const changeLines = (text: string): string[] => (text === '' ? [] : text.split(/\r?\n/));

const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
const LINE =
  'grid grid-cols-[1.25rem_minmax(0,1fr)] gap-1 px-2 py-0.5 font-mono text-[13px] leading-6 whitespace-pre-wrap break-words';

/** The pane's body: the agent's reason, then the change. */
export function SuggestionBody({ entry }: { entry: InboxSuggestionEntry }) {
  const r = entry.row;
  const removed = r.kind === 'append' ? [] : changeLines(r.before);
  const added = changeLines(r.after);
  return (
    <div className="flex flex-col gap-3" data-inbox-suggestion="">
      {r.reason.trim() ? (
        <>
          <h3 className={SECTION_LABEL}>Why</h3>
          <blockquote
            data-inbox-suggestion-reason=""
            className="m-0 whitespace-pre-line break-words border-l-2 border-violet-300 pl-3 text-sm leading-6 text-slate-700 dark:border-violet-500/60 dark:text-slate-200"
          >
            {r.reason.trim()}
          </blockquote>
        </>
      ) : null}
      <h3 className={SECTION_LABEL}>
        {r.kind === 'append' ? 'Added at the End of the Page' : 'The Change'}
      </h3>
      <div
        role="group"
        aria-label="The change"
        data-inbox-suggestion-change=""
        className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      >
        {removed.map((line, i) => (
          <p
            key={`r${i}`}
            data-inbox-suggestion-removed=""
            className={`${LINE} m-0 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200`}
          >
            <span aria-hidden className="select-none text-center">
              −
            </span>
            <span className="line-through decoration-rose-400/80">
              <span className="sr-only">Removed: </span>
              {line || ' '}
            </span>
          </p>
        ))}
        {added.map((line, i) => (
          <p
            key={`a${i}`}
            data-inbox-suggestion-added=""
            className={`${LINE} m-0 bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200`}
          >
            <span aria-hidden className="select-none text-center">
              +
            </span>
            <span>
              <span className="sr-only">Added: </span>
              {line || ' '}
            </span>
          </p>
        ))}
        {removed.length + added.length === 0 ? (
          <p className="m-0 px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
            It changes nothing that shows here. Open the page to see it.
          </p>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
        Accepting makes this change on the page. Dismissing leaves the page as it is.
      </p>
    </div>
  );
}

/** A suggested edit's Accept and Dismiss, and why a press failed, all loaded with this file when a suggestion is
 *  opened: the verbs in the pane's verbs row, the failure into the reader's slot under it, and Accept handed to the
 *  reader's `e`. */
export function SuggestionActions({
  entry,
  actions,
  onGone,
  announce,
  onTelemetry,
  acceptRef,
  failureSlot,
}: {
  entry: InboxSuggestionEntry;
  actions: InboxActions | undefined;
  onGone: (key: string) => void;
  announce: (message: string) => void;
  onTelemetry?: InboxTelemetry;
  acceptRef: MutableRefObject<(() => Promise<void>) | null>;
  failureSlot: HTMLElement | null;
}) {
  const answer = useSuggestionAnswer({ entry, actions, onGone, announce, onTelemetry });
  const { accept, offered } = answer;
  useEffect(() => {
    acceptRef.current = offered ? accept : null;
    return () => {
      acceptRef.current = null;
    };
  }, [acceptRef, accept, offered]);
  return (
    <>
      <SuggestionVerbs entry={entry} answer={answer} />
      {failureSlot ? createPortal(<SuggestionFailure answer={answer} />, failureSlot) : null}
    </>
  );
}
