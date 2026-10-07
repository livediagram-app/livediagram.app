import { describe, expect, it } from 'vitest';
import { fakeIo } from '../testing/fake-io';
import { parseLinkFile } from './link-file';
import { mirrorFileText, type MirrorFile } from './mirror-file';
import { scanMirrorDir } from './mirror-scan';

// Scanning the mirror directory (docs/specs/027-repositories/blueprints/repository-link.md "Scanning the mirror
// directory"): every *.livediagram.json under dir, classified in order.

const HOST = 'https://livediagram.app';
const link = parseLinkFile(
  '[covers]\nfolder = "f1"\n[mirror]\nlevel = "files"\n',
  '/repo/livediagram.toml',
);

const mirrorOf = (id: string, host = HOST): MirrorFile => ({
  kind: 'livediagram.document',
  schemaVersion: 1,
  document: {
    id,
    name: `Doc ${id}`,
    presentation: null,
    tabs: [{ id: 't1', name: 'Main', elements: [] }],
  },
  livediagramSync: { host, tabs: { t1: { rev: 1, hash: 'h', settingsHash: 's' } } },
});

describe('scanMirrorDir', () => {
  it('classifies every mirror file under dir, in path order', async () => {
    const { livediagramSync: _s, ...handWritten } = mirrorOf('d-new');
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.livediagram.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.livediagram.json': '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> main\n',
        '/repo/diagrams/c.livediagram.json': '{',
        '/repo/diagrams/d.livediagram.json': JSON.stringify(handWritten),
        '/repo/diagrams/e.livediagram.json': mirrorFileText(mirrorOf('d2', 'https://self.example')),
        '/repo/diagrams/f.livediagram.json': JSON.stringify({
          ...handWritten,
          livediagramSync: { tabs: 1 },
        }),
        '/repo/diagrams/sub/g.livediagram.json': mirrorFileText(mirrorOf('d3')),
        '/repo/diagrams/INDEX.md': '',
        '/repo/diagrams/a.md': '',
        '/repo/diagrams/.hidden/h.livediagram.json': mirrorFileText(mirrorOf('d4')),
        '/repo/diagrams/nested/livediagram.toml': '',
        '/repo/diagrams/nested/i.livediagram.json': mirrorFileText(mirrorOf('d5')),
        '/repo/elsewhere/j.livediagram.json': mirrorFileText(mirrorOf('d6')),
      },
      links: { '/repo/diagrams/linked': '/home/agent' },
    });
    const scanned = await scanMirrorDir(io, link, HOST);
    expect(scanned.map((s) => [s.path, s.class])).toEqual([
      ['a.livediagram.json', 'tracked'],
      ['b.livediagram.json', 'conflicted'],
      ['c.livediagram.json', 'invalid'],
      ['d.livediagram.json', 'local-new'],
      ['e.livediagram.json', 'foreign-host'],
      ['f.livediagram.json', 'invalid'],
      ['sub/g.livediagram.json', 'tracked'],
    ]);
    expect(scanned[2]).toMatchObject({ message: 'not JSON' });
    expect(scanned[3]).toMatchObject({ documentId: 'd-new' });
    expect(scanned[4]).toMatchObject({ host: 'https://self.example' });
    expect(scanned[5]).toMatchObject({ message: 'not pulled by the CLI (no livediagramSync)' });
    const tracked = scanned[0]!;
    expect(tracked.class === 'tracked' && tracked.file.document.id).toBe('d1');
    expect(tracked.class === 'tracked' && tracked.hashes.t1!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses two files naming one document as duplicates of each other', async () => {
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.livediagram.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.livediagram.json': mirrorFileText(mirrorOf('d1')),
      },
    });
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      {
        class: 'duplicate',
        path: 'a.livediagram.json',
        documentId: 'd1',
        other: 'b.livediagram.json',
      },
      {
        class: 'duplicate',
        path: 'b.livediagram.json',
        documentId: 'd1',
        other: 'a.livediagram.json',
      },
    ]);
  });

  it('finds nothing where the directory does not exist yet', async () => {
    expect(await scanMirrorDir(fakeIo(), link, HOST)).toEqual([]);
  });

  it('reads a www. host as the link’s', async () => {
    const www = parseLinkFile(
      'host = "https://www.livediagram.app"\n[covers]\nfolder = "f1"\n',
      '/repo/livediagram.toml',
    );
    const io = fakeIo({
      files: { '/repo/diagrams/a.livediagram.json': mirrorFileText(mirrorOf('d1')) },
    });
    expect((await scanMirrorDir(io, www, HOST))[0]!.class).toBe('tracked');
  });
});

describe('a file gone between the listing and the read', () => {
  it('is invalid', async () => {
    const io = fakeIo({ files: { '/repo/diagrams/a.livediagram.json': '{}' } });
    io.files.read = async () => null;
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      { class: 'invalid', path: 'a.livediagram.json', message: 'not JSON' },
    ]);
  });
});
