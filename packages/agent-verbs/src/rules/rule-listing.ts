// A rule and a run as agents read them (liveworkspace/docs/specs/018-automations/automations.md "Agents"): the Rules
// list's line (its sentence in the kinds' own words, on, paused, needs attention, last run, this week, next run) and
// the Audit Trail's row with its step lines. A rule is named by its id or its exact name (case aside). Pure.
import {
  itemRuleSentence,
  sentenceText,
  type ItemKinds,
  type ItemNames,
  type ItemRun,
} from '@liveworkspace/automations/item';
import type { AutomationStepLine } from '@liveworkspace/automations';
import type { ItemListedRule, ItemRulesList, RuleProduct } from './rule-state';

const iso = (ms: number) => new Date(ms).toISOString();

export type ListedRule = {
  id: string;
  name: string;
  on: boolean;
  // Why it turned itself off, when it did.
  paused?: string;
  // What it names that the item lacks, or has still to pick.
  needsAttention?: string[];
  trigger: string;
  sentence: string;
  lastRun: string | null;
  runsThisWeek: number;
  // A time trigger's next moment (null while it is off).
  nextRun?: string | null;
  // An Incoming Webhook rule's address, and whether its secret is made (never the secret).
  hook?: { url: string; secret: boolean };
};

export type ListedStamp = { by: string; at: string; ai?: true };

// A rule whole, as change_rules writes it, with who made and last changed it.
export type ListedRuleBody = Pick<
  ItemListedRule,
  'id' | 'name' | 'enabled' | 'trigger' | 'conditions' | 'steps' | 'chain' | 'timeZone'
> & { made: ListedStamp; edited: ListedStamp };

export type ListedRun = {
  id: string;
  rule: string;
  // The tab it ran about, by name, or null for the item alone.
  tab: string | null;
  at: string;
  result: ItemRun['result'];
  reason?: string;
  tookMs: number;
  steps: string[];
};

/** What the rules' words name things by: the list's tabs and people, and the product's templates. */
export function ruleNamesOf(
  list: Pick<ItemRulesList, 'tabs' | 'people'>,
  binding: Pick<RuleProduct, 'kinds'> & { templateNames?: ReadonlyMap<string, string> },
): ItemNames {
  return {
    itemWord: binding.kinds.itemWord,
    tabs: new Map((list.tabs ?? []).map((t) => [t.id, t.name])),
    people: new Map((list.people ?? []).map((p) => [p.id, p.name])),
    ...(binding.templateNames ? { templates: binding.templateNames } : {}),
  };
}

export function listedRule(rule: ItemListedRule, kinds: ItemKinds, names: ItemNames): ListedRule {
  const time = kinds.trigger(rule.trigger.kind)?.time === true;
  return {
    id: rule.id,
    name: rule.name,
    on: rule.enabled,
    ...(rule.paused ? { paused: rule.paused.reason } : {}),
    ...(rule.needs.length ? { needsAttention: rule.needs } : {}),
    trigger: rule.trigger.kind,
    sentence: sentenceText(itemRuleSentence(rule, kinds, names)),
    lastRun: rule.stats.lastRunAt === null ? null : iso(rule.stats.lastRunAt),
    runsThisWeek: rule.stats.runsThisWeek,
    ...(time ? { nextRun: rule.stats.nextAt ? iso(rule.stats.nextAt) : null } : {}),
    ...(rule.hook ? { hook: { url: rule.hook.url, secret: rule.hook.secret !== null } } : {}),
  };
}

const stampOf = (s: ItemListedRule['made']): ListedStamp => ({
  by: s.by.name,
  at: iso(s.at),
  ...(s.ai ? { ai: true as const } : {}),
});

export function listedRuleBody(rule: ItemListedRule): ListedRuleBody {
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

export function listedRun(run: ItemRun): ListedRun {
  return {
    id: run.id,
    rule: run.ruleName,
    tab: run.subject ? run.subject.title : null,
    at: iso(run.at),
    result: run.result,
    ...(run.reason ? { reason: run.reason } : {}),
    tookMs: run.tookMs,
    steps: run.steps.map(stepLine),
  };
}

const RESULT_WORDS: Readonly<Record<ItemRun['result'], string>> = {
  done: 'Done',
  no_match: 'No Match',
  skipped: 'Skipped',
  failed: 'Failed',
  waiting: 'Waiting',
};

/** A run's result as the Audit Trail's pill says it, with its reason. */
export const runResultWords = (run: Pick<ItemRun, 'result' | 'reason'>): string =>
  `${RESULT_WORDS[run.result]}${run.reason ? ` (${run.reason})` : ''}`;

export type Found<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

// How many of a list a refusal names.
const NAMED_MAX = 10;

/** The one of `list` that `ref` names: its id, else its exact name (case and outer spaces aside). */
export function findNamed<T extends { id: string; name: string }>(
  ref: string,
  list: readonly T[],
): T | undefined {
  const want = ref.trim();
  const lower = want.toLowerCase();
  return list.find((x) => x.id === want) ?? list.find((x) => x.name.toLowerCase() === lower);
}

/** `list`'s first few as a refusal names them: `id "Name"; …`. */
export const namedList = (list: readonly { id: string; name: string }[]): string =>
  `${list
    .slice(0, NAMED_MAX)
    .map((x) => `${x.id} "${x.name}"`)
    .join('; ')}${list.length > NAMED_MAX ? '; …' : ''}`;

/** The rule `ref` names, or a refusal naming the rules there are. */
export function resolveRule(
  ref: string,
  rules: readonly ItemListedRule[],
  word: string,
): Found<ItemListedRule> {
  const found = findNamed(ref, rules);
  if (found) return { ok: true, value: found };
  return {
    ok: false,
    code: 'rule_unknown',
    message: rules.length
      ? `No rule "${ref}". The rules: ${namedList(rules)}`
      : `No rule "${ref}": this ${word} has no rules. Add one with add.`,
  };
}

/** The tab `ref` names, or a refusal naming the tabs there are. */
export function resolveRuleTab(
  ref: string,
  tabs: readonly { id: string; name: string }[],
): Found<{ id: string; name: string }> {
  const found = findNamed(ref, tabs);
  if (found) return { ok: true, value: found };
  return {
    ok: false,
    code: 'tab_unknown',
    message: tabs.length
      ? `No tab "${ref}". The tabs: ${namedList(tabs)}`
      : `No tab "${ref}": list_rules lists the tabs.`,
  };
}
