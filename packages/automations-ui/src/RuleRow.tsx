'use client';

// One rule in the Rules list (liveplanner/docs/specs/026-plan/automations.md "The Automations screen"): its switch, its name and
// sentence, Last Run and This Week, and its ⋯ menu. A rule that paused itself is amber, with Paused, the reason and
// Resume (and Fix Connection, when a connection it posts through stopped it); one naming something the item lacks
// says what, in the app's words and never by id ("A column is gone · Someone is gone"), with the app's own way to
// fix it after them (kit.sentence.NeedsFix).
// A time rule that is on says its next moment under Last Run ("Next: Mon 9:00"). Clicking the name or sentence opens
// the builder. On a phone the row stacks: the name, the sentence's trigger, "4 min ago · 38 runs this week", and the
// switch at the right. A rule the app runs from the list (kit.runRule) shows Run Rule beside its name, and in its menu.

import { accessPauseWords, isAccessPause } from '@liveworkspace/automations/cross-app';
import { AUTOMATION_FAILURES_TO_PAUSE } from '@liveworkspace/automations';
import { Button, Switch, Tooltip, lucideGlyph } from '@liveworkspace/ui';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { useAutomationsKit } from './kit-context';
import { SentenceChips } from './SentenceChips';
import type { ValueLabels } from './value-labels';
import { RuleMenu, RunIcon } from './RuleMenu';
import { lastRunWords, nextRunWords, runsWords } from './run-words';
import type { ListedRule } from './types';

type AutomationListedRule = ListedRule;

const AlertIcon = lucideGlyph(lucideTriangleAlert, 13);

export const RULE_GRID = 'grid grid-cols-[44px_minmax(0,1fr)_120px_96px_40px] gap-3';

export type RuleRowActions = {
  onOpen: () => void;
  // Run Rule, for a rule the app runs from the list (kit.runRule); absent otherwise.
  onRun?: (() => void) | undefined;
  onToggle: (enabled: boolean) => void;
  onDuplicate: () => void;
  // With Pro on: why Duplicate is off (the item holds every rule its tier allows), and why a rule that is off cannot
  // be switched on (it holds more than the tier allows), each said as the control's tooltip.
  duplicateOff?: string | undefined;
  switchOnOff?: string | undefined;
  onRunLog: () => void;
  onDelete: () => void;
  // Opens the screen's Connections tab, for a rule paused on one.
  onFixConnection?: (() => void) | undefined;
  // Saves a rule paused on a step in another app's lost access as the person's own, and turns it on.
  onTakeOver?: (() => void) | undefined;
};

// The row's link: Resume, Fix Connection, and an app's own fix after Needs Attention.
export const RULE_ROW_LINK =
  'touch-target-y relative cursor-pointer rounded font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline dark:text-brand-300 dark:hover:text-brand-200';

function PausedNote({
  rule,
  onResume,
  onFixConnection,
  onTakeOver,
}: {
  rule: AutomationListedRule;
  onResume: () => void;
  onFixConnection?: (() => void) | undefined;
  onTakeOver?: (() => void) | undefined;
}) {
  const { sentence } = useAutomationsKit();
  if (!rule.paused) return null;
  // A step in another app lost its author's access: the rule acts as whoever takes it over.
  if (isAccessPause(rule.paused.reason))
    return (
      <span
        data-rule-paused-reason="access"
        className="relative z-[1] text-[12px] text-amber-800 dark:text-amber-300"
      >
        Paused: {accessPauseWords(rule.paused.reason)}. Its steps in other apps act as{' '}
        {rule.edited.by.name}.{' '}
        {onTakeOver ? (
          <>
            <span aria-hidden>·</span>{' '}
            <button type="button" className={RULE_ROW_LINK} onClick={onTakeOver}>
              Take Over Rule
            </button>
          </>
        ) : null}
      </span>
    );
  return (
    <span
      data-rule-paused-reason=""
      className="relative z-[1] text-[12px] text-amber-800 dark:text-amber-300"
    >
      Paused after {AUTOMATION_FAILURES_TO_PAUSE} failures in a row:{' '}
      {sentence.gone(rule.paused.reason, rule.paused.gone)} <span aria-hidden>·</span>{' '}
      {rule.paused.webhook && onFixConnection ? (
        <>
          <button type="button" className={RULE_ROW_LINK} onClick={onFixConnection}>
            Fix Connection
          </button>{' '}
          <span aria-hidden>·</span>{' '}
        </>
      ) : null}
      <button type="button" className={RULE_ROW_LINK} onClick={onResume}>
        Resume
      </button>
    </span>
  );
}

