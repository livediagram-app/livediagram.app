// The creation intent (docs/specs/013-workspace/default-folders.md): what a new design is made as, captured once
// when it is created. The editor and the MCP server send it; the api reads it and passes it on to the index, which
// resolves and stores default folders.

import {
  DEFAULT_EDITOR_MODE,
  DEFAULT_TAB_KIND,
  isEditorMode,
  type EditorMode,
  type TabKind,
} from '@livedesign/design';

/** The tab kinds a design can be created with. */
export const CREATION_TAB_KINDS = ['diagram'] as const satisfies readonly TabKind[];
export type CreationTabKind = (typeof CREATION_TAB_KINDS)[number];

/** What a new design is made as, captured once when it is created: the create body's `intent`. */
export type CreationIntent = {
  mode: EditorMode;
  tabKind: CreationTabKind;
};

/** The create's refusal of a malformed `intent`. */
export const INTENT_INVALID = 'intent_invalid';

const isMember = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.some((member) => member === value);

export function isCreationTabKind(value: unknown): value is CreationTabKind {
  return isMember(CREATION_TAB_KINDS, value);
}

/** The creation intent of a new design, from its first tab. Every tab opens in Pages. */
export function creationIntentOf(_tab: { opensIn?: string } | undefined): CreationIntent {
  return { mode: DEFAULT_EDITOR_MODE, tabKind: DEFAULT_TAB_KIND };
}

/** A create body's `intent`: none when absent or null, refused (`intent_invalid`) when malformed.
 *  An absent or null `tabKind` is the general tab. */
export function readCreationIntent(
  value: unknown,
): { ok: true; intent: CreationIntent | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, intent: null };
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const { mode, tabKind } = value as { mode?: unknown; tabKind?: unknown };
  if (!isEditorMode(mode)) return { ok: false };
  const kind = tabKind ?? DEFAULT_TAB_KIND;
  if (!isCreationTabKind(kind)) return { ok: false };
  return { ok: true, intent: { mode, tabKind: kind } };
}
