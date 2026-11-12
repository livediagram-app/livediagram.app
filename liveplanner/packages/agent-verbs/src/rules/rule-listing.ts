// A rule and a run as agents read them (docs/specs/026-plan/automations.md "Agents and the CLI"): the Rules list's
// line (its sentence in words, on, paused, needs attention, last run, this week, next run) and the Audit Trail's row
// with its step lines. A rule is named by its id or its exact name (case aside). Pure.
import type { AutomationListedRule, AutomationRun } from '@liveplanner/api-schema';
import {
  isTimeTrigger,
  ruleSentence,
  type AutomationRule,
  type AutomationStamp,
  type AutomationStepLine,
  type AutomationTriggerKind,
  type RuleSentenceOutline,
  type RuleSentencePart,
} from '@liveplanner/items';

const iso = (ms: number) => new Date(ms).toISOString();

export type ListedRule = {
  id: string;
  name: string;
  on: boolean;
  // Why it turned itself off, when it did.
  paused?: string;
  // What it names that the plan lacks.
  needsAttention?: string[];
  trigger: AutomationTriggerKind;
  sentence: string;
  lastRun: string | null;
  runsThisWeek: number;
  // A time trigger's next moment (null while it is off).
  nextRun?: string | null;
};

export type ListedStamp = { by: string; at: string; ai?: true };

// A rule whole, as change_rules writes it, with who made and last changed it.
export type ListedRuleBody = Pick<
  AutomationRule,
  'id' | 'name' | 'enabled' | 'trigger' | 'conditions' | 'steps' | 'chain' | 'timeZone'
> & { made: ListedStamp; edited: ListedStamp };

export type ListedRun = {
  id: string;
  rule: string;
  card: string | null;
  at: string;
  result: AutomationRun['result'];
  reason?: string;
  tookMs: number;
  steps: string[];
};

/** The sentence's words and chips as one line: "When Card Moved to Done then Add Label shipped". */
export const sentenceText = (parts: readonly RuleSentencePart[]): string =>
  parts.map((p) => ('word' in p ? p.word : p.chip)).join(' ');

export function listedRule(rule: AutomationListedRule, outline: RuleSentenceOutline): ListedRule {
  return {
    id: rule.id,
    name: rule.name,
    on: rule.enabled,
    ...(rule.paused ? { paused: rule.paused.reason } : {}),
    ...(rule.needs.length ? { needsAttention: rule.needs } : {}),
    trigger: rule.trigger.kind,
    sentence: sentenceText(ruleSentence(rule, outline)),
    lastRun: rule.stats.lastRunAt === null ? null : iso(rule.stats.lastRunAt),
    runsThisWeek: rule.stats.runsThisWeek,
    ...(isTimeTrigger(rule.trigger)
      ? { nextRun: rule.stats.nextAt ? iso(rule.stats.nextAt) : null }
      : {}),
  };
}

const stampOf = (s: AutomationStamp): ListedStamp => ({
  by: s.by.name,
  at: iso(s.at),
  ...(s.ai ? { ai: true as const } : {}),
});

export function listedRuleBody(rule: AutomationRule): ListedRuleBody {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    trigger: rule.trigger,
    conditions: rule.conditions,
    steps: rule.steps,
    chain: rule.chain,
    timeZone: rule.timeZone,
    made: stampOf(rule.made),
    edited: stampOf(rule.edited),
  };
}

// A step line as the Audit Trail shows it: a tick or a cross, then what it found or did.
function stepLine(line: AutomationStepLine): string {
  if (line.kind === 'trigger') return line.text;
  const mark = line.ok ? '✓' : '✗';
  return `${mark} ${line.text}${line.kind === 'action' && line.already ? ' (Already so)' : ''}`;
}

export function listedRun(run: AutomationRun): ListedRun {
  return {
    id: run.id,
    rule: run.ruleName,
    card: run.card ? `#${run.card.key} ${run.card.title}` : null,
    at: iso(run.at),
    result: run.result,
    ...(run.reason ? { reason: run.reason } : {}),
    tookMs: run.tookMs,
    steps: run.steps.map(stepLine),
  };
}

const RESULT_WORDS: Readonly<Record<AutomationRun['result'], string>> = {
  done: 'Done',
  no_match: 'No Match',
  skipped: 'Skipped',
  failed: 'Failed',
  waiting: 'Waiting',
};

/** A run's result as the Audit Trail's pill says it, with its reason. */
export const runResultWords = (run: Pick<AutomationRun, 'result' | 'reason'>): string =>
  `${RESULT_WORDS[run.result]}${run.reason ? ` (${run.reason})` : ''}`;

type Found =
  { ok: true; rule: AutomationListedRule } | { ok: false; code: string; message: string };

/** The rule `ref` names: its id, else its exact name (case and outer spaces aside). */
export function resolveRule(ref: string, rules: readonly AutomationListedRule[]): Found {
  const want = ref.trim();
  const found =
    rules.find((r) => r.id === want) ??
    rules.find((r) => r.name.toLowerCase() === want.toLowerCase());
  if (found) return { ok: true, rule: found };
  const listed = rules
    .slice(0, 10)
    .map((r) => `${r.id} "${r.name}"`)
    .join('; ');
  return {
    ok: false,
    code: 'rule_unknown',
    message: rules.length
      ? `No rule "${ref}". The rules: ${listed}${rules.length > 10 ? '; …' : ''}`
      : `No rule "${ref}": this plan has no rules. Add one with add.`,
  };
}
