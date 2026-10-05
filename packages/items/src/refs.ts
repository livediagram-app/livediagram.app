// How agents name an item (docs/specs/025-plan/plan-mode.md "Agents"): its key as people say it
// ("#12" or "12"), or its id, or an id prefix that names one item. Shared by the CLI's item verbs and
// the MCP's item tools, so both read a ref the same way.
import type { Item } from './item';

export type ItemRefResult =
  { ok: true; item: Item } | { ok: false; reason: 'none' | 'ambiguous'; matches: Item[] };

export function resolveItemRef(items: readonly Item[], ref: string): ItemRefResult {
  const r = ref.trim();
  const key = /^#?(\d+)$/.exec(r);
  if (key) {
    const item = items.find((i) => i.key === Number(key[1]));
    if (item) return { ok: true, item };
  }
  const exact = items.find((i) => i.id === r);
  if (exact) return { ok: true, item: exact };
  const prefixed = r.length >= 3 ? items.filter((i) => i.id.startsWith(r)) : [];
  if (prefixed.length === 1) return { ok: true, item: prefixed[0]! };
  return { ok: false, reason: prefixed.length > 1 ? 'ambiguous' : 'none', matches: prefixed };
}
