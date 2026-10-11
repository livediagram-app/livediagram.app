// Add New Card Type from a board's Add a Card menu (docs/specs/026-plan/plan-board.md "Add New Card Type"): the type
// editor opens on a new type with only that board's statuses on, and saving it adds it to the board's card types.
import { useCallback, useState } from 'react';
import type { Element } from '@livediagram/document';
import {
  NEW_ITEM_TYPE,
  normaliseBoardSetup,
  type CardField,
  type ItemTypeDef,
} from '@livediagram/items';

// What a new type is being made for: a board (with the statuses its columns use), or a Gantt chart (with the fields it
// needs to draw the type: Start and Due), docs/specs/026-plan/plan-views.md "Gantt Chart".
export type TypeForBoard = {
  boardId?: string;
  statuses?: readonly string[];
  viewId?: string;
  fields?: readonly CardField[];
};

// A new type's starting point: for a board, every status of the document but the board's turned off; with fields,
// those fields on beside the new type's own.
export function newTypeForBoard(
  forBoard: TypeForBoard,
  documentStatuses: Iterable<string>,
): ItemTypeDef {
  const on = new Set(forBoard.statuses ?? []);
  const off = forBoard.statuses ? [...documentStatuses].filter((s) => !on.has(s)) : [];
  const fields = [...NEW_ITEM_TYPE.fields];
  for (const f of forBoard.fields ?? []) if (!fields.includes(f)) fields.push(f);
  return {
    ...NEW_ITEM_TYPE,
    id: '',
    newTitle: '',
    fields,
    ...(off.length ? { excludedStatuses: off } : {}),
  };
}

// The elements with `typeId` added to a chart's card types, where the chart names its own (one naming none already
// draws every type that can feed it).
export function withTypeOnView(els: Element[], viewId: string, typeId: string): Element[] {
  let changed = false;
  const next = els.map((el) => {
    if (el.id !== viewId || el.type !== 'shape' || el.shape !== 'plan-view') return el;
    const view = (el as { planView?: { types?: readonly string[] } }).planView;
    if (!view?.types || view.types.includes(typeId)) return el;
    changed = true;
    return { ...el, planView: { ...view, types: [...view.types, typeId] } } as Element;
  });
  return changed ? next : els;
}

// The elements with `typeId` added to the board's card types. A board taking every type (no `addTypes`) already
// shows it, and one that names it already is left alone, so nothing changes for them.
export function withTypeOnBoard(els: Element[], boardId: string, typeId: string): Element[] {
  let changed = false;
  const next = els.map((el) => {
    if (el.id !== boardId || el.type !== 'shape' || el.shape !== 'plan-board') return el;
    const setup = normaliseBoardSetup(el.planBoard);
    if (!setup?.addTypes || setup.addTypes.includes(typeId)) return el;
    changed = true;
    return { ...el, planBoard: { ...setup, addTypes: [...setup.addTypes, typeId] } };
  });
  return changed ? next : els;
}

// `commitOn`: a change to the tab holding the board (usePlanSlice).
export function useTypeForBoard(
  commitOn: (boardId: string, map: (els: Element[]) => Element[]) => void,
) {
  const [typeForBoard, setTypeForBoard] = useState<TypeForBoard | null>(null);
  const addTypeToBoard = useCallback(
    (boardId: string, typeId: string) =>
      commitOn(boardId, (els) => withTypeOnBoard(els, boardId, typeId)),
    [commitOn],
  );
  const addTypeToView = useCallback(
    (viewId: string, typeId: string) =>
      commitOn(viewId, (els) => withTypeOnView(els, viewId, typeId)),
    [commitOn],
  );
  return { typeForBoard, setTypeForBoard, addTypeToBoard, addTypeToView };
}
