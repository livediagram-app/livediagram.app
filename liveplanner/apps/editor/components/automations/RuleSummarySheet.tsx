'use client';

// A rule as a Participant or a Viewer reads it (docs/specs/026-plan/automations.md "On cards"): opened from the rule's
// name on a card's Activity or a comment, a read-only sheet with the rule's name and whether it is on, then its
// trigger, its conditions and its steps in order on the builder's tinted tiles, and who made it and when. Nothing in it
// changes the rule, runs it or leads to other rules: Close is its only control. What a reader may not see arrives from
// the api as a plain label ("Email 2 Addresses", "Post to Slack", "An AI Step"). A rule gone says This Rule Was Deleted.

import { useCallback, useEffect, useId, useState } from 'react';
import type { AutomationRuleSummary, AutomationSummaryLine } from '@liveplanner/api-schema';
import {
  Button,
  CompactEmptyState,
  DialogCloseButton,
  formatRelativeTimeShort,
} from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useRelativeNow } from '@/lib/relative-time';
import { BoltIcon, STEP_KIND_TEXT, StepTile, type StepTone } from './automation-glyphs';
import { AutomationRefusal, readRuleSummary, type AutomationsScope } from './automations-client';

export type RuleSummaryScope = AutomationsScope & { tabId: string | null };

type Read =
  | { state: 'loading' }
  | { state: 'ready'; rule: AutomationRuleSummary }
  | { state: 'gone' }
  | { state: 'failed' };

