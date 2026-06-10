import { describe, expect, it } from 'vitest';
import { rowToFolder, type FolderRow } from './folder-row';

// rowToFolder is the read-side contract every folder endpoint goes
// through: list, get-by-id, the parent-walks the Explorer issues
// while rendering the nested tree, the cycle-prevention reads
// createFolder / updateFolder run before INSERT. The mapper itself
// is small (six columns, no nested JSON), but its two security-
// relevant fields, `owner_id` and `parent_id`, are exactly what
// ownership gating and the recursive tree render depend on. A
// column rename, a SELECT-list reorder, or a silent type swap
// here would leak ownership boundaries or render a malformed
// folder tree.

const baseRow = (override: Partial<FolderRow> = {}): FolderRow => ({
  id: 'folder-1',
  owner_id: 'owner-a',
  parent_id: null,
  team_id: null,
  name: 'Roadmap',
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_100_000,
  ...override,
});

describe('rowToFolder', () => {
  it('maps a root folder row to the canonical wire-format DTO', () => {
    expect(rowToFolder(baseRow())).toEqual({
      id: 'folder-1',
      ownerId: 'owner-a',
      parentId: null,
      teamId: null,
      name: 'Roadmap',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    });
  });

  it('preserves a non-null parent_id verbatim (drives the Explorer nested tree)', () => {
    // The Explorer renders folders by walking parent_id, and the
    // cycle-prevention check in createFolder + updateFolder walks
    // the same field. A regression that flattened the value or
    // mis-cased the column would silently flatten the tree.
    const dto = rowToFolder(baseRow({ parent_id: 'folder-root' }));
    expect(dto.parentId).toBe('folder-root');
  });

  it('keeps the snake_case to camelCase rename for owner_id, parent_id, created_at, updated_at', () => {
    // Pinning the field-by-field rename so a typo (e.g.
    // `ownerId: row.id`) corrupts every folder list rather than
    // failing loud in just the suite. The two timestamp casts are
    // pass-through (the row already carries number, not string).
    const row = baseRow({
      owner_id: 'distinct-owner',
      created_at: 111,
      updated_at: 222,
    });
    const dto = rowToFolder(row);
    expect(dto.ownerId).toBe('distinct-owner');
    expect(dto.createdAt).toBe(111);
    expect(dto.updatedAt).toBe(222);
  });

  it('does not mutate or extend the input row', () => {
    // Pure-function contract: the row is whatever D1 handed back and
    // the mapper must never write to it. Catches a regression that
    // assigned a derived field back onto the row (e.g. accidentally
    // stamping ownerId onto the snake_case shape).
    const row = baseRow();
    const snapshot = { ...row };
    rowToFolder(row);
    expect(row).toEqual(snapshot);
  });
});
