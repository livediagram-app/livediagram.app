import { describe, expect, it } from 'vitest';
import { fakeIo } from '../testing/fake-io';
import { parseLinkFile } from './link-file';
import { mirrorFileText, type MirrorFile } from './mirror-file';
import { scanMirrorDir } from './mirror-scan';
import { sha256 } from '../sync/pull-file';

// Scanning the mirror directory (docs/specs/027-repositories/blueprints/repository-link.md "Scanning the mirror
// directory"): every *.livehuddle.json under dir, classified in order.

const HOST = 'https://www.livehuddle.app';
const link = parseLinkFile(
  '[covers]\nfolder = "f1"\n[mirror]\nlevel = "files"\n',
  '/repo/livehuddle.toml',
);

const mirrorOf = (id: string, host = HOST): MirrorFile => ({
  kind: 'livehuddle.document',
  schemaVersion: 1,
  document: {
    id,
    name: `Doc ${id}`,
    presentation: null,
    tabs: [{ id: 't1', name: 'Main', elements: [] }],
  },
  livehuddleSync: { host, tabs: { t1: { rev: 1, hash: 'h', settingsHash: 's' } } },
});

describe('scanMirrorDir', () => {
  it('classifies every mirror file under dir, in path order', async () => {
    const { livehuddleSync: _s, ...handWritten } = mirrorOf('d-new');
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.livehuddle.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.livehuddle.json': '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> main\n',
        '/repo/diagrams/c.livehuddle.json': '{',
        '/repo/diagrams/d.livehuddle.json': JSON.stringify(handWritten),
        '/repo/diagrams/e.livehuddle.json': mirrorFileText(mirrorOf('d2', 'https://self.example')),
        '/repo/diagrams/f.livehuddle.json': JSON.stringify({
          ...handWritten,
          livehuddleSync: { tabs: 1 },
        }),
        '/repo/diagrams/fa.livehuddle.json': mirrorFileText(mirrorOf('d7', 'not a url')),
        '/repo/diagrams/sub/g.livehuddle.json': mirrorFileText(mirrorOf('d3')),
        '/repo/diagrams/INDEX.md': '',
        '/repo/diagrams/a.md': '',
        '/repo/diagrams/.hidden/h.livehuddle.json': mirrorFileText(mirrorOf('d4')),
        '/repo/diagrams/nested/livehuddle.toml': '',
        '/repo/diagrams/nested/i.livehuddle.json': mirrorFileText(mirrorOf('d5')),
        '/repo/elsewhere/j.livehuddle.json': mirrorFileText(mirrorOf('d6')),
      },
      links: { '/repo/diagrams/linked': '/home/agent' },
    });
    const scanned = await scanMirrorDir(io, link, HOST);
    expect(scanned.map((s) => [s.path, s.class])).toEqual([
      ['a.livehuddle.json', 'tracked'],
      ['b.livehuddle.json', 'conflicted'],
      ['c.livehuddle.json', 'invalid'],
      ['d.livehuddle.json', 'local-new'],
      ['e.livehuddle.json', 'foreign-host'],
      ['f.livehuddle.json', 'invalid'],
      ['fa.livehuddle.json', 'invalid'],
      ['sub/g.livehuddle.json', 'tracked'],
    ]);
    expect(scanned[2]).toMatchObject({ message: 'not JSON' });
    expect(scanned[3]).toMatchObject({ documentId: 'd-new' });
    expect(scanned[4]).toMatchObject({ host: 'https://self.example' });
    expect(scanned[5]).toMatchObject({ message: 'not pulled by the CLI (no livehuddleSync)' });
    expect(scanned[6]).toMatchObject({ message: 'livehuddleSync.host is not a URL' });
    const tracked = scanned[0]!;
    expect(tracked.class === 'tracked' && tracked.file.document.id).toBe('d1');
    expect(tracked.class === 'tracked' && tracked.hashes.t1!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses two files naming one document as duplicates of each other', async () => {
    const io = fakeIo({
      files: {
        '/repo/diagrams/a.livehuddle.json': mirrorFileText(mirrorOf('d1')),
        '/repo/diagrams/b.livehuddle.json': mirrorFileText(mirrorOf('d1')),
      },
    });
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      {
        class: 'duplicate',
        path: 'a.livehuddle.json',
        documentId: 'd1',
        other: 'b.livehuddle.json',
        bytes: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      {
        class: 'duplicate',
        path: 'b.livehuddle.json',
        documentId: 'd1',
        other: 'a.livehuddle.json',
        bytes: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ]);
  });

  it('finds nothing where the directory does not exist yet', async () => {
    expect(await scanMirrorDir(fakeIo(), link, HOST)).toEqual([]);
  });

  it('reads a www. host as the link’s', async () => {
    const www = parseLinkFile(
      'host = "https://www.livehuddle.app"\n[covers]\nfolder = "f1"\n',
      '/repo/livehuddle.toml',
    );
    const io = fakeIo({
      files: { '/repo/diagrams/a.livehuddle.json': mirrorFileText(mirrorOf('d1')) },
    });
    expect((await scanMirrorDir(io, www, HOST))[0]!.class).toBe('tracked');
  });
});

describe('a file gone between the listing and the read', () => {
  it('is invalid', async () => {
    const io = fakeIo({ files: { '/repo/diagrams/a.livehuddle.json': '{}' } });
    io.files.read = async () => null;
    expect(await scanMirrorDir(io, link, HOST)).toEqual([
      {
        class: 'invalid',
        path: 'a.livehuddle.json',
        message: 'not JSON',
        bytes: await sha256(''),
      },
    ]);
  });
});
