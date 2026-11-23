// What every Automations route of an item shares (blueprint item-engine.md "Routes"): who is calling, the answers'
// shapes, a request's body, and a rule as the Rules list shows it.
import type {
  AutomationError,
  AutomationErrorBody,
  AutomationListedRule,
} from '@liveworkspace/api-schema/automations';
import {
  itemNames,
  needLine,
  ownNeedLine,
  ownRefsOf,
  ruleNeeds,
  ruleSnapshotIds,
  type ItemHave,
  type ItemNames,
  type ItemOutline,
  type ItemRef,
  type ItemRule,
} from '../../item';
import type { KeyAnswer } from '@liveworkspace/ai';
import type { AutomationPerson, AutomationStamp } from '../../types';
import { isObj, type Obj } from '../../validate-read';
import { hookInfos } from '../automation-incoming';
import { ruleStats } from '../automation-log';
import type { ItemEngine } from './engine';
import type { ItemDeps } from './kit';

// Who is calling, as the app's own identity and share checks resolved them.
export interface ItemCaller {
  // An Editor of the whole item (never through a link confined to one tab).
  editor: boolean;
  // Signed in, in person or through their API token: never a guest.
  signedIn: boolean;
  // An API token (an agent), and whether it only reads.
  token?: { readOnly: boolean };
  person: AutomationPerson;
  // May read the item at all (a Participant, a Viewer, a link visitor): a rule's summary is theirs.
  reader: boolean;
  // Asks accounts which AI key applies to this caller in the item's team, with the key (Describe a Rule; ai-keys.md
  // "Every AI feature honours the choice"). Absent, or answering null: no person to ask for, so built-in AI.
  aiKey?: () => Promise<KeyAnswer | null>;
}

export interface ItemRoutesInput {
  engine: ItemEngine;
  method: string;
  // The path after `…/automations`: [] for the list, ['runs'], [ruleId, 'toggle'], …
  segments: readonly string[];
  request: Request;
  url: URL;
  caller: ItemCaller;
}

// A route past the gate.
export interface Gated extends ItemRoutesInput {
  deps: ItemDeps;
  // The caller is an agent: its stamps and its Run Rule say so.
  ai: boolean;
}

export type ItemListedRule = AutomationListedRule<ItemRule, ItemRef>;

// The most of a request's body a route reads.
export const ITEM_ROUTE_BODY_MAX = 256 * 1024;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const noContent = (): Response => new Response(null, { status: 204 });

export const refuse = (
  status: number,
  error: AutomationError,
  more: Omit<AutomationErrorBody, 'error'> = {},
): Response => json({ error, ...more } satisfies AutomationErrorBody, status);

export const notFoundRule = (): Response => refuse(404, 'automation_not_found');

/** The request's JSON object, or the refusal. */
export async function readBody(request: Request): Promise<Obj | Response> {
  const bad = () =>
    refuse(400, 'automation_invalid', { path: 'body', message: 'the body must be a JSON object' });
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > ITEM_ROUTE_BODY_MAX) return bad();
    raw = JSON.parse(text);
  } catch {
    return bad();
  }
  return isObj(raw) ? raw : bad();
}

/** A stamp of the caller now: an agent's says so. */
export const stampOf = (g: Gated): AutomationStamp => ({
  by: g.caller.person,
  at: Date.now(),
  ...(g.ai ? { ai: true as const } : {}),
});

// What the Rules list reads once for every rule it shows.
export interface Listing {
  outline: ItemOutline;
  names: ItemNames;
  have: ItemHave;
  stats: ReturnType<typeof ruleStats>;
  nextAts: ReadonlyMap<string, number>;
  failures: ReadonlyMap<string, number>;
  hooks: ReturnType<typeof hookInfos>;
  // What the item still has of the app's own references the rules name, by field; a field not asked is not checked.
  owns: ReadonlyMap<string, ReadonlySet<string>>;
}

// The parts of a rule that name things.
const partsOf = (rule: ItemRule) => ({
  trigger: rule.trigger,
  conditions: rule.conditions,
  steps: rule.steps,
});

// The app's own references the rules name, asked of the kit a field at a time: nothing is read for an app that
// declares none, or while no rule names one.
async function ownsOf(g: Gated, rules: readonly ItemRule[]): Promise<Listing['owns']> {
  const { kit } = g.deps;
  const owns = new Map<string, ReadonlySet<string>>();
  if (!kit.owns || !kit.kinds.ownRefs) return owns;
  const named = ownRefsOf(rules.map(partsOf), kit.kinds.ownRefs).filter((ref) => ref.id !== '');
  for (const own of kit.kinds.ownRefs) {
    const ids = named.filter((ref) => ref.field === own.field).map((ref) => ref.id);
    if (ids.length > 0) owns.set(own.field, await kit.owns(own.field, ids));
  }
  return owns;
}

// What a rule names of the app's own that is gone or still to pick, as lines.
function ownNeeds(g: Gated, rule: ItemRule, owns: Listing['owns']): string[] {
  const declared = g.deps.kit.kinds.ownRefs;
  if (!declared) return [];
  return ownRefsOf(partsOf(rule), declared).flatMap((ref) => {
    const missing = ref.id === '' || owns.get(ref.field)?.has(ref.id) === false;
    return missing
      ? [
          ownNeedLine(
            declared.find((o) => o.field === ref.field)!,
            ref.id,
          ),
        ]
      : [];
  });
}

/** The item as the list reads it, for `rules`: the snapshots are asked for only when a rule names one. */
export async function listingOf(g: Gated, rules: readonly ItemRule[]): Promise<Listing> {
  const { kit, store } = g.deps;
  const sql = g.deps.sql();
  const outline = await kit.outline();
  const snapshots = ruleSnapshotIds(rules).length > 0 ? await kit.snapshots.list() : null;
  const failures = sql.exec('SELECT id, failures FROM automation_rules').toArray() as unknown as {
    id: string;
    failures: number;
  }[];
  return {
    outline,
    names: itemNames(kit.itemWord, outline),
    have: {
      tab: new Set(outline.tabs.map((t) => t.id)),
      person: new Set(outline.people.map((p) => p.id)),
      ...(snapshots ? { snapshot: new Set(snapshots.map((s) => s.id)) } : {}),
    },
    stats: ruleStats(sql, Date.now()),
    nextAts: store.nextAts(),
    failures: new Map(failures.map((f) => [f.id, Number(f.failures)])),
    hooks: hookInfos((ruleId) => kit.hookUrl(ruleId), sql, rules),
    owns: await ownsOf(g, rules),
  };
}

export function listed(g: Gated, rule: ItemRule, l: Listing): ItemListedRule {
  const stats = l.stats.get(rule.id);
  const hook = l.hooks.get(rule.id);
  const attention = ruleNeeds(rule, l.have);
  return {
    ...rule,
    ...(hook ? { hook } : {}),
    stats: {
      lastRunAt: stats?.lastRunAt ?? null,
      nextAt: g.deps.kit.kinds.trigger(rule.trigger.kind)?.time
        ? (l.nextAts.get(rule.id) ?? null)
        : null,
      runsThisWeek: stats?.runsThisWeek ?? 0,
      failuresInARow: l.failures.get(rule.id) ?? 0,
    },
    needs: [...attention.map(needLine), ...ownNeeds(g, rule, l.owns)],
    attention,
  };
}

export async function answerRule(g: Gated, rule: ItemRule, status = 200): Promise<Response> {
  return json({ rule: listed(g, rule, await listingOf(g, [rule])) }, status);
}
