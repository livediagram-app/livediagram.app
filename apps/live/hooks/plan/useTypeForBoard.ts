// Create Card Type from a board's Add a Card menu (docs/specs/026-plan/plan-board.md "Create Card Type"): the type
// editor opens on a new type with only that board's statuses on, and saving it adds it to the board's card types.
import { useCallback, useState } from 'react';
import type { Element } from '@livediagram/document';
import { NEW_ITEM_TYPE, normaliseBoardSetup, type ItemTypeDef } from '@livediagram/items';

// The board a new type is being made for, and the statuses its columns use.
export type TypeForBoard = { boardId: string; statuses: readonly string[] };

// A new type's starting point for a board: every status of the document but the board's turned off.
export function newTypeForBoard(
  forBoard: TypeForBoard,
  documentStatuses: Iterable<string>,
): ItemTypeDef {
  const on = new Set(forBoard.statuses);
  const off = [...documentStatuses].filter((s) => !on.has(s));
  return {
    ...NEW_ITEM_TYPE,
    id: '',
    newTitle: '',
    ...(off.length ? { excludedStatuses: off } : {}),
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

export function useTypeForBoard(commit: (map: (els: Element[]) => Element[]) => void) {
  const [typeForBoard, setTypeForBoard] = useState<TypeForBoard | null>(null);
  const addTypeToBoard = useCallback(
    (boardId: string, typeId: string) => commit((els) => withTypeOnBoard(els, boardId, typeId)),
    [commit],
  );
  return { typeForBoard, setTypeForBoard, addTypeToBoard };
}
