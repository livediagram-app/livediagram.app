// Default folders (docs/specs/013-workspace/default-folders.md, blueprint
// docs/specs/013-workspace/blueprints/default-folders.md): where a person's new designs land when
// no place is chosen, keyed by what the design is made as. The api resolves and stores them; the
// editor and the MCP server send the creation intent; all read the keys and the intent from here.
//
// One dimension: the editor mode it opens in. It comes from one closed list, and the keys are
// generated from it, so a new editor mode adds its key here unasked.

import {
  DEFAULT_EDITOR_MODE,
  DEFAULT_TAB_KIND,
  EDITOR_MODES,
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

export type PlacementDefaultKey = `mode:${EditorMode}`;

/** The default keys, `mode:<mode>`, in the order the "New designs that open as" list shows them:
 *  one per editor mode, all generated. */
export const PLACEMENT_DEFAULT_KEYS: readonly PlacementDefaultKey[] = EDITOR_MODES.map(
  (mode) => `mode:${mode}` as const,
);

/** One person's default folder for one key, as `GET /api/placement-defaults` answers it. */
export type PlacementDefault = { key: PlacementDefaultKey; folderId: string };

/** The named refusals of the default-folder routes besides the shared `folder_not_found`. */
export const PLACEMENT_DEFAULT_REJECTIONS = [
  'default_key_invalid',
  'default_folder_invalid',
] as const;
export type PlacementDefaultRejection = (typeof PLACEMENT_DEFAULT_REJECTIONS)[number];

/** The create's refusal of a malformed `intent`. */
export const INTENT_INVALID = 'intent_invalid';

const isMember = <T extends string>(list: readonly T[], value: unknown): value is T =>
  list.some((member) => member === value);

export function isPlacementDefaultKey(value: unknown): value is PlacementDefaultKey {
  return isMember(PLACEMENT_DEFAULT_KEYS, value);
}

export function isCreationTabKind(value: unknown): value is CreationTabKind {
  return isMember(CREATION_TAB_KINDS, value);
}

const pascal = (part: string) =>
  part
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

/** The telemetry value of a key (`Folder·Changed` / `Folder·Cleared`): `mode:pages` →
 *  `DefaultModePages`. Closed, as the keys are. */
export function placementDefaultTelemetryType(key: PlacementDefaultKey): string {
  return `Default${key.split(':').map(pascal).join('')}`;
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

/** The keys a create with this intent tries: its mode's. */
export function defaultKeysFor(intent: CreationIntent): PlacementDefaultKey[] {
  return [`mode:${intent.mode}`];
}
