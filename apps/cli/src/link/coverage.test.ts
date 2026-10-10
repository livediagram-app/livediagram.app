import { describe, expect, it } from 'vitest';
import { fakeIo } from '../testing/fake-io';
import { hostDoc, linkContext, linkHost } from '../testing/link-host';
import { parseLinkFile } from './link-file';
import { isCovered, readCoverage } from './coverage';

// Coverage (docs/specs/027-repositories/blueprints/repository-link.md "Coverage"): the covered folder's subtree in
// the personal or a team library, the listed documents wherever they are, and each one's folder path.

const linkOf = (covers: string) => parseLinkFile(`[covers]\n${covers}\n`, '/repo/livediagram.toml');

const folders = [
  { id: 'games', name: 'Minigames', parentId: null, teamId: null },
  { id: 'screens', name: 'Screens', parentId: 'games', teamId: null },
  { id: 'other', name: 'Other', parentId: null, teamId: null },
  { id: 'arch', name: 'Architecture', parentId: null, teamId: 'team-1' },
  { id: 'arch-sub', name: 'Sub folder', parentId: 'arch', teamId: 'team-1' },
];
const docs = [
  hostDoc('d-home', 'Home', { folderId: 'screens' }),
  hostDoc('d-top', 'Top', { folderId: 'games' }),
  hostDoc('d-other', 'Elsewhere', { folderId: 'other' }),
  hostDoc('d-root', 'At root'),
  hostDoc('d-team', 'Platform', { folderId: 'arch-sub', teamId: 'team-1' }),
  hostDoc('d-gone', 'Trashed', { folderId: 'games', state: 'trashed' }),
];

function setup(covers: string, logs: string[] = []) {
  const io = fakeIo({
    routes: [linkHost(docs, folders, [{ id: 'team-1', name: 'Platform team' }]).route],
  });
  return {
    io,
    run: () =>
      readCoverage(
        linkContext(io, (l) => logs.push(l)),
        linkOf(covers),
      ),
  };
}

describe('readCoverage', () => {
  it('covers the folder’s subtree with each document’s folder path', async () => {
    const logs: string[] = [];
    const coverage = await setup('folder = "games"', logs).run();
    expect(coverage.folder).toEqual({ id: 'games', found: true });
    expect(coverage.documents).toEqual([
      {
        id: 'd-home',
        name: 'Home',
        folderPath: ['screens'],
        indexFolder: 'My documents/Minigames/Screens',
        library: 'personal',
        savedAt: docs[0]!.savedAt,
      },
      expect.objectContaining({
        id: 'd-top',
        folderPath: [],
        indexFolder: 'My documents/Minigames',
      }),
    ]);
    expect(logs).toEqual(['coverage 2 covered folder found']);
  });

  it('finds a team folder, and covers listed documents anywhere, once', async () => {
    const coverage = await setup(
      'folder = "arch"\ndocuments = ["d-team", "d-root", "d-shared"]',
    ).run();
    expect(coverage.documents.map((d) => [d.id, d.folderPath, d.indexFolder, d.library])).toEqual([
      ['d-team', ['sub-folder'], 'Platform team/Architecture/Sub folder', 'Platform team'],
      ['d-root', [], 'My documents', 'personal'],
      ['d-shared', [], 'Shared with me', 'Shared with me'],
    ]);
    expect(coverage.documents[2]!.name).toBeNull();
    expect(isCovered(coverage, 'd-root')).toBe(true);
    expect(isCovered(coverage, 'd-other')).toBe(false);
  });

  it('says once when the covered folder is not readable, and judges nothing outside then (RL6)', async () => {
    const logs: string[] = [];
    const { io, run } = setup('folder = "missing"\ndocuments = ["d-root"]', logs);
    const coverage = await run();
    expect(coverage.folder).toEqual({ id: 'missing', found: false });
    expect(io.err()).toBe('folder missing is not readable by this account\n');
    expect(logs).toEqual(['coverage 1 covered folder unreadable']);
    expect(isCovered(coverage, 'd-root')).toBe(true);
    expect(isCovered(coverage, 'd-other')).toBeNull();
  });

  it('covers only listed documents when the link names no folder', async () => {
    const logs: string[] = [];
    const coverage = await setup('documents = ["d-top"]', logs).run();
    expect(coverage.folder).toBeNull();
    expect(coverage.documents.map((d) => d.id)).toEqual(['d-top']);
    expect(logs).toEqual(['coverage 1 covered folder -']);
  });
});
