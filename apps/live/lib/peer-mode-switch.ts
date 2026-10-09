// A collaborator's switch of a tab's editor mode, as it arrives (docs/specs/007-editor/editor-modes.md
// "Where the mode lives"): everyone follows it, and a toast says who switched. The mode rides a
// `tab-meta` op: set in its patch, or cleared (back to Diagram, the absent mode) by its `clear`
// list, as an undo of a switch from a tab that never had one sends it. Pure.
import {
  DEFAULT_EDITOR_MODE,
  editorModeLabel,
  parseEditorMode,
  type EditorMode,
} from '@livediagram/document';
import type { RoomOp } from '@livediagram/api-schema';

/** The tab and mode a peer's op switched to, or null when the op leaves the mode alone. */
export function peerModeSwitchOf(op: RoomOp): { tabId: string; mode: EditorMode } | null {
  if (op.kind !== 'tab-meta') return null;
  if ('opensIn' in op.patch) {
    return { tabId: op.tabId, mode: parseEditorMode(op.patch.opensIn) ?? DEFAULT_EDITOR_MODE };
  }
  if (op.clear?.includes('opensIn')) return { tabId: op.tabId, mode: DEFAULT_EDITOR_MODE };
  return null;
}

/** "<Name> switched this tab to <Mode>.", "Someone" when the room gave no name. */
export function peerModeSwitchMessage(name: string | null | undefined, mode: EditorMode): string {
  const who = name?.trim() || 'Someone';
  return `${who} switched this tab to ${editorModeLabel(mode)}.`;
}
