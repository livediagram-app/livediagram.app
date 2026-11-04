// Add Card Type for a board (Board, Supported Cards; docs/specs/026-plan/plan-board.md "Add Card Type"): the type
// editor opens on a new type with only that board's statuses on, and saving it adds it to the board's card types.
import { useCallback, useState } from 'react';
import type { Element } from '@liveplanner/project';
import { NEW_ITEM_TYPE, normaliseBoardSetup, type ItemTypeDef } from '@liveplanner/items';

// What a new type is being made for: a board, with the statuses its columns use.
type TypeForBoard = {
  boardId?: string;
  statuses?: readonly string[];
};

// A new type's starting point: for a board, only the board's statuses, in its column order (docs/specs/026-plan/
// item-types.md "The statuses a type uses"); otherwise none given, so the type editor starts it on every status.
export function newTypeForBoard(forBoard: TypeForBoard): ItemTypeDef {
  return {
    ...NEW_ITEM_TYPE,
    id: '',
    newTitle: '',
    fields: [...NEW_ITEM_TYPE.fields],
    ...(forBoard.statuses ? { statuses: [...new Set(forBoard.statuses)] } : {}),
  };
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
  return { typeForBoard, setTypeForBoard, addTypeToBoard };
}
