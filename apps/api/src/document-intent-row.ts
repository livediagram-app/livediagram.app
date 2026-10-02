// The recorded creation intent as stored on a documents row (migration 0062,
// docs/specs/013-workspace/default-folders.md "Recorded intent"). Stored text reads as an editor
// mode or a board type only when it is one; anything else, NULL included, is unknown (null), so a
// retired value never reaches a client as a live option.

import { BOARD_TYPES, type BoardType } from '@livediagram/api-schema';
import { isEditorMode, type EditorMode } from '@livediagram/document';

export function readOpensIn(value: string | null): EditorMode | null {
  return isEditorMode(value) ? value : null;
}

export function readBoardType(value: string | null): BoardType | null {
  return BOARD_TYPES.find((board) => board === value) ?? null;
}
