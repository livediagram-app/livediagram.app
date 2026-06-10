import type { Folder as FolderDTO } from '@livediagram/api-schema';

// folders row shape as read from D1 (migration 0007). Pure
// snake_case to camelCase mapping, no nested JSON to parse, but
// every folder read in the api (list, get-by-id, the parent-of-N
// walks the Explorer does) flows through this mapper, so pinning
// the field-by-field shape stops silent corruption from a column
// rename or an accidental reorder of the SELECT.

export type FolderRow = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  team_id: string | null;
  name: string;
  created_at: number;
  updated_at: number;
};

// Pure mapper from D1 folder row to wire-format DTO. Pulled out of
// db.ts so the shape has its own test surface without dragging the
// rest of the D1 module along (same pattern as tab-row.ts,
// change-log-row.ts, share-link-row.ts, image-strip.ts, image-sniff.ts).
//
// The two fields that matter most for safety are `owner_id` (every
// folder endpoint gates on it) and `parent_id` (drives the
// Explorer's nested tree and the cycle-prevention walk in
// createFolder / updateFolder). If either drifts, ownership
// boundaries leak or the explorer renders a malformed tree.
export function rowToFolder(row: FolderRow): FolderDTO {
  return {
    id: row.id,
    ownerId: row.owner_id,
    parentId: row.parent_id,
    // Team scope (spec/35): drives which authorisation rule the
    // folder routes apply (membership vs ownership), so it matters
    // as much as owner_id below.
    teamId: row.team_id ?? null,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
