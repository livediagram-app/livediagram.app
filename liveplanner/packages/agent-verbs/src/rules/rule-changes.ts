// Changing a plan's rules, in order (docs/specs/026-plan/automations.md "Agents and the CLI"): add, set, on, off,
// duplicate, delete, test and run, each against the rules as the ones before it left them, a refusal stopping the rest
// and saying what was applied before it. The MCP's change_rules and the CLI's `rule` verbs share this.
import type { ApiClient } from '@liveworkspace/api-client';
import type {
  AutomationListedRule,
  AutomationRuleResponse,
  AutomationRunResponse,
  ItemsResponse,
} from '@liveplanner/api-schema';
import { resolveItem, type AutomationRuleBody, type Item } from '@liveplanner/items';
import { itemsPath } from '../verbs/shared';
import { listedRun, resolveRule, runResultWords, type ListedRun } from './rule-listing';
import { namedRuleBody } from './rule-names';
import { ruleRefusalOf, type RuleRefusal } from './rule-refusals';
import { rulesPath, type RulesState } from './rule-state';

// A rule's body as an agent writes it: the api's AutomationRuleBody, its parts named as the board shows them, the
// conditions, steps, chain and time zone optional (an empty list, off, UTC). Loose: the api's readRuleBody checks it.
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
  | { op: 'test'; rule: string | RuleBodyInput; card: string }
  | { op: 'run'; rule: string; card: string };

// The time zone an agent's rule takes when it names none (spec "Whose time it is").
export const AGENT_RULE_TIME_ZONE = 'UTC';

export type RuleChangesResult = { applied: string[]; runs: ListedRun[]; refusal?: RuleRefusal };

const stop = (code: string, message: string): never => {
  throw Object.assign(new Error(message), { stopCode: code });
};

const bodyOf = (r: AutomationRuleBody): RuleBodyInput => ({
  name: r.name,
  trigger: r.trigger,
  conditions: r.conditions,
  steps: r.steps,
  chain: r.chain,
  timeZone: r.timeZone,
});

// A body's own parts, as given: anything else it holds (list_rules' id, enabled, made and edited, when a rule read
// back is written back) is left out, so the api never sees it (spec "A rule read back writes back").
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

const onOff = (r: AutomationListedRule) => (r.enabled ? 'on' : 'off');
const attention = (r: AutomationListedRule) =>
  r.needs.length ? `, needs attention: ${r.needs.join('; ')}` : '';

/** Applies `changes` in order; a refusal stops the rest. Each write's answer replaces the rule in the state. */
export async function applyRuleChanges(
  api: ApiClient,
  projectId: string,
  changes: readonly RuleChange[],
  state: RulesState,
): Promise<RuleChangesResult> {
  const applied: string[] = [];
  const runs: ListedRun[] = [];
  let rules = [...state.list.rules];
  let items: Item[] | null = null;
  const base = rulesPath(projectId);
  const send = <T>(path: string, method: string, body?: unknown) =>
    api.json<T>(`${base}${path}`, {
      method,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const held = (ref: string) => {
    const found = resolveRule(ref, rules);
    return found.ok ? found.rule : stop(found.code, found.message);
  };
  const keep = (rule: AutomationListedRule) => {
    const at = rules.findIndex((r) => r.id === rule.id);
    rules = at < 0 ? [...rules, rule] : rules.map((r, i) => (i === at ? rule : r));
    return rule;
  };
  const card = async (ref: string) => {
    items ??= (await api.json<ItemsResponse>(itemsPath(projectId))).items;
    const found = resolveItem(ref, items);
    return found.ok ? found.item : stop(found.code, found.message);
  };
  const tried = (verb: string, name: string, c: Item, run: AutomationRunResponse['run']) => {
    runs.push(listedRun(run));
    applied.push(`${verb} "${name}" on #${c.key}: ${runResultWords(run)}`);
  };
  for (const change of changes) {
    try {
      switch (change.op) {
        case 'add': {
          const body = namedRuleBody(fullBody(change.rule), state);
          const { rule } = await send<AutomationRuleResponse>('', 'POST', body);
          keep(rule);
          applied.push(`+ rule ${rule.id} "${rule.name}" (${onOff(rule)})${attention(rule)}`);
          break;
        }
        case 'set': {
          const { op: _op, rule: ref, ...parts } = change;
          const r = held(ref);
          const body = namedRuleBody({ ...bodyOf(r), ...bodyParts(parts) }, state);
          const { rule } = await send<AutomationRuleResponse>(
            `/${encodeURIComponent(r.id)}`,
            'PUT',
            body,
          );
          keep(rule);
          applied.push(`~ rule "${rule.name}" changed (${onOff(rule)})${attention(rule)}`);
          break;
        }
        case 'on':
        case 'off': {
          const r = held(change.rule);
          const { rule } = await send<AutomationRuleResponse>(
            `/${encodeURIComponent(r.id)}/toggle`,
            'POST',
            { enabled: change.op === 'on' },
          );
          keep(rule);
          applied.push(`~ rule "${rule.name}" ${onOff(rule)}`);
          break;
        }
        case 'duplicate': {
          const r = held(change.rule);
          const { rule } = await send<AutomationRuleResponse>(
            `/${encodeURIComponent(r.id)}/duplicate`,
            'POST',
          );
          keep(rule);
          applied.push(`+ rule ${rule.id} "${rule.name}" (off, a copy of "${r.name}")`);
          break;
        }
        case 'delete': {
          const r = held(change.rule);
          await api.text(`${base}/${encodeURIComponent(r.id)}`, { method: 'DELETE' });
          rules = rules.filter((x) => x.id !== r.id);
          applied.push(`- rule "${r.name}"`);
          break;
        }
        case 'test': {
          const saved = typeof change.rule === 'string' ? held(change.rule) : null;
          const body = saved
            ? bodyOf(saved)
            : namedRuleBody(fullBody(change.rule as RuleBodyInput), state);
          const c = await card(change.card);
          const { run } = await send<AutomationRunResponse>('/test', 'POST', {
            rule: body,
            item: c.id,
            ...(saved ? { ruleId: saved.id } : {}),
          });
          tried('? tested', body.name, c, run);
          break;
        }
        case 'run': {
          const r = held(change.rule);
          const c = await card(change.card);
          const { run } = await send<AutomationRunResponse>(
            `/${encodeURIComponent(r.id)}/run`,
            'POST',
            { item: c.id },
          );
          tried('> ran', r.name, c, run);
          break;
        }
      }
    } catch (err) {
      const code = (err as { stopCode?: string }).stopCode;
      if (code) return { applied, runs, refusal: { code, message: (err as Error).message } };
      const refusal = ruleRefusalOf(err);
      if (!refusal) throw err;
      return { applied, runs, refusal };
    }
  }
  return { applied, runs };
}
