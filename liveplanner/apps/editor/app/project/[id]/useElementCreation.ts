import { planBoardPlacement } from '@/lib/plan-board-placement';
import { type Dispatch, type SetStateAction } from 'react';
import {
  createShape,
  createText,
  type BoxedElement,
  type Element,
  type Tab,
  withVariantColours,
} from '@liveplanner/project';
import { track, titleCaseType } from '@/lib/telemetry';
import {
  BLANK_SHEET_CHOICE,
  isPlacedSheetStart,
  placeNewSheet,
  sheetTitleForTab,
} from '@/lib/sheet-seeds';

type SetState<T> = Dispatch<SetStateAction<T>>;

// What Start Planning places (docs/specs/026-plan/plan-mode.md "Starting a board"): a board or a Sheet, centred on
// a canvas point; and the double-click Text box on an empty spot of the canvas.
export type PlacedPlanKind = 'plan-board' | 'plan-sheet';

export function useElementCreation(opts: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  addBoxedAt: <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
    opts?: {
      edit?: boolean;
      style?: <E extends BoxedElement>(el: E) => E;
    },
  ) => void;
  styleNewElement: <T extends Element>(el: T) => T;
}) {
  const {
    editsBlocked,
    activeId,
    activeTab,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxedAt,
    styleNewElement,
  } = opts;

  // A board or Sheet from Start Planning, centred on the point; `choice` is the board preset or the Sheet start.
  const dropPaletteItem = (
    kind: PlacedPlanKind,
    canvasX: number,
    canvasY: number,
    art?: { choice?: string },
  ) => {
    if (editsBlocked) return;
    addBoxedAt(
      canvasX,
      canvasY,
      (x, y) => ({
        ...createShape(kind, x, y),
        // A board wide enough for its columns (docs/specs/026-plan/plan-board.md).
        ...(kind === 'plan-board' ? planBoardPlacement(art?.choice, activeTab.name) : {}),
        // Named after its tab (docs/specs/029-sheets/sheet.md "Placing a sheet").
        ...(kind === 'plan-sheet'
          ? {
              planSheet: placeNewSheet({
                title: sheetTitleForTab(activeTab.name, art?.choice),
                ...(isPlacedSheetStart(art?.choice) ? { start: art.choice } : {}),
                ...(art?.choice === BLANK_SHEET_CHOICE ? { blank: true as const } : {}),
              }),
            }
          : {}),
      }),
      {
        edit: true,
        // A preset's own colour is put back after the theme and the remembered style.
        style: (el) => {
          const styled = styleNewElement(el);
          return (
            styled.type === 'shape' ? withVariantColours(styled, art?.choice) : styled
          ) as typeof el;
        },
      },
    );
    track('Element', 'Added', titleCaseType(kind));
  };

  const handleCanvasDoubleClick = (x: number, y: number) => {
    // Same creation gate as every other add path: a locked/loading tab, a view-only session, or a hidden/locked
    // active layer silently no-ops (the layers slice toasts WHY once).
    if (editsBlocked) return;
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
    // Double-clicking empty canvas is a first-class "make a Text element" path; count it so it isn't invisible
    // to the Element/Added dashboard (docs/specs/017-telemetry/telemetry.md).
    track('Element', 'Added', 'Text');
  };

  return { dropPaletteItem, handleCanvasDoubleClick };
}
