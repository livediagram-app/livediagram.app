import { describe, expect, it, vi } from 'vitest';
import { rowToShapeLibrary, type ShapeLibraryRow } from './shape-library-row';

// docs/specs/013-workspace/blueprints/shape-libraries.md "Data and persistence".

const row = (items: string): ShapeLibraryRow => ({
  id: 'lib-1',
  owner_id: 'owner-1',
  name: 'Team icons',
  source: 'drawio',
  items,
  created_at: 1,
  updated_at: 2,
});

describe('rowToShapeLibrary', () => {
  it('maps the row and parses its items', () => {
    const items = [{ id: 'i1', title: 'A', width: 10, height: 10, elements: [] }];
    expect(rowToShapeLibrary(row(JSON.stringify(items)))).toEqual({
      id: 'lib-1',
      ownerId: 'owner-1',
      name: 'Team icons',
      source: 'drawio',
      items,
      createdAt: 1,
      updatedAt: 2,
    });
  });

  it('reads corrupt items as none, logged, so one bad row never fails the list', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(rowToShapeLibrary(row('{not json')).items).toEqual([]);
    expect(rowToShapeLibrary(row('{"a":1}')).items).toEqual([]);
    expect(warn).toHaveBeenCalledWith('[shape-libraries] corrupt items', { id: 'lib-1' });
    warn.mockRestore();
  });
});
