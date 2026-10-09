'use client';

// Tidy Up (docs/specs/007-editor/logo-pages.md "Tidy Up"): the selection's hand-drawn lines made
// clean in one edit (one undo), each in place with its id, so the selection stays as it was.
import type { BoxedElement, Element, Tab } from '@livediagram/document';
import { tidyUpStroke, isTidyable } from '@/lib/stroke-tidy';
import { track } from '@/lib/telemetry';
import type { TidyGuides } from '@/lib/logo-guide-snapping';

/** The selected elements Tidy Up would change: unlocked drawn lines. */
function tidyableSelection(elements: readonly Element[], ids: ReadonlySet<string>): BoxedElement[] {
  return elements.filter(
    (el): el is BoxedElement => ids.has(el.id) && el.locked !== true && isTidyable(el),
  );
}

export function useTidyUpStrokes({
  activeTab,
  currentSelectionIds,
  commit,
  readOnly,
  guides,
}: {
  activeTab: Tab;
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  readOnly: boolean;
  // A logo page's shown guides to align to (corners and straight runs), read when tidying.
  guides?: () => TidyGuides | null;
}) {
  const blocked = () => readOnly || activeTab.locked === true;
  const canTidyUp = () =>
    !blocked() && tidyableSelection(activeTab.elements, currentSelectionIds()).length > 0;

  const tidyUpSelected = () => {
    if (blocked()) return;
    const ids = currentSelectionIds();
    if (tidyableSelection(activeTab.elements, ids).length === 0) return;
    const align = guides?.() ?? null;
    // Tidied here, before the commit, so the count is known when it is tracked (a commit's
    // updater may run later, at render).
    const paths = new Map<string, Element>();
    for (const el of tidyableSelection(activeTab.elements, ids)) {
      const path = tidyUpStroke(el, align);
      if (path) paths.set(el.id, path);
    }
    if (paths.size === 0) return;
    commit((els) => els.map((el) => paths.get(el.id) ?? el));
    track('Element', 'Changed', 'StrokesTidiedUp');
  };

  return { canTidyUp, tidyUpSelected };
}