// The rule's summary, read on open and on Try Again. Each read is keyed by its ask, so an answer that is not the
// current ask's reads as loading and none is ever shown under the wrong rule.
function useRuleSummary(scope: RuleSummaryScope, ruleId: string | undefined, name: string) {
  const [answer, setAnswer] = useState<{ key: string; read: Read } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { ownerId, projectId, shareCode, tabId } = scope;
  const key = JSON.stringify([ownerId, projectId, shareCode, tabId, ruleId, name, attempt]);
  useEffect(() => {
    let live = true;
    const settle = (read: Read) => {
      if (live) setAnswer({ key, read });
    };
    readRuleSummary({ ownerId, projectId, shareCode, tabId }, { ruleId, name }).then(
      (answer) => settle({ state: 'ready', rule: answer.rule }),
      (error: unknown) =>
        settle(
          error instanceof AutomationRefusal && error.code === 'automation_not_found'
            ? { state: 'gone' }
            : { state: 'failed' },
        ),
    );
    return () => {
      live = false;
    };
  }, [key, ownerId, projectId, shareCode, tabId, ruleId, name]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const read: Read = answer?.key === key ? answer.read : { state: 'loading' };
  return { read, retry };
}

// One row: its tile, its kind ("When", "Only If", "Then") and its words.
function Row({
  tone,
  line,
  kind,
  time = false,
}: {
  tone: StepTone;
  line: string;
  kind: string;
  time?: boolean;
}) {
  return (
    <li className="flex min-w-0 items-start gap-3">
      <span className="pt-0.5">
        <StepTile tone={tone} time={time} />
      </span>
      <span className="min-w-0 flex-1 pt-1">
        <span
          className={`block text-[11px] font-semibold uppercase tracking-wide ${STEP_KIND_TEXT[tone]}`}
        >
          {kind}
        </span>
        <span className="block break-words text-[13px] text-slate-800 dark:text-slate-100">
          {line}
        </span>
      </span>
    </li>
  );
}

// An action: its own tile (an outgoing action's by where it posts, an AI step's sparkle) and its words.
function ActionLine({ line, nested = false }: { line: AutomationSummaryLine; nested?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="pt-0.5">
        <StepTile tone="action" kind={line.kind} via={line.via} size={nested ? 24 : 32} />
      </span>
      <span
        className={`min-w-0 flex-1 break-words text-[13px] text-slate-800 dark:text-slate-100 ${nested ? 'pt-0.5' : 'pt-1.5'}`}
      >
        {line.words}
      </span>
    </div>
  );
}

// An If / Else's or a For Related Cards' own lines, indented under it.
function Branch({ label, lines }: { label: string; lines: readonly AutomationSummaryLine[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {lines.length ? (
        <ul className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <li key={i}>
              <ActionLine line={l} nested />
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-slate-500 dark:text-slate-400">Nothing</span>
      )}
    </div>
  );
}

function RuleLines({ rule, now }: { rule: AutomationRuleSummary; now: number }) {
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <ol className="flex flex-col gap-4" aria-label="What this rule does">
        <Row tone="trigger" kind="Trigger" line={rule.trigger} time={rule.picks} />
        {rule.conditions.length ? (
          <Row
            tone="condition"
            kind={rule.picks ? 'For Cards Where' : 'Only If'}
            line={rule.conditions.join(' and ')}
          />
        ) : null}
        {rule.steps.map((step, i) => (
          <li key={i} className="flex min-w-0 flex-col gap-2">
            <ActionLine line={step} />
            {step.then ? (
              <div className="ml-4 flex flex-col gap-3 border-l-2 border-slate-100 pl-5 dark:border-slate-800">
                {step.conditions?.length ? (
                  <span className="text-[13px] text-slate-700 dark:text-slate-200">
                    {step.conditions.join(' and ')}
                  </span>
                ) : null}
                <Branch label="Then" lines={step.then} />
                {step.else ? <Branch label="Else" lines={step.else} /> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Made by {rule.made.by} · {formatRelativeTimeShort(Math.max(0, now - rule.made.at))}
      </p>
    </div>
  );
}

function OnChip({ rule }: { rule: AutomationRuleSummary }) {
  const on = rule.on && !rule.paused;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-medium ${
        on
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {on ? 'On' : rule.paused ? 'Paused' : 'Off'}
    </span>
  );
}

export function RuleSummarySheet({
  scope,
  ruleId,
  name,
  onClose,
}: {
  scope: RuleSummaryScope;
  ruleId?: string | undefined;
  name: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const { read, retry } = useRuleSummary(scope, ruleId, name);
  const now = useRelativeNow();
  const title = read.state === 'ready' ? read.rule.name : name;
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet className="max-h-[90vh]">
      <div data-rule-summary="" className="flex min-h-0 flex-col">
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 pt-5 pb-4 dark:border-slate-800">
          <span
            aria-hidden
            className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <BoltIcon size={16} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-slate-500 dark:text-slate-400">
              Automation
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <h2
                id={titleId}
                className="min-w-0 break-words text-base font-semibold text-slate-900 dark:text-slate-50"
              >
                {title}
              </h2>
              {read.state === 'ready' ? <OnChip rule={read.rule} /> : null}
            </div>
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 overflow-y-auto">
          {read.state === 'loading' ? (
            <div role="status" aria-label="Loading rule" className="flex flex-col gap-3 px-6 py-5">
              {[0.7, 0.55, 0.62].map((o, i) => (
                <div
                  key={i}
                  style={{ opacity: o }}
                  className="h-10 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
                />
              ))}
            </div>
          ) : read.state === 'gone' ? (
            <CompactEmptyState
              role="status"
              icon={<BoltIcon size={18} />}
              title="This Rule Was Deleted"
              description="It’s no longer in this plan. What it did to this card stays in its Activity."
            />
          ) : read.state === 'failed' ? (
            <CompactEmptyState
              role="status"
              icon={<BoltIcon size={18} />}
              title="Couldn’t Load the Rule"
              description="Check your connection and try again."
              action={
                <Button variant="secondary" size="xs" onClick={retry}>
                  Try Again
                </Button>
              }
            />
          ) : (
            <RuleLines rule={read.rule} now={now} />
          )}
        </div>
      </div>
    </Dialog>
  );
}
