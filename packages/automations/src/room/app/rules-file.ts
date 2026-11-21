// An item's rules in its file and its copies (liveworkspace/docs/specs/018-automations/automations.md "Where rules
// live and run": rules go with the item; blueprint item-engine.md "An app's bindings"). The file carries each rule's
// body and whether it was on, never an id, a stamp, a pause or a secret. Read back into a new item (an import, Make a
// Copy), every rule goes through the rules' own check and lands turned off, its tabs at the new item's ids (one the
// new item lacks is left to pick), its snapshots, connections and the app's own references, which were the source's,
// left to pick.
import { rulesForFile, rulesFromFile, type ItemKinds, type ItemRuleInFile } from '../../item';
import { SOMEONE, type ItemHost } from './host';

type Host = Pick<ItemHost, 'AUTOMATIONS'>;

// A source's rules on their way into a new item: as its file keeps them, with each tab's id there to its id here.
export type CopiedRules = { rules: unknown[]; tabs: [string, string][] };

/** The item's rules as its file keeps them; none outside its room, or before it has any. */
export function hostRulesForFile(host: Host): ItemRuleInFile[] {
  return rulesForFile(host.AUTOMATIONS?.store.list() ?? []);
}

/** The rules a copy carries, or null for an item with none. `tabIds`: each tab's id to its copy's. */
export function copiedRulesOf(host: Host, tabIds: ReadonlyMap<string, string>): CopiedRules | null {
  const rules = hostRulesForFile(host);
  return rules.length > 0 ? { rules, tabs: [...tabIds] } : null;
}

/** The rows a new item's rules land as, in the batch that lands its tabs: each checked, off, in the file's order. A
 *  rule that does not read (another app's kind, a damaged file) is left behind. */
export function landedRuleStatements(
  db: D1Database,
  kinds: ItemKinds,
  copied: CopiedRules | null | undefined,
  now: number,
): D1PreparedStatement[] {
  if (!copied || !Array.isArray(copied.rules) || copied.rules.length === 0) return [];
  const { rules, dropped } = rulesFromFile(copied.rules, kinds, {
    stamp: { by: SOMEONE, at: now },
    tabs: new Map(Array.isArray(copied.tabs) ? copied.tabs : []),
    copy: true,
  });
  if (dropped > 0) console.info('[automations] rules left behind', { dropped });
  return rules.map((rule, position) =>
    db
      .prepare(
        'INSERT INTO automation_rules (id, body, enabled, position, failures) VALUES (?, ?, 0, ?, 0)',
      )
      .bind(rule.id, JSON.stringify({ ...rule, enabled: false }), position),
  );
}
