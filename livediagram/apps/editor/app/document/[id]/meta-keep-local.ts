// A peer's tab list (a `document-meta` op) on screen without undoing what this editor has not saved yet
// (docs/specs/012-collaboration/collab-race-hardening.md "Tab lists"): the list is the peer's last save, so a tab
// added here since the last save (not in the baseline) is not in it, and one deleted here since (still in the
// baseline) is. Replacing the screen with it dropped the new tab before its save, and brought the deleted one
// back as an empty placeholder whose next save emptied the real tab for everyone. Pure.
import type { Tab } from '@livediagram/document';

export function keepUnsavedTabChanges(
  // The tabs as they were before the peer's list, and as the list leaves them.
  before: readonly Tab[],
  after: Tab[],
  // What was last saved: the tabs every peer already has.
  baseline: readonly Tab[],
): Tab[] {
  const saved = new Set(baseline.map((t) => t.id));
  const here = new Set(before.map((t) => t.id));
  const inList = new Set(after.map((t) => t.id));
  // Deleted here, not yet saved: the list still names it.
  let out = after.filter((t) => here.has(t.id) || !saved.has(t.id));
  // Added here, not yet saved: the list cannot name it. Each goes back after the tab it followed.
  before.forEach((t, i) => {
    if (saved.has(t.id) || inList.has(t.id)) return;
    const prevId = before[i - 1]?.id;
    const at = prevId === undefined ? -1 : out.findIndex((x) => x.id === prevId);
    out = [...out.slice(0, at + 1), t, ...out.slice(at + 1)];
  });
  return out.length === after.length && out.every((t, i) => t === after[i]) ? after : out;
}
