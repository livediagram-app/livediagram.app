import { describe, expect, it } from 'vitest';
import { fakeIo } from '../testing/fake-io';
import { SYNC_REPORTS_KEPT } from './constants';
import { parseLinkFile } from './link-file';
import { linkIdOf, linkStateDir, readLinkState, saveReport, writeLinkState } from './local-state';

// The local sync state (docs/specs/027-repositories/blueprints/repository-link.md "Data and persistence"): per link
// and work tree, under the git directory, else the cache; never committed.

const link = parseLinkFile('[covers]\nfolder = "f"\n', '/repo/livediagram.toml');

describe('linkIdOf', () => {
  it('is the first 16 hex of SHA-256 of the link file’s real path', async () => {
    const id = await linkIdOf('/repo/livediagram.toml');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(await linkIdOf('/repo/livediagram.toml')).toBe(id);
    expect(await linkIdOf('/other/livediagram.toml')).not.toBe(id);
  });
});

describe('linkStateDir', () => {
  it('sits in the work tree’s git directory, else in the cache', async () => {
    const id = await linkIdOf(link.path);
    const inGit = fakeIo({
      tool: (command, args) =>
        command === 'git' && args.join(' ') === '-C /repo rev-parse --absolute-git-dir'
          ? { code: 0, stdout: '/repo/.git\n' }
          : null,
    });
    expect(await linkStateDir(inGit, link)).toBe(`/repo/.git/livediagram/${id}`);
    expect(await linkStateDir(fakeIo(), link)).toBe(`/home/agent/.cache/livediagram/links/${id}`);
    const notATree = fakeIo({
      env: { XDG_CACHE_HOME: '/xdg' },
      tool: () => ({ code: 128, stdout: '' }),
    });
    expect(await linkStateDir(notATree, link)).toBe(`/xdg/livediagram/links/${id}`);
  });
});

describe('readLinkState and writeLinkState', () => {
  it('round-trips the recorded documents, 0600 in a 0700 directory', async () => {
    const io = fakeIo();
    const state = {
      version: 1 as const,
      linkPath: link.path,
      documents: { d1: { name: 'Home', tabs: { t1: { rev: 3, syncedAt: 5 } } } },
    };
    await writeLinkState(io, '/state', state);
    expect(io.fileMap.get('/state/state.json')!.mode).toBe(0o600);
    expect(io.dirMap.has('/state')).toBe(true);
    expect(await readLinkState(io, '/state', link.path)).toEqual(state);
  });

  it('starts empty from a missing, unreadable or other-version state', async () => {
    const empty = { version: 1, linkPath: link.path, documents: {} };
    expect(await readLinkState(fakeIo(), '/state', link.path)).toEqual(empty);
    for (const text of ['{', '{"version":2,"documents":{}}', '{"version":1}', 'null'])
      expect(
        await readLinkState(fakeIo({ files: { '/state/state.json': text } }), '/state', link.path),
      ).toEqual(empty);
  });
});

describe('saveReport', () => {
  it('keeps the newest SYNC_REPORTS_KEPT reports', async () => {
    const io = fakeIo();
    for (let i = 0; i < SYNC_REPORTS_KEPT + 2; i++)
      await saveReport(io, '/state', {
        startedAt: 1_000_000 + i,
        finishedAt: 1_000_001 + i,
        command: 'sync',
        lines: [`line ${i}`],
        exit: 0,
      });
    const reports = [...io.fileMap.keys()].filter((k) => k.startsWith('/state/reports/')).sort();
    expect(reports).toHaveLength(SYNC_REPORTS_KEPT);
    expect(reports[0]).toBe('/state/reports/1000002-4242.json');
    expect(JSON.parse(io.fileMap.get(reports.at(-1)!)!.data)).toEqual({
      version: 1,
      startedAt: 1_000_021,
      finishedAt: 1_000_022,
      command: 'sync',
      lines: ['line 21'],
      exit: 0,
    });
    expect(io.fileMap.get(reports[0]!)!.mode).toBe(0o600);
  });
});
