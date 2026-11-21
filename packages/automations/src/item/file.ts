// An item's rules in its export file, and read back from one or from a copy (liveworkspace/docs/specs/018-automations/
// automations.md "Where rules live and run": rules go with the item; blueprint item-engine.md "Templates and files").
// A file holds each rule's body and whether it was on, never an id, a stamp, a pause or a secret. Read back, every
// rule goes through the check; a copy's rules arrive off, their tabs remapped to the copy's, their snapshots and
// connections (which are the source's own) left to pick. Pure.

import { AUTOMATION_RULES_MAX } from '../limits';
import type { AutomationStamp } from '../types';
import { freeRuleName } from '../validate';
import { isObj } from '../validate-read';
import type { ItemKinds } from './kinds';
import { mapOwnRefs, mapRefs } from './refs';
import type { ItemPart, ItemRule, ItemRuleBody } from './types';
import { readItemRule, ruleHasStep, ruleLeftToPick } from './validate';

export type ItemRuleInFile = ItemRuleBody & { enabled: boolean };

/** The rules as an export file keeps them. */
export const rulesForFile = (rules: readonly ItemRule[]): ItemRuleInFile[] =>
  rules.map((r) => ({
    name: r.name,
    trigger: r.trigger,
    conditions: r.conditions,
    steps: r.steps,
    chain: r.chain,
    timeZone: r.timeZone,
    enabled: r.enabled,
  }));

// What an empty reference is read as, so the check (which takes no empty id) reads the rest of the rule.
const HOLE = '~unpicked~';

export interface RulesFromFile {
  // Who the read rules are made by, and when.
  stamp: AutomationStamp;
  // Old tab id to new, where the item's tabs got new ids (a copy, an import). A tab the map lacks is left to pick.
  tabs?: ReadonlyMap<string, string>;
  // A copy: every rule arrives off, its snapshots and connections left to pick.
  copy?: boolean;
  newId?: () => string;
}

/** The file's rules, checked: at most an item's 50, each with a new id and a free name. `dropped`: how many did not
 *  read (a kind this app lacks, a file from elsewhere). */
export function rulesFromFile(
  value: unknown,
  kinds: ItemKinds,
  opts: RulesFromFile,
): { rules: ItemRule[]; dropped: number } {
  const rules: ItemRule[] = [];
  let dropped = 0;
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const listed: unknown[] = Array.isArray(value) ? value.slice(0, AUTOMATION_RULES_MAX) : [];
  for (const raw of listed) {
    const shared = mapRefs(raw, (ref) => {
      if (ref.kind === 'tab' && opts.tabs) return opts.tabs.get(ref.id) ?? HOLE;
      const own = ref.kind === 'snapshot' || ref.kind === 'connection';
      return (own && opts.copy) || ref.id === '' ? HOLE : ref.id;
    });
    // What the app's own references name is the source's too (a tab's named version).
    const held = mapOwnRefs(shared, kinds.ownRefs, (ref) =>
      opts.copy || ref.id === '' ? HOLE : ref.id,
    );
    const read = readItemRule(held, kinds);
    if ('error' in read) {
      dropped += 1;
      continue;
    }
    const cleared = mapOwnRefs(
      mapRefs(read.body, (ref) => (ref.id === HOLE ? '' : ref.id)),
      kinds.ownRefs,
      (ref) => (ref.id === HOLE ? '' : ref.id),
    );
    const body: ItemRuleBody = {
      ...cleared,
      name: freeRuleName(cleared.name, rules),
      // A message step keeps its connection's name only while it names one.
      steps: cleared.steps.map((s): ItemPart => {
        if (s.kind !== 'notify' || s['webhook'] !== '') return s;
        const { name: _name, ...rest } = s;
        return rest;
      }),
    };
    const on = isObj(raw) && raw['enabled'] === true && !opts.copy;
    rules.push({
      ...body,
      id: newId(),
      enabled: on && ruleHasStep(body) && !ruleLeftToPick(body, kinds),
      made: opts.stamp,
      edited: opts.stamp,
    });
  }
  return { rules, dropped };
}
