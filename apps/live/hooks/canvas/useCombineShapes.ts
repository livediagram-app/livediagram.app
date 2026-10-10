'use client';

// Combine (docs/specs/007-editor/logo-pages.md "Combine"): the selection's shapes on one logo page
// turned into one path by Unite, Subtract, Intersect or Exclude. The result takes the bottom-most
// element's place in the stacking order; the inputs go, with the arrows pinned to them, as Delete
// takes them. One edit, one undo.
import {
  arrowReferencesAny,
  isBoxed,
  logoPageAt,
  type BoxedElement,
  type Element,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { combineElements, type CombineOp } from '@/lib/combine/combine';
import { isCombinable } from '@/lib/combine/outline';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import type { useToast } from '@/hooks/ui/useToast';

const OP_EVENT: Record<CombineOp, string> = {
  unite: 'ShapesUnited',
  subtract: 'ShapesSubtracted',
  intersect: 'ShapesIntersected',
  exclude: 'ShapesExcluded',
};

const centre = (el: BoxedElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

/** The selection in stacking order when it can be combined: two or more combinable, unlocked
 *  elements whose centres are all on one logo page; else null. */
export function combinableSelection(
  elements: readonly Element[],
  ids: ReadonlySet<string>,
  pages: readonly LaidOutPage[] | null,
): BoxedElement[] | null {
  if (!pages || ids.size < 2) return null;
  const chosen = elements.filter((el): el is BoxedElement => ids.has(el.id) && isBoxed(el));
  if (chosen.length !== ids.size) return null;
  if (!chosen.every((el) => isCombinable(el) && el.locked !== true)) return null;
  const page = logoPageAt(pages, centre(chosen[0]!));
  if (!page) return null;
  return chosen.every((el) => logoPageAt(pages, centre(el))?.id === page.id) ? chosen : null;
}

export function useCombineShapes({
  activeTab,
  pages,
  currentSelectionIds,
  commit,
  setSelectedId,
  setMultiSelectedIds,
  toast,
  readOnly,
}: {
  activeTab: Tab;
  // The laid-out pages while in Illustrate mode; null otherwise.
  pages: readonly LaidOutPage[] | null;
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  toast: ReturnType<typeof useToast>;
  readOnly: boolean;
}) {
  // The tab as it is when the engine answers, not as it was when the press began.
  const latestTab = useLatest(activeTab);
  const canCombine = () =>
    !readOnly &&
    activeTab.locked !== true &&
    combinableSelection(activeTab.elements, currentSelectionIds(), pages) !== null;

  const combineSelected = async (op: CombineOp) => {
    if (readOnly || activeTab.locked === true) return;
    const ordered = combinableSelection(activeTab.elements, currentSelectionIds(), pages);
    if (!ordered) return;
    const result = await combineElements(ordered, op, crypto.randomUUID());
    if (!result.ok) {
      if (result.reason === 'empty') toast.info("Nothing left: these shapes don't overlap.");
      else if (result.reason === 'too-detailed')
        toast.info('That combination is too detailed to keep as one shape.');
      else if (result.reason === 'failed') toast.error("Couldn't combine the shapes. Try again.");
      return;
    }
    // Inputs deleted or changed meanwhile (by someone else, or a move while the engine loaded):
    // the combination was worked out from what they were, so it no longer stands.
    const unchanged = (els: readonly Element[]) => {
      const now = new Map(els.map((el) => [el.id, el]));
      return ordered.every((el) => now.get(el.id) === el);
    };
    if (!unchanged(latestTab.current.elements)) return;
    const removed = new Set(result.removedIds);
    commit((els) => {
      if (!unchanged(els)) return els;
      const out: Element[] = [];
      let placed = false;
      for (const el of els) {
        if (removed.has(el.id)) {
          // The result sits where the bottom-most input sat.
          if (!placed) out.push(result.path);
          placed = true;
          continue;
        }
        if (el.type === 'arrow' && arrowReferencesAny(el, removed)) continue;
        out.push(el);
      }
      return out;
    });
    setMultiSelectedIds(new Set());
    setSelectedId(result.path.id);
    track('Element', 'Changed', OP_EVENT[op]);
  };

  return { canCombine, combineSelected };
}
