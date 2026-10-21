import { describe, expect, it } from 'vitest';
import { fakeIo } from '../testing/fake-io';
import { parseLinkFile } from './link-file';
import { mirrorFileText, type MirrorFile } from './mirror-file';
import { scanMirrorDir } from './mirror-scan';
import { sha256 } from '../sync/pull-file';

// Scanning the mirror directory (docs/specs/027-repositories/blueprints/repository-link.md "Scanning the mirror
// directory"): every *.liveplanner.json under dir, classified in order.

const HOST = 'https://liveplanner.app';
const link = parseLinkFile(
  '[covers]\nfolder = "f1"\n[mirror]\nlevel = "files"\n',
  '/repo/liveplanner.toml',
);

const mirrorOf = (id: string, host = HOST): MirrorFile => ({
  kind: 'liveplanner.document',
  schemaVersion: 1,
  document: {
    id,
    name: `Doc ${id}`,
    presentation: null,
    tabs: [{ id: 't1', name: 'Main', elements: [] }],
  },
  liveplannerSync: { host, tabs: { t1: { rev: 1, hash: 'h', settingsHash: 's' } } },
});

describe('scanMirrorDir', () => {
  it('classifies every mirror file under dir, in path order', async () => {
    const { liveplannerSync: _s, ...handWritten } = mirrorOf('d-new');
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.liveplanner.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.liveplanner.json': '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> main\n',
        '/repo/diagrams/c.liveplanner.json': '{',
        '/repo/diagrams/d.liveplanner.json': JSON.stringify(handWritten),
        '/repo/diagrams/e.liveplanner.json': mirrorFileText(mirrorOf('d2', 'https://self.example')),
        '/repo/diagrams/f.liveplanner.json': JSON.stringify({
          ...handWritten,
          liveplannerSync: { tabs: 1 },
        }),
        '/repo/diagrams/fa.liveplanner.json': mirrorFileText(mirrorOf('d7', 'not a url')),
        '/repo/diagrams/sub/g.liveplanner.json': mirrorFileText(mirrorOf('d3')),
        '/repo/diagrams/INDEX.md': '',
        '/repo/diagrams/a.md': '',
        '/repo/diagrams/.hidden/h.liveplanner.json': mirrorFileText(mirrorOf('d4')),
        '/repo/diagrams/nested/liveplanner.toml': '',
        '/repo/diagrams/nested/i.liveplanner.json': mirrorFileText(mirrorOf('d5')),
        '/repo/elsewhere/j.liveplanner.json': mirrorFileText(mirrorOf('d6')),
      },
      links: { '/repo/diagrams/linked': '/home/agent' },
    });
    const scanned = await scanMirrorDir(io, link, HOST);
    expect(scanned.map((s) => [s.path, s.class])).toEqual([
      ['a.liveplanner.json', 'tracked'],
      ['b.liveplanner.json', 'conflicted'],
      ['c.liveplanner.json', 'invalid'],
      ['d.liveplanner.json', 'local-new'],
      ['e.liveplanner.json', 'foreign-host'],
      ['f.liveplanner.json', 'invalid'],
      ['fa.liveplanner.json', 'invalid'],
      ['sub/g.liveplanner.json', 'tracked'],
    ]);
    expect(scanned[2]).toMatchObject({ message: 'not JSON' });
    expect(scanned[3]).toMatchObject({ documentId: 'd-new' });
    expect(scanned[4]).toMatchObject({ host: 'https://self.example' });
    expect(scanned[5]).toMatchObject({ message: 'not pulled by the CLI (no liveplannerSync)' });
    expect(scanned[6]).toMatchObject({ message: 'liveplannerSync.host is not a URL' });
    const tracked = scanned[0]!;
    expect(tracked.class === 'tracked' && tracked.file.document.id).toBe('d1');
    expect(tracked.class === 'tracked' && tracked.hashes.t1!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses two files naming one document as duplicates of each other', async () => {
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.liveplanner.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.liveplanner.json': mirrorFileText(mirrorOf('d1')),
      },
    });
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      {
        class: 'duplicate',
        path: 'a.liveplanner.json',
        documentId: 'd1',
        other: 'b.liveplanner.json',
        bytes: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      {
        class: 'duplicate',
        path: 'b.liveplanner.json',
        documentId: 'd1',
        other: 'a.liveplanner.json',
        bytes: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ]);
  });

  it('finds nothing where the directory does not exist yet', async () => {
    expect(await scanMirrorDir(fakeIo(), link, HOST)).toEqual([]);
  });

  it('reads a www. host as the link’s', async () => {
    const www = parseLinkFile(
      'host = "https://www.liveplanner.app"\n[covers]\nfolder = "f1"\n',
      '/repo/liveplanner.toml',
    );
    const io = fakeIo({
      files: { '/repo/diagrams/a.liveplanner.json': mirrorFileText(mirrorOf('d1')) },
    });
    expect((await scanMirrorDir(io, www, HOST))[0]!.class).toBe('tracked');
  });
});

describe('a file gone between the listing and the read', () => {
  it('is invalid', async () => {
    const io = fakeIo({ files: { '/repo/diagrams/a.liveplanner.json': '{}' } });
    io.files.read = async () => null;
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      {
        class: 'invalid',
        path: 'a.liveplanner.json',
        message: 'not JSON',
        bytes: await sha256(''),
      },
    ]);
  });
});
