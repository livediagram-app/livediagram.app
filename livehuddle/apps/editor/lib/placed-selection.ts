// What a fresh insert leaves selected (docs/specs/009-elements/office.md "Placing selects every piece"): one piece
// is the single selection, as ever; several (a Room with its Door, a preset with its furnishings) are a
// multi-selection of them all, so the next drag moves them together. One Selection, set in one store write.
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';

export function placedSelection(pieces: readonly { id: string }[]): Selection {
  if (pieces.length > 1) {
    return { selectedId: null, multiSelectedIds: new Set(pieces.map((p) => p.id)) };
  }
  return { selectedId: pieces[0]?.id ?? null, multiSelectedIds: new Set() };
}
