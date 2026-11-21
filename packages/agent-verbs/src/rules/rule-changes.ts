// Changing an item's rules, in order (liveworkspace/docs/specs/018-automations/automations.md "Agents"): add, set,
// on, off, duplicate, delete, test and run, each against the rules as the ones before it left them, a refusal
// stopping the rest and saying what was applied before it. The MCP's change_rules and the CLI's `rule` verbs share
// this. The api's check (readItemRule over the product's kinds) is the one check of a body.
import type { ApiClient } from '@liveworkspace/api-client';
import type {
  AutomationRuleResponse,
  AutomationRunResponse,
} from '@liveworkspace/api-schema/automations';
import type { ItemRef, ItemRule, ItemRun } from '@liveworkspace/automations/item';
import {
  listedRun,
  resolveRule,
  resolveRuleTab,
  runResultWords,
  type Found,
  type ListedRun,
} from './rule-listing';
import { namedRuleBody } from './rule-names';
import type { RuleRefusal } from './rule-refusals';
import type { ItemListedRule, ItemRulesList } from './rule-state';

// A rule's body as an agent writes it: the engine's rule body, its tabs and people by id or name, the conditions,
// steps, chain and time zone optional (none, off, UTC). Loose: the api's check reads it.
type Part = { kind: string; [key: string]: unknown };
export type RuleBodyInput = {
  name: string;
  trigger: Part;
  conditions?: Part[];
  steps?: Part[];
  chain?: boolean;
  timeZone?: string;
};

type RuleParts = Partial<RuleBodyInput>;

export type RuleChange =
  | { op: 'add'; rule: RuleBodyInput }
  | ({ op: 'set'; rule: string } & RuleParts)
  | { op: 'on' | 'off' | 'delete' | 'duplicate'; rule: string }
  | { op: 'test'; rule: string | RuleBodyInput; tab?: string }
  | { op: 'run'; rule: string; tab?: string };

// The time zone an agent's rule takes when it names none.
export const AGENT_RULE_TIME_ZONE = 'UTC';

export type RuleChangesResult = { applied: string[]; runs: ListedRun[]; refusal?: RuleRefusal };

