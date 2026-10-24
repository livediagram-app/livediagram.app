// The creation intent (docs/specs/013-workspace/default-folders.md): what a new document is made as, which the
// editor and the MCP server send on a create and the api hands the index as a word for its filters and default
// folders. One dimension: the editor mode it opens in.

import { DEFAULT_EDITOR_MODE, isEditorMode, type EditorMode } from '@livedocuments/document';

/** What a new document is made as: the create body's `intent`. */
export type CreationIntent = {
  mode: EditorMode;
};

/** The intent of every new document: it opens in Pages, the one mode. */
export const CREATION_INTENT: CreationIntent = { mode: DEFAULT_EDITOR_MODE };

/** The create's refusal of a malformed `intent`. */
export const INTENT_INVALID = 'intent_invalid';

/** The intent as the index keeps it, a word for its filters and default folders: `pages`. Null for none. */
export function indexIntentOf(intent: CreationIntent | null): string | null {
  return intent ? intent.mode : null;
}

/** A create body's `intent`: none when absent or null, refused (`intent_invalid`) when malformed. */
export function readCreationIntent(
  value: unknown,
): { ok: true; intent: CreationIntent | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, intent: null };
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const { mode } = value as { mode?: unknown };
  if (!isEditorMode(mode)) return { ok: false };
  return { ok: true, intent: { mode } };
}
