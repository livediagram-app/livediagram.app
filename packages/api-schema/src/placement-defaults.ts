// Default folders (docs/specs/013-workspace/default-folders.md, blueprint
// docs/specs/013-workspace/blueprints/default-folders.md): where a person's new documents land when
// no place is chosen, keyed by what the document opens as. The api resolves and stores them; the
// editor and the MCP server send the creation intent; all read the keys and the intent from here.

/** The dimensions of a default key, most specific first: the order a create's keys are tried in. */
export const DEFAULT_KEY_DIMENSIONS = ['board', 'mode'] as const;

/** The editor mode a new document's first tab opens in. */
export const CREATION_MODES = ['diagram', 'draw'] as const;
export type CreationMode = (typeof CREATION_MODES)[number];

/** The kind of board a new document is, when it is one: an event-storming board by its tab kind,
 *  a retrospective or a Kanban board by the template it was made from. */
export const BOARD_TYPES = ['event-storming', 'retrospective', 'kanban'] as const;
export type BoardType = (typeof BOARD_TYPES)[number];

/** What a new document opens as, captured once when it is created: the create body's `intent`. */
export type CreationIntent = { mode: CreationMode; boardType?: BoardType };

/** The default keys, `<dimension>:<value>`, in the order the "New documents that open as" list
 *  shows them. */
export const PLACEMENT_DEFAULT_KEYS = [
  'mode:diagram',
  'mode:draw',
  'board:event-storming',
  'board:retrospective',
  'board:kanban',
] as const;
export type PlacementDefaultKey = (typeof PLACEMENT_DEFAULT_KEYS)[number];

/** The telemetry type of each key (`Folder·Changed` / `Folder·Cleared`): one closed value per key. */
export const PLACEMENT_DEFAULT_TELEMETRY_TYPES: Record<PlacementDefaultKey, string> = {
  'mode:diagram': 'DefaultModeDiagram',
  'mode:draw': 'DefaultModeDraw',
  'board:event-storming': 'DefaultBoardEventStorming',
  'board:retrospective': 'DefaultBoardRetrospective',
  'board:kanban': 'DefaultBoardKanban',
};

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

/**
 * The creation intent of a new document, from its first tab and the board type of the template it
 * was made from (`boardTypeOfTemplate` in `@livediagram/templates`). Structural, so it reads a tab
 * from before editor modes (a legacy `kind: 'whiteboard'` opens in Draw mode) and one after
 * (`opensIn`). An event-storming tab is an event-storming board whatever the template.
 */
export function creationIntentOf(
  tab: { kind?: string; opensIn?: string } | undefined,
  templateBoardType: BoardType | null = null,
): CreationIntent {
  const draw = tab?.kind === 'whiteboard' || tab?.opensIn === 'draw';
  const mode: CreationMode = draw ? 'draw' : 'diagram';
  const boardType = tab?.kind === 'event-storming' ? 'event-storming' : templateBoardType;
  return boardType ? { mode, boardType } : { mode };
}

/** A create body's `intent`: none when absent or null, refused (`intent_invalid`) when malformed. */
export function readCreationIntent(
  value: unknown,
): { ok: true; intent: CreationIntent | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, intent: null };
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false };
  const { mode, boardType } = value as { mode?: unknown; boardType?: unknown };
  if (!isMember(CREATION_MODES, mode)) return { ok: false };
  if (boardType === undefined || boardType === null) return { ok: true, intent: { mode } };
  if (!isMember(BOARD_TYPES, boardType)) return { ok: false };
  return { ok: true, intent: { mode, boardType } };
}

/** Every key an intent names, most specific first. */
export function candidateKeysFor(intent: CreationIntent): string[] {
  const values: Record<(typeof DEFAULT_KEY_DIMENSIONS)[number], string | undefined> = {
    board: intent.boardType,
    mode: intent.mode,
  };
  return DEFAULT_KEY_DIMENSIONS.flatMap((dimension) => {
    const value = values[dimension];
    return value === undefined ? [] : [`${dimension}:${value}`];
  });
}

/** The keys a create with this intent tries, most specific first. */
export function defaultKeysFor(intent: CreationIntent): PlacementDefaultKey[] {
  return candidateKeysFor(intent).filter(isPlacementDefaultKey);
}
