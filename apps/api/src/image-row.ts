import type { ImageSummary } from '@livediagram/api-schema';

// images row shape as read from D1 (migration 0014 / spec/19). The
// gallery list endpoint + the image-bytes read both pass rows
// through the mapper below to produce the wire-format DTO the live
// editor consumes.

export type ImageRow = {
  id: string;
  owner_id: string;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  original_name: string | null;
  created_at: number;
};

// Pure mapper from D1 image row to wire-format ImageSummary. Pulled
// out of db.ts so the shape has its own test surface without
// dragging the rest of the D1 module along (same pattern as
// tab-row.ts, folder-row.ts, change-log-row.ts, share-link-row.ts,
// image-strip.ts, image-sniff.ts).
//
// The `original_name ?? undefined` rewrite is the one non-trivial
// move: the column is `string | null`, but the wire type advertises
// `string | undefined` (the editor's gallery treats "no name" as
// "absent field" rather than "null field"). A regression that
// flipped this to `?? null` would push the wrong absence value into
// the client and break gallery rendering on un-named uploads.
//
// `owner_id` and `sha256` are intentionally NOT surfaced on the
// summary: the gallery shouldn't carry them across the wire (the
// owner is implicit per request, and the sha is dedup-internal).
// Keeping the mapper narrow stops a future "let me just spread the
// row" change from accidentally leaking either field.
export function imageRowToSummary(row: ImageRow): ImageSummary {
  return {
    id: row.id,
    contentType: row.content_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    originalName: row.original_name ?? undefined,
    createdAt: row.created_at,
  };
}
