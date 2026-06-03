import { describe, expect, it } from 'vitest';
import { imageRowToSummary, type ImageRow } from './image-row';

// imageRowToSummary is the read-side contract every gallery list
// flows through. The mapper is small (eight columns, no nested
// JSON), but two pieces of its shape carry real cost if they drift:
//
//   1. `original_name` is `string | null` in the column but the
//      wire type advertises `string | undefined`. The `?? undefined`
//      rewrite turns SQL null into "absent" on the client; a
//      regression that returned null would break the gallery's
//      conditional rendering of the filename caption.
//   2. `owner_id` and `sha256` are intentionally omitted from the
//      summary. They're either implicit (owner) or dedup-internal
//      (sha) and shouldn't ride across the wire. A regression that
//      spread the row would leak both fields to every gallery list
//      response, including to share-link visitors.

const baseRow = (override: Partial<ImageRow> = {}): ImageRow => ({
  id: 'img-1',
  owner_id: 'owner-a',
  content_type: 'image/png',
  byte_size: 4096,
  width: 800,
  height: 600,
  sha256: 'deadbeef'.repeat(8),
  original_name: 'screenshot.png',
  created_at: 1_700_000_000_000,
  ...override,
});

describe('imageRowToSummary', () => {
  it('maps a fully-populated row to the canonical wire summary', () => {
    expect(imageRowToSummary(baseRow())).toEqual({
      id: 'img-1',
      contentType: 'image/png',
      byteSize: 4096,
      width: 800,
      height: 600,
      originalName: 'screenshot.png',
      createdAt: 1_700_000_000_000,
    });
  });

  it('does NOT surface owner_id or sha256 on the wire summary', () => {
    // Both are intentionally absent from ImageSummary: the gallery
    // shouldn't carry the owner across the wire (it's implicit per
    // request) and sha256 is dedup-internal. A future regression
    // that spread the row would leak both fields to every gallery
    // list response, including to any share-link visitor who can
    // reach the gallery endpoint.
    const dto = imageRowToSummary(baseRow()) as Record<string, unknown>;
    expect(dto.ownerId).toBeUndefined();
    expect(dto.owner_id).toBeUndefined();
    expect(dto.sha256).toBeUndefined();
  });

  it('converts null original_name to undefined on the wire (absent, not null)', () => {
    // ImageSummary types originalName as `string | undefined`, not
    // `string | null`. The mapper bridges this so the editor's
    // gallery treats "no name" as "absent field" and can use
    // `?? 'Untitled'` on the client without checking for null too.
    const dto = imageRowToSummary(baseRow({ original_name: null }));
    expect(dto.originalName).toBeUndefined();
    expect('originalName' in dto).toBe(true);
  });

  it('keeps a non-null original_name verbatim (no normalisation)', () => {
    // Pinning that the mapper passes the name through without
    // trimming or case-folding: the editor displays exactly what
    // the user uploaded.
    const dto = imageRowToSummary(baseRow({ original_name: '  My Image .PNG ' }));
    expect(dto.originalName).toBe('  My Image .PNG ');
  });

  it('renames snake_case columns to camelCase field-by-field', () => {
    // Catches a typo (e.g. `byteSize: row.byte_size` swapping for
    // `width`) by distinguishing the test values for each column.
    const dto = imageRowToSummary(
      baseRow({
        content_type: 'image/webp',
        byte_size: 12345,
        width: 1920,
        height: 1080,
        created_at: 999,
      }),
    );
    expect(dto.contentType).toBe('image/webp');
    expect(dto.byteSize).toBe(12345);
    expect(dto.width).toBe(1920);
    expect(dto.height).toBe(1080);
    expect(dto.createdAt).toBe(999);
  });

  it('does not mutate or extend the input row', () => {
    // Pure-function contract: D1 hands back the row and the mapper
    // never writes to it. Catches a regression that stamped a
    // derived field back onto the snake_case shape.
    const row = baseRow();
    const snapshot = { ...row };
    imageRowToSummary(row);
    expect(row).toEqual(snapshot);
  });
});
