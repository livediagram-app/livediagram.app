import type { Dispatch, SetStateAction } from 'react';
import {
  createShape,
  createTable,
  createText,
  type BoxedElement,
  type ShapeKind,
  type Tab,
} from '@livediagram/diagram';
import { track, titleCaseType } from '@/lib/telemetry';
import type { PendingDraw } from '@/lib/draw-mode';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Palette element-creation handlers, lifted out of editor-page.tsx. The
// draw-capable elements (shape / text / sticky / arrow) arm the combined
// add gesture (beginDraw, from useShapeDrawing) — the canvas then drops
// them at default size on a tap or sizes them on a drag. Icons + tables
// have no draw-to-size, so they drop straight at the viewport centre via
// addBoxed (from useElementHelpers).
export function useElementCreation(opts: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // The single-selected element id, so "add an icon" can drop it INSIDE
  // a selected shape instead of creating a standalone icon element.
  selectedId: string | null;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  addBoxed: <T extends BoxedElement>(make: (x: number, y: number) => T) => void;
  beginDraw: (intent: PendingDraw) => void;
}) {
  const {
    editsBlocked,
    activeId,
    activeTab,
    selectedId,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxed,
    beginDraw,
  } = opts;

  // Telemetry for these arming handlers fires on commit (see
  // useShapeDrawing.commitDraw), once the tap / drag actually lands the
  // element — not here, where the gesture is only queued.
  const addShape = (kind: ShapeKind) => {
    if (editsBlocked) return;
    beginDraw({ type: 'shape', kind });
  };

  // Curated icon glyph. Unlike addShape it drops straight at the
  // viewport centre (no draw-to-size: an icon is a fixed-aspect glyph,
  // not a box you size by dragging) and carries the chosen iconId.
  const addIcon = (iconId: string) => {
    if (editsBlocked) return;
    // If a regular shape is selected, drop the icon INSIDE it (beside the
    // label) rather than spawning a standalone icon element — the same
    // "operate on the current selection" intent the size-inheritance in
    // addBoxed already follows. The dedicated 'icon' shape is excluded
    // (an icon-on-an-icon is meaningless; it just becomes a new icon).
    const sel = selectedId ? activeTab.elements.find((e) => e.id === selectedId) : null;
    if (sel && sel.type === 'shape' && sel.shape !== 'icon') {
      commitTabs((ts) =>
        ts.map((t) =>
          t.id !== activeId
            ? t
            : {
                ...t,
                elements: t.elements.map((e) =>
                  e.id === sel.id
                    ? { ...sel, iconId, iconPosition: sel.iconPosition ?? 'left' }
                    : e,
                ),
              },
        ),
      );
      // Reuse Added/Icon — an icon was placed; `type` stays the kind,
      // never the specific iconId, to keep telemetry free of content.
      track('Element', 'Added', titleCaseType('icon'));
      return;
    }
    addBoxed((x, y) => ({ ...createShape('icon', x, y), iconId }));
    track('Element', 'Added', titleCaseType('icon'));
  };

  // A 3x3 table dropped at the viewport centre (no draw-to-size:
  // the grid sizes itself; the user resizes the whole box after).
  const addTable = () => {
    if (editsBlocked) return;
    addBoxed((x, y) => createTable(x, y));
    track('Element', 'Added', titleCaseType('table'));
  };

  const addText = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'text' });
  };
  const addSticky = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'sticky' });
  };

  // Drop a plain connector at the viewport centre. Defaults to no
  // pointers ('none') so the palette entry behaves like a "Line" tool;
  // the user can change pointer style later via the Pointer accordion.
  // Endpoints are free (unpinned) — drag them onto shapes after the
  // fact to pin to anchors.
  const addArrow = () => {
    if (editsBlocked) return;
    beginDraw({ type: 'arrow' });
  };

  const handleCanvasDoubleClick = (x: number, y: number) => {
    const TEXT_W = 160;
    const TEXT_H = 48;
    const el = createText(x - TEXT_W / 2, y - TEXT_H / 2);
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements: [...t.elements, el], templateChosen: true } : t,
      ),
    );
    setSelectedId(el.id);
    setEditingId(el.id);
  };

  return { addShape, addIcon, addTable, addText, addSticky, addArrow, handleCanvasDoubleClick };
}
