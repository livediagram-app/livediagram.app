import { settleChips, settleStacks, type Tab } from '@livedesign/design';

// Badges and step numbers (docs/specs/009-elements/badge.md "Attachment") settled on every tab a write changed, against
// the tab as it was: fitted, numbered, kept on their hosts' points, attached where dropped. Both of the editor's
// write paths run it, a commit and a tick (a drag landing, a nudge, a resize), so no gesture needs attachment code of
// its own. Untouched tabs, and tabs with no chip, come back as the same object.
export function settleChipsInTabs(before: readonly Tab[], after: Tab[]): Tab[] {
  let changed = false;
  const out = after.map((t) => {
    const prev = before.find((p) => p.id === t.id);
    if (prev === t) return t;
    // Stacks first (docs/specs/009-elements/stack.md), so attached marks settle on where things end up.
    const settled = settleChips(prev?.elements ?? [], settleStacks(t.elements));
    if (settled === t.elements) return t;
    changed = true;
    return { ...t, elements: settled };
  });
  return changed ? out : after;
}
