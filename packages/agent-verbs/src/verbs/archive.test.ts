import { describe, expect, it } from 'vitest';
import { createAddressing } from '../addressing';
import { VerbRefusal } from '../define';
import { createFind, type FileSummary } from '../find';
import type { FolderNode } from '../folders';
import { contextOf, DOC_A, DOC_B, fakeApi, TEST_PRODUCT } from '../testing/product';
import { createArchiveVerbs } from './archive';

// `<noun> archive` and `<noun> unarchive` (docs/specs/015-api/cli.md "Commands"), over the test product.

const { readLibraries, searchFiles, listAllFiles } = createFind<
  FileSummary & { ownerId?: string },
  FolderNode,
  'sketches'
>(TEST_PRODUCT);
const { resolveFile } = createAddressing({ product: TEST_PRODUCT, listAllFiles });
const { archive, unarchive } = createArchiveVerbs({
  product: TEST_PRODUCT,
  arg: 'doc',
  resolveFile,
  searchFiles,
  readLibraries,
});

const ARCHIVED = '/sketches?team=all&limit=200&archived=1';
const archived = {
  sketches: [
    { id: DOC_A, name: 'Old plan', savedAt: 5, teamId: null },
    { id: DOC_B, name: 'Older plan', savedAt: 3, teamId: null },
  ],
};
const libraries = {
  '/sketches': { sketches: [] },
  '/folders': { folders: [{ id: 'f0000001-games', name: 'Games', parentId: null }] },
  '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
  '/teams/t1/library': {
    sketches: [],
    folders: [{ id: 'f0000002-crew', name: 'Shared', parentId: null }],
  },
};

// Each POST to a door, with its body.
function posts() {
  const sent: { path: string; body: unknown }[] = [];
  const answer = async (request: Request) => {
    const text = await request.text();
    sent.push({ path: new URL(request.url).pathname, body: text ? JSON.parse(text) : null });
    return Response.json({ sketch: { id: DOC_A, name: 'Old plan' } });
  };
  return { sent, answer };
}

describe('archive', () => {
  it('puts the file it names away and prints the way back', async () => {
    const { sent, answer } = posts();
    const api = fakeApi({
      [`/sketches/${DOC_A}`]: { sketch: { id: DOC_A, name: 'Old plan' } },
      [`/sketches/${DOC_A}/archive`]: answer,
    });
    const output = await archive.run!(contextOf(api), { doc: DOC_A });
    expect(sent).toEqual([{ path: `/api/sketches/${DOC_A}/archive`, body: null }]);
    expect(archive.text!(output)).toEqual([
      `- sketch aaaa1111 "Old plan" · in Archived · unarchive: acme sketch unarchive ${DOC_A}`,
    ]);
    expect(archive.quiet!(output)).toEqual([DOC_A]);
    expect(archive.behaviour).toBe('destructive');
    expect(archive.id).toBe('sketch.archive');
  });
});

describe('unarchive', () => {
  it('moves the archived file it names to the top of My Work by default', async () => {
    const { sent, answer } = posts();
    const api = fakeApi({ [ARCHIVED]: archived, [`/sketches/${DOC_A}/unarchive`]: answer });
    const output = await unarchive.run!(contextOf(api), { doc: 'old plan' });
    expect(sent).toEqual([
      { path: `/api/sketches/${DOC_A}/unarchive`, body: { folderId: null, teamId: null } },
    ]);
    expect(unarchive.text!(output)).toEqual([
      '+ sketch aaaa1111 "Old plan" out of Archived · in My Work',
    ]);
    expect(unarchive.behaviour).toBe('write');
  });

  it('files it in a folder, a team folder with its team, or at a team’s top', async () => {
    const { sent, answer } = posts();
    const api = fakeApi({
      ...libraries,
      [ARCHIVED]: archived,
      [`/sketches/${DOC_A}/unarchive`]: answer,
    });
    const ctx = contextOf(api);
    await unarchive.run!(ctx, { doc: 'aaaa1', folder: 'games' });
    await unarchive.run!(ctx, { doc: 'aaaa1', folder: 'Shared', team: 'Crew' });
    const output = await unarchive.run!(ctx, { doc: 'aaaa1', team: 'crew' });
    expect(sent.map((s) => s.body)).toEqual([
      { folderId: 'f0000001-games', teamId: null },
      { folderId: 'f0000002-crew', teamId: 't1' },
      { folderId: null, teamId: 't1' },
    ]);
    expect(unarchive.text!(output)).toEqual([
      '+ sketch aaaa1111 "Old plan" out of Archived · in Crew',
    ]);
  });

  it('refuses a name nothing in Archived has, or one several have, listing them', async () => {
    const api = fakeApi({ [ARCHIVED]: archived });
    const missing = (await unarchive.run!(contextOf(api), { doc: 'nope' }).catch(
      (e: unknown) => e,
    )) as VerbRefusal;
    expect(missing).toBeInstanceOf(VerbRefusal);
    expect(missing).toMatchObject({
      code: 'not_found',
      message: 'nothing in Archived matches "nope"',
      hint: 'acme sketch ls --archived',
    });
    expect(missing.lines).toHaveLength(2);
    const twin = fakeApi({
      [ARCHIVED]: { sketches: [...archived.sketches, { ...archived.sketches[0], id: DOC_B }] },
    });
    await expect(unarchive.run!(contextOf(twin), { doc: 'Old plan' })).rejects.toMatchObject({
      code: 'ambiguous',
      message: '"Old plan" matches 2 sketches in Archived',
    });
  });

  it('refuses a team it is not in, or a My Work folder named with a team', async () => {
    const api = fakeApi({ ...libraries, [ARCHIVED]: archived });
    await expect(
      unarchive.run!(contextOf(api), { doc: 'aaaa1', team: 'Elsewhere' }),
    ).rejects.toMatchObject({ code: 'not_found', lines: ['t1  "Crew"'] });
    await expect(
      unarchive.run!(contextOf(api), { doc: 'aaaa1', folder: 'Games', team: 'Crew' }),
    ).rejects.toMatchObject({ code: 'usage' });
  });
});
