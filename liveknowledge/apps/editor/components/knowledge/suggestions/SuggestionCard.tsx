'use client';

// One suggested edit, as the page's popover and phone sheet show it (docs/specs/030-knowledgebase/insights.md "On
// the page"): who suggested it and when, why, the lines it takes out and puts in, and Accept, Show in Page and Dismiss
// for an Editor, with "Stays Verified" (accepting never unverifies the page). A passage no longer in the page says so
// and offers no Show in Page. Everyone else reads it, with no verbs.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { Button, Tooltip } from '@liveknowledge/ui';
import { relativeSince } from '@/lib/relative-time';
import { SuggestionChange } from './SuggestionChange';
import { CheckIcon, CloseIcon, NextIcon, PrevIcon } from './suggestion-icons';

export type SuggestionCardProps = {
  suggestion: KnowledgeSuggestion;
  now: number;
  canDecide: boolean;
  /** The page has changed since: its passage is not in the page. */
  missing: boolean;
  /** The page is Verified, so accepting keeps it so. */
  verified: boolean;
  accepting: boolean;
  dismissing: boolean;
  /** "1 of 3", when the page has more than one. */
  position?: { at: number; of: number; onPrev: () => void; onNext: () => void } | undefined;
  onAccept: () => void;
  onShow: () => void;
  onDismiss: () => void;
  onClose: () => void;
};

const NAV =
  'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-40 phone:h-11 phone:w-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function SuggestionCard({
  suggestion,
  now,
  canDecide,
  missing,
  verified,
  accepting,
  dismissing,
  position,
  onAccept,
  onShow,
  onDismiss,
  onClose,
}: SuggestionCardProps) {
  const initial = (suggestion.agent.trim()[0] ?? 'A').toUpperCase();
  const busy = accepting || dismissing;
  return (
    <div data-suggestion-card={suggestion.id} className="text-[13px] leading-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200"
        >
          <span className="text-optical-centre">{initial}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">
            Suggested by {suggestion.agent}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {relativeSince(suggestion.createdAt, now)}
          </p>
        </div>
        {position && position.of > 1 ? (
          <div className="flex items-center gap-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
            <Tooltip label="Previous Suggestion">
              <button
                type="button"
                aria-label="Previous Suggestion"
                className={NAV}
                disabled={position.at === 0}
                onClick={position.onPrev}
              >
                <PrevIcon />
              </button>
            </Tooltip>
            <span>
              {position.at + 1} of {position.of}
            </span>
            <Tooltip label="Next Suggestion">
              <button
                type="button"
                aria-label="Next Suggestion"
                className={NAV}
                disabled={position.at === position.of - 1}
                onClick={position.onNext}
              >
                <NextIcon />
              </button>
            </Tooltip>
          </div>
        ) : null}
        <Tooltip label="Close">
          <button type="button" aria-label="Close" className={NAV} onClick={onClose}>
            <CloseIcon />
          </button>
        </Tooltip>
      </div>

      {missing ? (
        <p
          data-suggestion-missing=""
          className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
        >
          The page has changed since. This passage is no longer in it, so the edit cannot be shown
          in place.
        </p>
      ) : null}

      {suggestion.reason ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Why: </span>
          <span className="whitespace-pre-wrap break-words">{suggestion.reason}</span>
        </div>
      ) : null}

      {suggestion.kind === 'append' ? (
        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
          Added at the End of the Page
        </p>
      ) : null}
      <SuggestionChange suggestion={suggestion} className="mt-2 max-h-64 overflow-y-auto" />

      {canDecide ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="xs"
            busy={accepting}
            disabled={dismissing}
            onClick={onAccept}
            data-suggestion-accept=""
            className="phone:min-h-11"
          >
            Accept
          </Button>
          {missing ? null : (
            <Button
              variant="secondary"
              size="xs"
              disabled={busy}
              onClick={onShow}
              data-suggestion-show=""
              className="phone:min-h-11"
            >
              Show in Page
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            busy={dismissing}
            disabled={accepting}
            onClick={onDismiss}
            data-suggestion-dismiss=""
            className="phone:min-h-11"
          >
            Dismiss
          </Button>
          {verified ? (
            <span
              data-stays-verified=""
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <CheckIcon />
              Stays Verified
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {missing ? null : (
            <Button
              variant="secondary"
              size="xs"
              onClick={onShow}
              data-suggestion-show=""
              className="phone:min-h-11"
            >
              Show in Page
            </Button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            An Editor accepts or dismisses suggested edits.
          </p>
        </div>
      )}
    </div>
  );
}
