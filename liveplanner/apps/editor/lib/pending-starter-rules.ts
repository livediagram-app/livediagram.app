// A template's starter rules, waiting for the editor (docs/specs/026-plan/plan-templates.md "Starter rules"): Start
// Planning drops a template on a plan's first tab and leaves its kind here under that tab's id; the editor makes the
// rules once it knows the person may, keeps the kind with a plan kept Offline for its sync, or drops it for a guest
// (PendingStarterRules). Kept in sessionStorage, as a page load may come between; a memory copy covers storage
// refused. A kind waits at most PENDING_STARTER_RULES_MS, so a plan opened much later never makes them.
import { hasStarterRules, type StarterRuleKind } from '@liveplanner/templates';

const KEY = (tabId: string) => `liveplanner:pending-starter-rules:${tabId}`;
export const PENDING_STARTER_RULES_MS = 10 * 60 * 1000;

type Held = { kind: StarterRuleKind; at: number };
const memory = new Map<string, Held>();
const listeners = new Set<() => void>();

/** Leaves `kind` for the plan whose first tab is `tabId`, when the template has starter rules. */
export function markPendingStarterRules(tabId: string, kind: string, now = Date.now()): void {
  if (!hasStarterRules(kind)) return;
  const held: Held = { kind, at: now };
  memory.set(tabId, held);
  try {
    sessionStorage.setItem(KEY(tabId), JSON.stringify(held));
  } catch {
    // Storage refused: the memory copy serves this page.
  }
  for (const listener of listeners) listener();
}

function readStored(tabId: string): Held | null {
  try {
    const raw = sessionStorage.getItem(KEY(tabId));
    sessionStorage.removeItem(KEY(tabId));
    const held = raw ? (JSON.parse(raw) as Partial<Held>) : null;
    return held &&
      typeof held.kind === 'string' &&
      hasStarterRules(held.kind) &&
      typeof held.at === 'number'
      ? { kind: held.kind, at: held.at }
      : null;
  } catch {
    // Storage refused, or something else under the key: the memory copy, if any.
    return null;
  }
}

/** The kind waiting for `tabId`, taken (so its rules are made once), or null; one older than the wait is dropped. */
export function takePendingStarterRules(tabId: string, now = Date.now()): StarterRuleKind | null {
  const stored = readStored(tabId);
  const held = memory.get(tabId) ?? stored;
  memory.delete(tabId);
  return held && now - held.at <= PENDING_STARTER_RULES_MS ? held.kind : null;
}

/** Calls `listener` whenever a kind is left, so an open editor hears Start Planning's; answers the unsubscribe. */
export function onPendingStarterRules(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
