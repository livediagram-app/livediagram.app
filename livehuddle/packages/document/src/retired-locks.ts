// Element and tab locking are gone from livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md "Element and Tab
// Locking"). A tab saved while they existed may carry `locked` on itself and on any of its elements: both are dropped,
// so the tab and everything on it behaves unlocked. Run on every stored or incoming tab by the stored-tab migration
// (./stored-tab), as ./retired-layers is, and by the editor on a peer's `tab` op and `tab-meta` patch, so no data
// migration is needed: a tab is read the new way wherever it is read, and saved without the flag the next time it is
// saved. A layer's own `locked` goes with the layer (./retired-layers). Pure; the same object back when there is
// nothing to drop, so the common read allocates nothing.
import { isRecord } from '@liveworkspace/model-core/is-record';

const carriesLock = (el: unknown): boolean => isRecord(el) && 'locked' in el;

function withoutLock(el: unknown): unknown {
  if (!carriesLock(el)) return el;
  const { locked: _locked, ...rest } = el as Record<string, unknown>;
  return rest;
}

/** The tab without its own `locked` or its elements'. */
export function dropRetiredLocks<T extends object>(tab: T): T {
  const t = tab as T & Record<string, unknown>;
  const tabLocked = 'locked' in t;
  const elements = Array.isArray(t.elements) ? (t.elements as unknown[]) : undefined;
  const stamped = !!elements?.some(carriesLock);
  if (!tabLocked && !stamped) return tab;
  const out = { ...t } as Record<string, unknown>;
  if (tabLocked) delete out.locked;
  if (stamped) out.elements = elements!.map(withoutLock);
  return out as T;
}