function NeedsNote({ attention }: { attention: readonly unknown[] }) {
  const { sentence } = useAutomationsKit();
  // The app's own way to fix what it needs, after the words.
  const Fix = sentence.NeedsFix;
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
        <span className="font-semibold">Needs Attention:</span> {sentence.needs(attention)}
        {Fix ? <Fix attention={attention} /> : null}
      </span>
    </span>
  );
}

// Run Rule on the row: above the name's hit area, so it runs the rule and does not open it.
function RunButton({ name, onRun }: { name: string; onRun: () => void }) {
  return (
    <Button
      variant="secondary"
      size="xs"
      data-rule-run=""
      aria-label={`Run Rule: ${name}`}
      className="relative z-[1] shrink-0"
      onClick={onRun}
    >
      <RunIcon size={12} aria-hidden />
      Run Rule
    </Button>
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
  labels,
  now,
  busy,
  phone,
  actions,
}: {
  rule: AutomationListedRule;
  outline: unknown;
  // The app's value labels: a value in a chip reads as its label.
  labels?: ValueLabels | undefined;
  now: number;
  // A switch flip on its way to the api.
  busy: boolean;
  phone: boolean;
  actions: RuleRowActions;
}) {
  const { sentence } = useAutomationsKit();
  // What it needs: the app's own reading over what the screen knows of the item, or the list's.
  const attention = sentence.attention?.(rule, outline) ?? rule.attention;
  const run = actions.onRun ? <RunButton name={rule.name} onRun={actions.onRun} /> : null;
  const quiet = rule.stats.lastRunAt === null || !rule.enabled;
  // A time rule's next moment, while it is on.
  const next =
    rule.enabled && rule.stats.nextAt ? `Next: ${nextRunWords(rule.stats.nextAt, now)}` : null;
  const tone = quiet ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200';
  const paused = !!rule.paused;
  const surface = paused ? 'rounded-lg bg-amber-50 dark:bg-amber-500/10' : '';
  // Off, and the item over its tier's rules: the switch stays off and says why (never a press the api refuses).
  const held = !rule.enabled && actions.switchOnOff ? actions.switchOnOff : null;
  const switchEl = (
    <Switch
      size="sm"
      checked={rule.enabled}
      busy={busy}
      label={rule.name}
      disabled={held !== null}
      onChange={actions.onToggle}
    />
  );
  const toggle = held ? (
    <Tooltip label={held}>
      <span className="inline-flex">{switchEl}</span>
    </Tooltip>
  ) : (
    switchEl
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
              onFixConnection={actions.onFixConnection}
              onTakeOver={actions.onTakeOver}
            />
          ) : (
            <>
              <SentenceChips parts={sentence.trigger(rule.trigger, outline)} labels={labels} />
              <NeedsNote attention={attention} />
              <span className={`text-[12px] ${tone}`}>
                {rule.stats.lastRunAt === null
                  ? 'Never run'
                  : `${lastRunWords(rule.stats.lastRunAt, now)} · ${runsWords(rule.stats.runsThisWeek)} this week`}
                {next ? ` · ${next}` : null}
              </span>
              {run ? <span className="flex">{run}</span> : null}
            </>
          )}
        </div>
        <span className="relative z-[1] flex items-center gap-1">
          {toggle}
          <RuleMenu
            name={rule.name}
            onRun={actions.onRun}
            onEdit={actions.onOpen}
            onDuplicate={actions.onDuplicate}
            duplicateOff={actions.duplicateOff}
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
        {run ? (
          <span className="flex items-center justify-between gap-2">
            <RuleName rule={rule} onOpen={actions.onOpen} />
            {run}
          </span>
        ) : (
          <RuleName rule={rule} onOpen={actions.onOpen} />
        )}
        <SentenceChips parts={sentence.rule(rule, outline)} labels={labels} />
        <NeedsNote attention={attention} />
        <PausedNote
          rule={rule}
          onResume={() => actions.onToggle(true)}
          onFixConnection={actions.onFixConnection}
          onTakeOver={actions.onTakeOver}
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
          onRun={actions.onRun}
          onEdit={actions.onOpen}
          onDuplicate={actions.onDuplicate}
          duplicateOff={actions.duplicateOff}
          onRunLog={actions.onRunLog}
          onDelete={actions.onDelete}
        />
      </span>
    </li>
  );
}