class Stop extends Error {
  readonly refusal: RuleRefusal;
  constructor(refusal: RuleRefusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

const held = <T>(found: Found<T>): T => {
  if (!found.ok) throw new Stop({ code: found.code, message: found.message });
  return found.value;
};

const bodyOf = (r: ItemRule): RuleBodyInput => ({
  name: r.name,
  trigger: r.trigger,
  conditions: r.conditions,
  steps: r.steps,
  chain: r.chain,
  timeZone: r.timeZone,
});

// A body's own parts, as given: anything else it holds (list_rules' id, enabled, made and edited, when a rule read
// back is written back) is left out, so the api never sees it.
const bodyParts = (b: RuleParts): RuleParts => ({
  ...(b.name !== undefined ? { name: b.name } : {}),
  ...(b.trigger !== undefined ? { trigger: b.trigger } : {}),
  ...(b.conditions !== undefined ? { conditions: b.conditions } : {}),
  ...(b.steps !== undefined ? { steps: b.steps } : {}),
  ...(b.chain !== undefined ? { chain: b.chain } : {}),
  ...(b.timeZone !== undefined ? { timeZone: b.timeZone } : {}),
});

const fullBody = (b: RuleBodyInput): RuleBodyInput => ({
  conditions: [],
  steps: [],
  chain: false,
  timeZone: AGENT_RULE_TIME_ZONE,
  ...(bodyParts(b) as RuleBodyInput),
});

const onOff = (r: ItemListedRule) => (r.enabled ? 'on' : 'off');
const attention = (r: ItemListedRule) =>
  r.needs.length ? `, needs attention: ${r.needs.join('; ')}` : '';

export type RuleChangesInput = {
  api: ApiClient;
  // The item's rules path (rulesPathOf).
  base: string;
  // The rules list this call read: its rules, tabs and people.
  list: ItemRulesList;
  // What the product calls the item, for a refusal's words.
  word: string;
  ruleRefusalOf: (err: unknown) => RuleRefusal | null;
};

/** Applies `changes` in order; a refusal stops the rest. Each write's answer replaces the rule it held. */
export async function applyRuleChanges(
  input: RuleChangesInput,
  changes: readonly RuleChange[],
): Promise<RuleChangesResult> {
  const { api, base, list, word } = input;
  const applied: string[] = [];
  const runs: ListedRun[] = [];
  let rules = [...list.rules];
  const tabs = list.tabs ?? [];
  const send = <T>(path: string, method: string, body?: unknown) =>
    api.json<T>(`${base}${path}`, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const ruleOf = (ref: string) => held(resolveRule(ref, rules, word));
  const tabOf = (ref: string | undefined) =>
    ref === undefined ? undefined : held(resolveRuleTab(ref, tabs));
  const at = (id: string) => `/${encodeURIComponent(id)}`;
  const keep = (rule: ItemListedRule) => {
    const i = rules.findIndex((r) => r.id === rule.id);
    rules = i < 0 ? [...rules, rule] : rules.map((r, j) => (j === i ? rule : r));
    return rule;
  };
  const write = async (path: string, method: string, body?: unknown) =>
    keep((await send<AutomationRuleResponse<ItemRule, ItemRef>>(path, method, body)).rule);
  const tried = (verb: string, name: string, tab: { name: string } | undefined, run: ItemRun) => {
    runs.push(listedRun(run));
    applied.push(`${verb} "${name}"${tab ? ` on tab "${tab.name}"` : ''}: ${runResultWords(run)}`);
  };
  for (const change of changes) {
    try {
      switch (change.op) {
        case 'add': {
          const rule = await write('', 'POST', namedRuleBody(fullBody(change.rule), list));
          applied.push(`+ rule ${rule.id} "${rule.name}" (${onOff(rule)})${attention(rule)}`);
          break;
        }
        case 'set': {
          const { op: _op, rule: ref, ...parts } = change;
          const r = ruleOf(ref);
          const body = namedRuleBody({ ...bodyOf(r), ...bodyParts(parts) }, list);
          const rule = await write(at(r.id), 'PUT', body);
          applied.push(`~ rule "${rule.name}" changed (${onOff(rule)})${attention(rule)}`);
          break;
        }
        case 'on':
        case 'off': {
          const r = ruleOf(change.rule);
          const rule = await write(`${at(r.id)}/toggle`, 'POST', { enabled: change.op === 'on' });
          applied.push(`~ rule "${rule.name}" ${onOff(rule)}`);
          break;
        }
        case 'duplicate': {
          const r = ruleOf(change.rule);
          const rule = await write(`${at(r.id)}/duplicate`, 'POST');
          applied.push(`+ rule ${rule.id} "${rule.name}" (off, a copy of "${r.name}")`);
          break;
        }
        case 'delete': {
          const r = ruleOf(change.rule);
          await api.text(`${base}${at(r.id)}`, { method: 'DELETE' });
          rules = rules.filter((x) => x.id !== r.id);
          applied.push(`- rule "${r.name}"`);
          break;
        }
        case 'test': {
          const body =
            typeof change.rule === 'string'
              ? bodyOf(ruleOf(change.rule))
              : namedRuleBody(fullBody(change.rule), list);
          const tab = tabOf(change.tab);
          const { run } = await send<AutomationRunResponse<ItemRun>>('/test', 'POST', {
            rule: body,
            ...(tab ? { tab: tab.id } : {}),
          });
          tried('? tested', body.name, tab, run);
          break;
        }
        case 'run': {
          const r = ruleOf(change.rule);
          const tab = tabOf(change.tab);
          const { run } = await send<AutomationRunResponse<ItemRun>>(`${at(r.id)}/run`, 'POST', {
            ...(tab ? { tab: tab.id } : {}),
          });
          tried('> ran', r.name, tab, run);
          break;
        }
      }
    } catch (err) {
      if (err instanceof Stop) return { applied, runs, refusal: err.refusal };
      const refusal = input.ruleRefusalOf(err);
      if (!refusal) throw err;
      return { applied, runs, refusal };
    }
  }
  return { applied, runs };
}
