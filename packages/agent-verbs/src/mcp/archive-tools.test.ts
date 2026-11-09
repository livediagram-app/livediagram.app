import { describe, expect, it } from 'vitest';
import { TEST_PRODUCT, WORDED_PRODUCT } from '../testing/product';
import { createArchiveTools } from './archive-tools';

describe('createArchiveTools', () => {
  const { archive, unarchive, findArchived, foundArchived } = createArchiveTools(
    TEST_PRODUCT,
    'sketchId',
  );

  it('names the tools in the product’s style, archive destructive and unarchive a write', () => {
    expect(archive.mcp.tool).toBe('archive_sketch');
    expect(unarchive.mcp.tool).toBe('unarchive_sketch');
    expect(archive.behaviour).toBe('destructive');
    expect(unarchive.behaviour).toBe('write');
    expect(archive.description).toContain('unarchive_sketch');
    expect(unarchive.description).toContain('find_sketches with archived true');
  });

  it('takes the product’s id key, and an optional folder and team to move out to', () => {
    expect(archive.input.parse({ sketchId: 's1' })).toEqual({ sketchId: 's1' });
    expect(archive.input.safeParse({}).success).toBe(false);
    expect(unarchive.input.parse({ sketchId: 's1' })).toEqual({ sketchId: 's1' });
    expect(unarchive.input.parse({ sketchId: 's1', folderId: 'f1', teamId: 't1' })).toEqual({
      sketchId: 's1',
      folderId: 'f1',
      teamId: 't1',
    });
  });

  it('answers what moved and where', () => {
    expect(archive.output.parse({ archived: 'sketch', id: 's1', name: 'A' })).toBeTruthy();
    expect(
      unarchive.output.safeParse({
        unarchived: 'sketch',
        id: 's1',
        name: null,
        library: 'personal',
        url: 'https://x/sketch/s1',
      }).success,
    ).toBe(true);
    expect(findArchived.parse(true)).toBe(true);
    expect(foundArchived.safeParse(false).success).toBe(false);
  });

  it('words the descriptions as the product does', () => {
    const worded = createArchiveTools(WORDED_PRODUCT, 'sketchId');
    expect(worded.archive.mcp.title).toBe('Archive a drawing');
    expect(worded.unarchive.description).toContain('archived drawings');
  });
});
