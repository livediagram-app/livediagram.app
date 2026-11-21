'use client';

// A rule as a Participant or a Viewer reads it (liveworkspace/docs/specs/018-automations/automations.md "Who may do
// what"): its name, whether it is on, its trigger in words, its conditions and its steps in order, and who made it
// and when. Read from the api's summary (never the stored rule), by the rule's id or its name. A rule gone says so.
// It opens outside the Automations screen (from what a rule did), so it takes the little it needs as `kit`
// (RuleSummaryKit) instead of the screen's whole kit: the reader's chunk carries no builder.

import { useCallback, useEffect, useId, useState } from 'react';
import type { AutomationRuleSummary, AutomationSummaryLine } from '@liveworkspace/automations';
import {
  Button,
  CompactEmptyState,
  DialogCloseButton,
  formatRelativeTimeShort,
} from '@liveworkspace/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { AutomationRefusal, type AutomationsClient } from './automations-client';
import { BoltIcon, STEP_KIND_TEXT, StepTile, type StepTone } from './glyphs';
import type { AutomationsScope, GlyphType } from './kit';
import { useMinuteClock } from './screen-clock';

export type RuleSummaryScope = AutomationsScope & { tabId: string | null };

/** What the sheet reads of an app. The same object from render to render. */
export type RuleSummaryKit = {
  client: Pick<AutomationsClient, 'summary'>;
  /** The item's word: "plan". */
  item: string;
  /** Under "This Rule Was Deleted": where what it did still shows. */
  goneNote: string;
  /** The label over a time rule's conditions: "For Cards Where". */
  picksLabel: string;
  /** A step's icon, by its line's kind (and a message step's `via`). */
  glyph: (line: AutomationSummaryLine) => GlyphType;
  /** A hook: the app's own clock for "4 min ago". */
  useNow?: () => number;
};

type Read =
  | { state: 'loading' }
  | { state: 'ready'; rule: AutomationRuleSummary }
  | { state: 'gone' }
  | { state: 'failed' };

function useRuleSummary(
  client: RuleSummaryKit['client'],
  scope: RuleSummaryScope,
  ruleId: string | undefined,
  name: string,
) {
  const [answer, setAnswer] = useState<{ key: string; read: Read } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { ownerId, itemId, shareCode, tabId } = scope;
  const key = JSON.stringify([ownerId, itemId, shareCode, tabId, ruleId, name, attempt]);
  useEffect(() => {
    let live = true;
    const settle = (read: Read) => {
      if (live) setAnswer({ key, read });
    };
    client.summary({ ownerId, itemId, shareCode, tabId }, { ruleId, name }).then(
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
  }, [client, key, ownerId, itemId, shareCode, tabId, ruleId, name]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const read: Read = answer?.key === key ? answer.read : { state: 'loading' };
  return { read, retry };
}

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

function ActionLine({
  line,
  kit,
  nested = false,
}: {
  line: AutomationSummaryLine;
  kit: RuleSummaryKit;
  nested?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="pt-0.5">
        <StepTile tone="action" glyph={kit.glyph(line)} size={nested ? 24 : 32} />
      </span>
      <span
        className={`min-w-0 flex-1 break-words text-[13px] text-slate-800 dark:text-slate-100 ${nested ? 'pt-0.5' : 'pt-1.5'}`}
      >
        {line.words}
      </span>
    </div>
  );
}

function Branch({
  label,
  lines,
  kit,
}: {
  label: string;
  lines: readonly AutomationSummaryLine[];
  kit: RuleSummaryKit;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {lines.length ? (
        <ul className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <li key={i}>
              <ActionLine line={l} kit={kit} nested />
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-slate-500 dark:text-slate-400">Nothing</span>
      )}
    </div>
  );
}

function RuleLines({
  rule,
  now,
  kit,
}: {
  rule: AutomationRuleSummary;
  now: number;
  kit: RuleSummaryKit;
}) {
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <ol className="flex flex-col gap-4" aria-label="What this rule does">
        <Row tone="trigger" kind="Trigger" line={rule.trigger} time={rule.picks} />
        {rule.conditions.length ? (
          <Row
            tone="condition"
            kind={rule.picks ? kit.picksLabel : 'Only If'}
            line={rule.conditions.join(' and ')}
          />
        ) : null}
        {rule.steps.map((step, i) => (
          <li key={i} className="flex min-w-0 flex-col gap-2">
            <ActionLine line={step} kit={kit} />
            {step.then ? (
              <div className="ml-4 flex flex-col gap-3 border-l-2 border-slate-100 pl-5 dark:border-slate-800">
                {step.conditions?.length ? (
                  <span className="text-[13px] text-slate-700 dark:text-slate-200">
                    {step.conditions.join(' and ')}
                  </span>
                ) : null}
                <Branch label="Then" lines={step.then} kit={kit} />
                {step.else ? <Branch label="Else" lines={step.else} kit={kit} /> : null}
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
  kit,
  scope,
  ruleId,
  name,
  onClose,
}: {
  kit: RuleSummaryKit;
  scope: RuleSummaryScope;
  ruleId?: string | undefined;
  name: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const { read, retry } = useRuleSummary(kit.client, scope, ruleId, name);
  const clock = kit.useNow ?? useMinuteClock;
  const now = clock();
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
              description={`It’s no longer in this ${kit.item}. ${kit.goneNote}`}
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
            <RuleLines rule={read.rule} now={now} kit={kit} />
          )}
        </div>
      </div>
    </Dialog>
  );
}
