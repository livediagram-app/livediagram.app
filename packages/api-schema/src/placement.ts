// Placement on create (docs/specs/013-workspace/folders.md "Placement on create"): where a new
// document is filed, and the named refusals when that cannot be honoured. The api answers these
// tokens and the editor branches on them, so both read them from here.

/** Where a document is filed: a team's library (My documents when null) and a folder in it (the
 *  space's root, its Unsorted, when null). */
export type DocumentPlacement = { teamId: string | null; folderId: string | null };

/** Every refusal of a create's placement, as the response's `error` token. */
export const PLACEMENT_REJECTIONS = [
  'placement_invalid',
  'team_forbidden',
  'folder_not_found',
  'folder_scope_mismatch',
] as const;

export type PlacementRejection = (typeof PLACEMENT_REJECTIONS)[number];

const REJECTIONS: ReadonlySet<string> = new Set(PLACEMENT_REJECTIONS);

/** True when an error token is a placement refusal. */
export function isPlacementRejection(code: string | null): code is PlacementRejection {
  return code !== null && REJECTIONS.has(code);
}
