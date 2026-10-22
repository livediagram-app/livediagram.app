import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Element, Tab } from '@livedesign/document';
import { beginMindHandoff, landMindHandoff, type HandoffActions } from '@/lib/mind-handoff';

// What both keyboard-grown structures share (docs/specs/009-elements/mind-node.md,
// docs/specs/009-elements/flowchart.md): useMindGrowth and useFlowchartGrowth each plan and dress
// their own element, then hand it here to be revealed, to land the keys typed ahead of it, and to
// be taken back by Escape while still empty.

type SetState<T> = Dispatch<SetStateAction<T>>;

// The options both growth hooks take.
export type GrowthHookOpts = {
  editsBlocked: boolean;
  // A Participant's growth leaves the tab's own fields alone: it never edits a tab's settings.
  participating?: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  scrollIntoView: (
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { sideMargin?: number },
  ) => void;
};

// Clear of the palette and the Quick Style panel docked along the canvas's sides, so an element
// grown past the edge scrolls into the open, not under a panel
// (docs/specs/009-elements/mind-node.md "Following the growth").
const GROWTH_REVEAL_SIDE_MARGIN = 300;

// A plain-text label, replacing any formatted runs the element carried.
export const labelled = (el: Element, label: string): Element =>
  ({ ...el, label, richText: undefined }) as Element;

// An arrow pinned at either end to `id`: what goes with a grown element when it is taken back.
export const touchesPinned = (e: Element, id: string): boolean =>
  e.type === 'arrow' &&
  ((e.from.kind === 'pinned' && e.from.elementId === id) ||
    (e.to.kind === 'pinned' && e.to.elementId === id));

// One commit to the active tab's elements. A growth marks the tab's template as chosen, unless a
// Participant made it.
export function patchActiveElements(
  { commitTabs, activeId, participating = false }: GrowthHookOpts,
  map: (els: Element[], tab: Tab) => Element[],
): void {
  commitTabs((ts) =>
    ts.map((t) =>
      t.id !== activeId
        ? t
        : participating
          ? { ...t, elements: map(t.elements, t) }
          : { ...t, elements: map(t.elements, t), templateChosen: true },
    ),
  );
}

export function useGrowthLanding({
  activeTab,
  setEditingId,
  setSelectedId,
  scrollIntoView,
}: GrowthHookOpts) {
  // The grown element waiting to reach the screen, and the last one grown (for Escape on it
  // while still empty).
  const landing = useRef<string | null>(null);
  const lastGrown = useRef<string | null>(null);

  // A just-committed growth: the label editor it came from closes, the new element is selected
  // and scrolled into view, and keys typed before it is on screen are held for it.
  const reveal = (
    el: { id: string; x: number; y: number; width: number; height: number },
    handoff: HandoffActions,
  ) => {
    setEditingId(null);
    setSelectedId(el.id);
    beginMindHandoff(el.id, handoff);
    landing.current = el.id;
    lastGrown.current = el.id;
    scrollIntoView(el.x, el.y, el.width, el.height, { sideMargin: GROWTH_REVEAL_SIDE_MARGIN });
  };

  // Escape on the element a growth just made, still selected and never labelled: the Tab one time
  // too many, removed by `abandon`. Any other element keeps its usual Escape (deselect).
  const escapeGrown = (id: string, abandon: (id: string) => boolean): boolean => {
    if (lastGrown.current !== id) return false;
    lastGrown.current = null;
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || (el.label ?? '').trim() !== '') return false;
    return abandon(id);
  };

  // Once the grown element is on screen the keyboard handoff ends: keys typed in the gap open its
  // editor to take them; otherwise it just stays selected.
  useEffect(() => {
    const id = landing.current;
    if (!id || !activeTab.elements.some((e) => e.id === id)) return;
    landing.current = null;
    if (landMindHandoff(id)) setEditingId(id);
  }, [activeTab.elements, setEditingId]);

  return { reveal, escapeGrown };
}
