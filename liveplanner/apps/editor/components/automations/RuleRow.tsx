'use client';

// One rule in the Rules list (docs/specs/026-plan/automations.md "The Automations screen"): its switch, its name and
// sentence, Last Run and This Week, and its ⋯ menu. A rule that paused itself is amber, with Paused, the reason and
// Resume (and Fix Webhook, when a webhook it posts through stopped it); one naming something the plan lacks says what,
// in words and never by id ("A column is gone · Someone is gone").
// A time rule that is on says its next moment under Last Run ("Next: Mon 9:00"). Clicking the name or sentence opens
// the builder. On a phone the row stacks: the name, the sentence's trigger, "4 min ago · 38 runs this week", and the
// switch at the right.

import {
  ruleSentence,
  triggerParts,
  type AutomationNeed,
  type RuleSentenceOutline,
} from '@liveplanner/items';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import { Switch, lucideGlyph } from '@liveplanner/ui';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { needsWords } from './needs-words';
import { SentenceChips } from './SentenceChips';
import { RuleMenu } from './RuleMenu';
import { lastRunWords, nextRunWords, runsWords } from './run-words';

const AlertIcon = lucideGlyph(lucideTriangleAlert, 13);

export const RULE_GRID = 'grid grid-cols-[44px_minmax(0,1fr)_120px_96px_40px] gap-3';

export type RuleRowActions = {
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  onDuplicate: () => void;
  onRunLog: () => void;
  onDelete: () => void;
  // Opens the plan's Webhooks dialog, for a rule paused on one.
  onFixWebhook?: (() => void) | undefined;
};

const LINK =
  'touch-target-y relative cursor-pointer rounded font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline dark:text-brand-300 dark:hover:text-brand-200';

function PausedNote({
  rule,
  onResume,
  onFixWebhook,
}: {
  rule: AutomationListedRule;
  onResume: () => void;
  onFixWebhook?: (() => void) | undefined;
}) {
  if (!rule.paused) return null;
  return (
    <span
      data-rule-paused-reason=""
      className="relative z-[1] text-[12px] text-amber-800 dark:text-amber-300"
    >
      Paused after 10 failures in a row: {rule.paused.reason} <span aria-hidden>·</span>{' '}
      {rule.paused.webhook && onFixWebhook ? (
        <>
          <button type="button" className={LINK} onClick={onFixWebhook}>
            Fix Webhook
          </button>{' '}
          <span aria-hidden>·</span>{' '}
        </>
      ) : null}
      <button type="button" className={LINK} onClick={onResume}>
        Resume
      </button>
    </span>
  );
}

function NeedsNote({ attention }: { attention: readonly AutomationNeed[] }) {
  if (attention.length === 0) return null;
  return (
    <span
      data-rule-needs=""
      className="flex items-start gap-1.5 text-[12px] text-amber-800 dark:text-amber-300"
    >
      <span className="mt-0.5 shrink-0">
        <AlertIcon aria-hidden />
      </span>
      <span>
        <span className="font-semibold">Needs Attention:</span> {needsWords(attention)}
      </span>
    </span>
  );
}

function RuleName({ rule, onOpen }: { rule: AutomationListedRule; onOpen: () => void }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {/* The name is the row's way in: its hit area covers the whole cell (the sentence too). */}
      <button
        type="button"
        onClick={onOpen}
        className={`min-w-0 cursor-pointer truncate text-left text-[14px] font-semibold outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand-400/60 ${
          rule.enabled || rule.paused
            ? 'text-slate-900 dark:text-slate-50'
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        {rule.name}
      </button>
      {rule.paused ? (
        <span className="shrink-0 rounded-md bg-amber-100 px-2 py-px text-[12px] font-medium leading-[18px] text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
          Paused
        </span>
      ) : null}
    </span>
  );
}

export function RuleRow({
  rule,
  outline,
  now,
  busy,
  phone,
  actions,
}: {
  rule: AutomationListedRule;
  outline: RuleSentenceOutline;
  now: number;
  // A switch flip on its way to the api.
  busy: boolean;
  phone: boolean;
  actions: RuleRowActions;
}) {
  const quiet = rule.stats.lastRunAt === null || !rule.enabled;
  // A time rule's next moment, while it is on.
  const next =
    rule.enabled && rule.stats.nextAt ? `Next: ${nextRunWords(rule.stats.nextAt, now)}` : null;
  const tone = quiet ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200';
  const paused = !!rule.paused;
  const surface = paused ? 'rounded-lg bg-amber-50 dark:bg-amber-500/10' : '';
  const toggle = (
    <Switch
      size="sm"
      checked={rule.enabled}
      busy={busy}
      label={rule.name}
      onChange={actions.onToggle}
    />
  );
  if (phone)
    return (
      <li
        data-rule-row={rule.id}
        className={`relative flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 ${surface}`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <RuleName rule={rule} onOpen={actions.onOpen} />
          {paused ? (
            <PausedNote
              rule={rule}
              onResume={() => actions.onToggle(true)}
              onFixWebhook={actions.onFixWebhook}
            />
          ) : (
            <>
              <SentenceChips parts={triggerParts(rule.trigger, outline)} />
              <NeedsNote attention={rule.attention} />
              <span className={`text-[12px] ${tone}`}>
                {rule.stats.lastRunAt === null
                  ? 'Never run'
                  : `${lastRunWords(rule.stats.lastRunAt, now)} · ${runsWords(rule.stats.runsThisWeek)} this week`}
                {next ? ` · ${next}` : null}
              </span>
            </>
          )}
        </div>
        <span className="relative z-[1] flex items-center gap-1">
          {toggle}
          <RuleMenu
            name={rule.name}
            onEdit={actions.onOpen}
            onDuplicate={actions.onDuplicate}
            onRunLog={actions.onRunLog}
            onDelete={actions.onDelete}
          />
        </span>
      </li>
    );
  return (
    <li
      data-rule-row={rule.id}
      className={`${RULE_GRID} items-center border-b border-slate-100 px-1 py-3 last:border-b-0 dark:border-slate-800 ${surface}`}
    >
      <span className="flex justify-center">{toggle}</span>
      <div className="relative flex min-w-0 flex-col gap-1.5">
        <RuleName rule={rule} onOpen={actions.onOpen} />
        <SentenceChips parts={ruleSentence(rule, outline)} />
        <NeedsNote attention={rule.attention} />
        <PausedNote
          rule={rule}
          onResume={() => actions.onToggle(true)}
          onFixWebhook={actions.onFixWebhook}
        />
      </div>
      <span className={`flex flex-col gap-0.5 text-[13px] ${tone}`}>
        {lastRunWords(rule.stats.lastRunAt, now)}
        {next ? (
          <span data-rule-next="" className="text-[12px] text-slate-500 dark:text-slate-400">
            {next}
          </span>
        ) : null}
      </span>
      <span className={`text-[13px] tabular-nums ${tone}`}>
        {runsWords(rule.stats.runsThisWeek)}
      </span>
      <span className="flex justify-center">
        <RuleMenu
          name={rule.name}
          onEdit={actions.onOpen}
          onDuplicate={actions.onDuplicate}
          onRunLog={actions.onRunLog}
          onDelete={actions.onDelete}
        />
      </span>
    </li>
  );
}
