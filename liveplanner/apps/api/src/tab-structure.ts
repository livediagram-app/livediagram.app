// A tab-scoped Editor's limits on its own tab (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"): the
// tab's name, the Plan elements that pull cards onto it (a Plan board, a plan view, a Plan card) and where its form's
// responses go are structure, so the link never widens what it reaches. Pure: the api routes and the room apply it.
import { elementReach } from '@liveplanner/items';

type LooseElement = { id?: unknown };
type FormTargets = {
  destination?: { tabId?: unknown } | undefined;
  sheet?: { tabId?: unknown } | undefined;
};
/** The parts of a tab this module reads. */
export type StructuredTab = { name?: unknown; elements?: readonly object[]; form?: unknown };

const idOf = (el: object): string | null => {
  const id = (el as LooseElement).id;
  return typeof id === 'string' ? id : null;
};

/** Each element's reach by id, for the elements that pull cards onto the tab. */
export function reachIndex(elements: readonly object[] | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const el of elements ?? []) {
    const id = idOf(el);
    const reach = id === null ? null : elementReach(el);
    if (id !== null && reach !== null) out.set(id, reach);
  }
  return out;
}

function sameReach(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, reach] of a) if (b.get(id) !== reach) return false;
  return true;
}

const asForm = (form: unknown): FormTargets | undefined =>
  typeof form === 'object' && form !== null ? form : undefined;

// One of a form's targets moved somewhere other than the scoped tab: set (or changed) to point at another tab. A
// target left exactly as stored (an owner's choice) and a target on the tab itself are both fine.
function targetLeaves(
  key: 'destination' | 'sheet',
  stored: FormTargets | undefined,
  next: FormTargets | undefined,
  scope: string,
): boolean {
  const target = next?.[key];
  if (target === undefined || target === null) return false;
  if (target.tabId === scope) return false;
  return JSON.stringify(target) !== JSON.stringify(stored?.[key]);
}

/** Whether a form, as `next`, points its responses off the scoped tab where `stored` did not. */
export function formLeavesTab(stored: unknown, next: unknown, scope: string): boolean {
  const s = asForm(stored);
  const n = asForm(next);
  return targetLeaves('destination', s, n, scope) || targetLeaves('sheet', s, n, scope);
}

/** Why a scoped write changes the tab's structure, or null when it keeps it. `stored` null = no tab yet. */
export function structureChange(
  stored: StructuredTab | null,
  next: StructuredTab,
  scope: string,
): 'name' | 'reach' | 'form' | null {
  if (stored && next.name !== undefined && next.name !== stored.name) return 'name';
  if (!sameReach(reachIndex(stored?.elements), reachIndex(next.elements))) return 'reach';
  if (formLeavesTab(stored?.form, next.form, scope)) return 'form';
  return null;
}

/** The api's answer to a scoped write that would change its tab's structure, logged with what it changed. */
export function structureRefusal(
  why: 'name' | 'reach' | 'form',
  where: { projectId: string; tabId: string },
): { status: 403; body: { error: 'tab_structure'; message: string } } {
  console.info('[tabs] tab.structure.refused', { ...where, why });
  return {
    status: 403,
    body: {
      error: 'tab_structure',
      message:
        'a link to one tab can change its content, not its name, its boards, plan views and Plan cards, or where its form sends responses',
    },
  };
}

// A form with each target that leaves the tab put back as stored.
function formKeepingTargets(stored: unknown, next: unknown, scope: string): unknown {
  const n = asForm(next);
  if (!n) return next;
  const s = asForm(stored);
  const out: Record<string, unknown> = { ...(n as object) };
  for (const key of ['destination', 'sheet'] as const) {
    if (!targetLeaves(key, s, n, scope)) continue;
    if (s?.[key] === undefined) delete out[key];
    else out[key] = s[key];
  }
  return out;
}

/**
 * A scoped Editor's whole-tab save with its structure put back as stored: the stored name, every stored Plan element
 * that pulls cards in (in its stored form when the save changed what it pulls in), none the save added, and the
 * form's targets as stored where the save pointed them off the tab. The rest of the save lands as sent.
 */
export function keepStoredStructure<T extends StructuredTab & { elements: readonly object[] }>(
  next: T,
  stored: (StructuredTab & { elements: readonly object[] }) | null,
  scope: string,
): T {
  if (!structureChange(stored, next, scope)) return next;
  const storedReach = reachIndex(stored?.elements);
  const storedById = new Map<string, object>();
  for (const el of stored?.elements ?? []) {
    const id = idOf(el);
    if (id !== null) storedById.set(id, el);
  }
  const seen = new Set<string>();
  const elements: object[] = [];
  for (const el of next.elements) {
    const id = idOf(el);
    const reach = elementReach(el);
    const was = id === null ? undefined : storedReach.get(id);
    if (was === undefined) {
      // Not a stored Plan element: kept unless the save made it one, when the stored element stays as it was.
      if (reach === null) elements.push(el);
      else if (id !== null && storedById.has(id)) elements.push(storedById.get(id)!);
      continue;
    }
    seen.add(id!);
    elements.push(reach === was ? el : storedById.get(id!)!);
  }
  for (const [id, el] of storedById) if (storedReach.has(id) && !seen.has(id)) elements.push(el);
  const out = { ...next, elements } as T;
  if (stored) out.name = stored.name;
  if ('form' in next) out.form = formKeepingTargets(stored?.form, next.form, scope);
  return out;
}
