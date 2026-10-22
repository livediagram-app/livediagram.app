import { describe, expect, it } from 'vitest';
import { fakeIo } from '../testing/fake-io';
import { parseLinkFile } from './link-file';
import { mirrorFileText, type MirrorFile } from './mirror-file';
import { scanMirrorDir } from './mirror-scan';
import { sha256 } from '../sync/pull-file';

// Scanning the mirror directory (docs/specs/027-repositories/blueprints/repository-link.md "Scanning the mirror
// directory"): every *.livepages.json under dir, classified in order.

const HOST = 'https://livepages.app';
const link = parseLinkFile(
  '[covers]\nfolder = "f1"\n[mirror]\nlevel = "files"\n',
  '/repo/livepages.toml',
);

const mirrorOf = (id: string, host = HOST): MirrorFile => ({
  kind: 'livepages.document',
  schemaVersion: 1,
  document: {
    id,
    name: `Doc ${id}`,
    presentation: null,
    tabs: [{ id: 't1', name: 'Main', elements: [] }],
  },
  livepagesSync: { host, tabs: { t1: { rev: 1, hash: 'h', settingsHash: 's' } } },
});

describe('scanMirrorDir', () => {
  it('classifies every mirror file under dir, in path order', async () => {
    const { livepagesSync: _s, ...handWritten } = mirrorOf('d-new');
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.livepages.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.livepages.json': '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> main\n',
        '/repo/diagrams/c.livepages.json': '{',
        '/repo/diagrams/d.livepages.json': JSON.stringify(handWritten),
        '/repo/diagrams/e.livepages.json': mirrorFileText(mirrorOf('d2', 'https://self.example')),
        '/repo/diagrams/f.livepages.json': JSON.stringify({
          ...handWritten,
          livepagesSync: { tabs: 1 },
        }),
        '/repo/diagrams/fa.livepages.json': mirrorFileText(mirrorOf('d7', 'not a url')),
        '/repo/diagrams/sub/g.livepages.json': mirrorFileText(mirrorOf('d3')),
        '/repo/diagrams/INDEX.md': '',
        '/repo/diagrams/a.md': '',
        '/repo/diagrams/.hidden/h.livepages.json': mirrorFileText(mirrorOf('d4')),
        '/repo/diagrams/nested/livepages.toml': '',
        '/repo/diagrams/nested/i.livepages.json': mirrorFileText(mirrorOf('d5')),
        '/repo/elsewhere/j.livepages.json': mirrorFileText(mirrorOf('d6')),
      },
      links: { '/repo/diagrams/linked': '/home/agent' },
    });
    const scanned = await scanMirrorDir(io, link, HOST);
    expect(scanned.map((s) => [s.path, s.class])).toEqual([
      ['a.livepages.json', 'tracked'],
      ['b.livepages.json', 'conflicted'],
      ['c.livepages.json', 'invalid'],
      ['d.livepages.json', 'local-new'],
      ['e.livepages.json', 'foreign-host'],
      ['f.livepages.json', 'invalid'],
      ['fa.livepages.json', 'invalid'],
      ['sub/g.livepages.json', 'tracked'],
    ]);
    expect(scanned[2]).toMatchObject({ message: 'not JSON' });
    expect(scanned[3]).toMatchObject({ documentId: 'd-new' });
    expect(scanned[4]).toMatchObject({ host: 'https://self.example' });
    expect(scanned[5]).toMatchObject({ message: 'not pulled by the CLI (no livepagesSync)' });
    expect(scanned[6]).toMatchObject({ message: 'livepagesSync.host is not a URL' });
    const tracked = scanned[0]!;
    expect(tracked.class === 'tracked' && tracked.file.document.id).toBe('d1');
    expect(tracked.class === 'tracked' && tracked.hashes.t1!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses two files naming one document as duplicates of each other', async () => {
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.livepages.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.livepages.json': mirrorFileText(mirrorOf('d1')),
      },
    });
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      {
        class: 'duplicate',
        path: 'a.livepages.json',
        documentId: 'd1',
        other: 'b.livepages.json',
        bytes: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      {
        class: 'duplicate',
        path: 'b.livepages.json',
        documentId: 'd1',
        other: 'a.livepages.json',
        bytes: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ]);
  });

  it('finds nothing where the directory does not exist yet', async () => {
    expect(await scanMirrorDir(fakeIo(), link, HOST)).toEqual([]);
  });

  it('reads a www. host as the link’s', async () => {
    const www = parseLinkFile(
      'host = "https://www.livepages.app"\n[covers]\nfolder = "f1"\n',
      '/repo/livepages.toml',
    );
    const io = fakeIo({
      files: { '/repo/diagrams/a.livepages.json': mirrorFileText(mirrorOf('d1')) },
    });
    expect((await scanMirrorDir(io, www, HOST))[0]!.class).toBe('tracked');
  });
});

describe('a file gone between the listing and the read', () => {
  it('is invalid', async () => {
    const io = fakeIo({ files: { '/repo/diagrams/a.livepages.json': '{}' } });
    io.files.read = async () => null;
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      {
        class: 'invalid',
        path: 'a.livepages.json',
        message: 'not JSON',
        bytes: await sha256(''),
      },
    ]);
  });
});
