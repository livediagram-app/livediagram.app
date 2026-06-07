import type { Dispatch, SetStateAction } from 'react';
import {
  createShape,
  createSticky,
  createText,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ShapeKind,
  type Tab,
} from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { track, titleCaseType } from '@/lib/telemetry';
import type { PendingDraw } from '@/lib/draw-mode';
import { patchTab } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;

// Palette element-creation handlers, lifted out of editor-page.tsx. Each
// short-circuits into draw-to-size mode when enabled (beginDrawIfEnabled,
// from useShapeDrawing) else drops the element at the viewport centre via
// addBoxed (from useElementHelpers); arrows + double-click text take
// their own commit path because they also flip the tab's templateChosen.
export function useElementCreation(opts: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  getViewportCenter: () => { x: number; y: number };
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  emitChange: (tabId: string, before: Element[], after: Element[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  addBoxed: <T extends BoxedElement>(make: (x: number, y: number) => T) => void;
  beginDrawIfEnabled: (intent: PendingDraw) => boolean;
}) {
  const {
    editsBlocked,
    activeId,
    activeTab,
    getViewportCenter,
    commitTabs,
    emitChange,
    setSelectedId,
    setEditingId,
    addBoxed,
    beginDrawIfEnabled,
  } = opts;

  const addShape = (kind: ShapeKind) => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'shape', kind })) return;
    addBoxed((x, y) => createShape(kind, x, y));
    // Telemetry (spec/22): element added; `type` is the shape kind
    // (a preset enum, e.g. "Square"), never user content.
    track('Element', 'Added', titleCaseType(kind));
  };

  // Curated icon glyph. Unlike addShape it drops straight at the
  // viewport centre (no draw-to-size: an icon is a fixed-aspect glyph,
  // not a box you size by dragging) and carries the chosen iconId.
  const addIcon = (iconId: string) => {
    if (editsBlocked) return;
    addBoxed((x, y) => ({ ...createShape('icon', x, y), iconId }));
    // `type` stays the shape kind ('Icon'), never the specific iconId,
    // to keep telemetry free of anything resembling user content.
    track('Element', 'Added', titleCaseType('icon'));
  };

  const addText = () => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'text' })) return;
    addBoxed((x, y) => createText(x, y));
    track('Element', 'Added', 'Text');
  };
  const addSticky = () => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'sticky' })) return;
    addBoxed((x, y) => createSticky(x, y));
    track('Element', 'Added', 'Sticky');
  };

  // Drop a plain connector at the viewport centre. Defaults to no
  // pointers ('none') so the palette entry behaves like a "Line" tool;
  // the user can change pointer style later via the Pointer accordion.
  // Endpoints are free (unpinned) — drag them onto shapes after the
  // fact to pin to anchors.
  const addArrow = () => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'arrow' })) return;
    const centre = getViewportCenter();
    const halfLen = 80;
    const theme = getTheme(activeTab.theme);
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'free', x: centre.x - halfLen, y: centre.y },
      to: { kind: 'free', x: centre.x + halfLen, y: centre.y },
      arrowEnds: 'none',
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
    };
    const before = activeTab.elements;
    const after = [...before, arrow];
    commitTabs((ts) => patchTab(ts, activeId, { elements: after, templateChosen: true }));
    // Same activity-log emit as addBoxed: commit() does this for
    // element-only commits, but this path also touches
    // templateChosen on the tab so we use commitTabs and emit
    // explicitly.
    emitChange(activeId, before, after);
    setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
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

  return { addShape, addIcon, addText, addSticky, addArrow, handleCanvasDoubleClick };
}
