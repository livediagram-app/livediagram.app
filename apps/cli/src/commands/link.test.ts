import { describe, expect, it } from 'vitest';
import { run } from '../main';
import { fakeIo, TOKEN, type FakeIo } from '../testing/fake-io';
import { HOST, hostDoc, linkHost, type HostDoc } from '../testing/link-host';

// `link init`, `link status` and `link ls` through the whole command (docs/specs/027-repositories/blueprints/
// repository-link.md "`link init`", "The folder picker", "`link status` and `link ls`").

const folders = [
  { id: 'games-0001', name: 'Minigames', parentId: null, teamId: null },
  { id: 'games-0002', name: 'Screens', parentId: 'games-0001', teamId: null },
  { id: 'other-0001', name: 'Minigames', parentId: null, teamId: 't1' },
];
const DOC = 'aaaa1111-0000-4000-8000-000000000001';

function setup(
  docs: HostDoc[] = [hostDoc(DOC, 'Home screen', { folderId: 'games-0002' })],
  more: Parameters<typeof fakeIo>[0] = {},
) {
  const host = linkHost(docs, folders, [{ id: 't1', name: 'Platform' }]);
  const io = fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [host.route], ...more });
  return { host, io };
}

async function cli(io: FakeIo, ...argv: string[]) {
  const [outBefore, errBefore] = [io.out().length, io.err().length];
  const code = await run(argv, io);
  return { code, out: io.out().slice(outBefore), err: io.err().slice(errBefore) };
}

const LINK = '/work/livediagram.toml';

describe('link init', () => {
  it('writes the link file byte for byte and prints its path', async () => {
    const { io } = setup();
    expect(
      await cli(io, 'link', 'init', '--folder', 'screens', '--doc', DOC, '--level', 'files'),
    ).toEqual({
      code: 0,
      out: `${LINK}\n`,
      err: '',
    });
    expect(io.fileMap.get(LINK)!.data).toBe(
      [
        `# This repository's diagrams live in livediagram; see ${HOST}/help/developers/repositories/`,
        `host = "${HOST}"`,
        '',
        '[covers]',
        'folder = "games-0002"',
        `documents = ["${DOC}"]`,
        '',
        '[mirror]',
        'level = "files"',
        '',
      ].join('\n'),
    );
    expect(await cli(io, 'link', 'init', '--doc', DOC)).toEqual({
      code: 1,
      out: '',
      err: `error: ${LINK} already exists\nhint: edit it, or run link init in another directory\n`,
    });
  });

  it('resolves a folder by id prefix, and names the candidates or the nearest', async () => {
    const { io } = setup();
    expect((await cli(io, 'link', 'init', '--folder', 'games-0001')).code).toBe(0);
    io.fileMap.delete(LINK);
    expect(await cli(io, 'link', 'init', '--folder', 'minigames')).toEqual({
      code: 3,
      out: '',
      err: [
        'error: "minigames" matches 2 folders',
        '  games-0001  "Minigames"  personal',
        '  othe  "Minigames"  Platform',
        'hint: livediagram link init --folder games-0001',
        '',
      ].join('\n'),
    });
    expect(await cli(io, 'link', 'init', '--folder', 'mini')).toMatchObject({
      code: 3,
      err: expect.stringContaining(
        'error: no folder matches "mini"; the nearest:\n  games-0001  "Minigames"',
      ),
    });
    expect(await cli(io, 'link', 'init', '--folder', 'zzz')).toMatchObject({
      code: 3,
      err: 'error: no folder matches "zzz"\nhint: livediagram link init, in a terminal, to pick one\n',
    });
  });

  it('refuses a share link as a document', async () => {
    const { io } = setup();
    expect(await cli(io, 'link', 'init', '--doc', `${HOST}/document/shared?s=CODE`)).toMatchObject({
      code: 2,
      err: expect.stringContaining('is a share link; a link file holds document ids'),
    });
  });

  it('refuses without --folder or --doc where it is not a terminal, listing the folders', async () => {
    const { io } = setup();
    const result = await cli(io, 'link', 'init', '--level', 'files');
    expect(result.code).toBe(2);
    expect(result.err).toContain(
      '  livediagram link init --folder games-0001 --level files  # Minigames (personal)\n',
    );
    expect(io.prompts).toEqual([]);
    expect(io.fileMap.has(LINK)).toBe(false);
  });

  it('shows the picker on a terminal, and links the folder chosen', async () => {
    const { io } = setup(undefined, { stdinIsTTY: true, stdoutIsTTY: true, lines: ['2'] });
    const result = await cli(io, 'link', 'init');
    expect(result.code).toBe(0);
    expect(result.err).toContain('linking "Minigames/Screens" (personal)');
    expect(io.fileMap.get(LINK)!.data).toContain('folder = "games-0002"');
  });

  it('says when there are no folders to link, on a terminal or not', async () => {
    const empty = linkHost([], []);
    for (const tty of [true, false]) {
      const io = fakeIo({
        env: { LIVEDIAGRAM_TOKEN: TOKEN },
        routes: [empty.route],
        stdinIsTTY: tty,
        stdoutIsTTY: tty,
      });
      expect(await cli(io, 'link', 'init')).toMatchObject({
        code: 3,
        err: expect.stringContaining('there are no folders in https://livediagram.app to link'),
      });
    }
  });

  it('says once that the mirror is as public as a repository with a remote', async () => {
    const line =
      'this repository has a git remote: its mirror files and INDEX.md are as public as the repository; the ids in livediagram.toml grant nothing\n';
    for (const [answer, says, logged] of [
      [{ code: 0, stdout: 'origin\n' }, line, 'yes'],
      [{ code: 0, stdout: '' }, '', 'no'],
      [null, '', 'unknown'],
    ] as const) {
      const { io } = setup(undefined, {
        env: { LIVEDIAGRAM_TOKEN: TOKEN, LIVEDIAGRAM_DEBUG: '1' },
        tool: (command, args) => (command === 'git' && args.includes('remote') ? answer : null),
      });
      const { err } = await cli(io, 'link', 'init', '--doc', DOC);
      expect(err.split('\n').filter((l) => !l.startsWith('['))).toEqual(
        says ? [says.trim(), ''] : [''],
      );
      expect(err).toContain(`[link] remote ${logged}\n`);
    }
  });
});

describe('link status', () => {
  it('prints every covered document with its state, a refused file and a failure, and exits 0', async () => {
    const docs = [
      hostDoc(DOC, 'Home screen', { folderId: 'games-0002' }),
      hostDoc('bbbb2222-0000-4000-8000-000000000002', 'Menu', { folderId: 'games-0001' }),
      hostDoc('cccc3333-0000-4000-8000-000000000003', 'Busy', { folderId: 'games-0001' }),
    ];
    const { io, host } = setup(docs, {
      files: {
        [LINK]: '[covers]\nfolder = "games-0001"\n[mirror]\nlevel = "files"\n',
      },
    });
    await cli(io, 'sync');
    host.edit('bbbb2222-0000-4000-8000-000000000002');
    host.doc('cccc3333-0000-4000-8000-000000000003').state = 503;
    io.fileMap.set('/work/diagrams/bad.livediagram.json', { data: '{', mode: 0o644 });
    const before = new Map([...io.fileMap].map(([k, v]) => [k, v.data]));
    const result = await cli(io, 'link', 'status');
    expect(result).toEqual({
      code: 0,
      out: [
        '?        cccc  "Busy"         diagrams/busy.livediagram.json',
        'behind   bbbb  "Menu"         diagrams/menu.livediagram.json',
        'in-step  aaaa  "Home screen"  diagrams/screens/home-screen.livediagram.json',
        'invalid  -                    diagrams/bad.livediagram.json',
        '1 in-step · 1 behind · 1 invalid · 1 ?',
        '',
      ].join('\n'),
      err: '! "Busy": https://livediagram.app failed (HTTP 503); files kept\n',
    });
    for (const [k, v] of before)
      if (k.startsWith('/work/')) expect(io.fileMap.get(k)?.data).toBe(v);
  });

  it('names each link under --all, with states from the recorded revisions at index', async () => {
    const { io } = setup(undefined, {
      files: {
        [LINK]: '[covers]\nfolder = "games-0001"\n',
        '/work/b/livediagram.toml': '[covers]\nfolder = "other-0001"\n',
      },
    });
    expect((await cli(io, 'link', 'status', '--all')).out).toBe(
      [
        'b/livediagram.toml',
        '0 documents',
        '',
        'livediagram.toml',
        'new  aaaa  "Home screen"',
        '1 new',
        '',
      ].join('\n'),
    );
  });
});

describe('link ls', () => {
  it('lists the covered documents as document ls does, naming an unreadable listed one', async () => {
    const docs = [
      hostDoc(DOC, 'Home screen', { folderId: 'games-0002' }),
      hostDoc('dddd4444-0000-4000-8000-000000000004', 'Shared', { teamId: 'elsewhere' }),
      hostDoc('eeee5555-0000-4000-8000-000000000005', 'Binned', {
        teamId: 'elsewhere',
        state: 'trashed',
      }),
      hostDoc('ffff6666-0000-4000-8000-000000000006', 'Slow', { teamId: 'elsewhere', state: 429 }),
    ];
    const { io } = setup(docs, {
      files: {
        [LINK]:
          '[covers]\nfolder = "games-0001"\ndocuments = ["dddd4444-0000-4000-8000-000000000004", "eeee5555-0000-4000-8000-000000000005", "ffff6666-0000-4000-8000-000000000006", "gone-0000"]\n',
      },
    });
    const result = await cli(io, 'link', 'ls', '--limit', '1');
    expect(result.code).toBe(0);
    expect(result.out).toBe(
      'aaaa  "Home screen"  personal  2026-10-05\n… 1 more; --limit 2, or narrow with a query\n',
    );
    expect(result.err).toBe(
      'ffff6666-0000-4000-8000-000000000006: https://livediagram.app is rate limiting this token\nunreadable: gone-0000\n',
    );
    expect(
      JSON.parse((await cli(io, 'link', 'ls', '--json')).out).documents.map(
        (d: { name: string }) => d.name,
      ),
    ).toEqual(['Home screen', 'Shared']);
  });
});

describe('link status, the files a sync would refuse or remove', () => {
  it('names a gone file changed here, an unreadable one, a lowered one and a hand-written one', async () => {
    const docs = [
      hostDoc(DOC, 'Home screen', { folderId: 'games-0002' }),
      hostDoc('bbbb2222-0000-4000-8000-000000000002', 'Menu', { folderId: 'games-0001' }),
      hostDoc('cccc3333-0000-4000-8000-000000000003', 'Zed', { folderId: 'games-0001' }),
    ];
    const { io, host } = setup(docs, {
      files: { [LINK]: '[covers]\nfolder = "games-0001"\n[mirror]\nlevel = "files"\n' },
    });
    await cli(io, 'sync');
    const menu = '/work/diagrams/menu.livediagram.json';
    io.fileMap.set(menu, {
      data: io.fileMap.get(menu)!.data.replace('box"', 'box!"'),
      mode: 0o644,
    });
    host.doc('bbbb2222-0000-4000-8000-000000000002').state = 'trashed';
    host.doc('cccc3333-0000-4000-8000-000000000003').state = 'purged';
    expect((await cli(io, 'link', 'status')).out).toBe(
      [
        'gone-changed  bbbb  "Menu"         diagrams/menu.livediagram.json',
        'unreadable    cccc  "Zed"          diagrams/zed.livediagram.json',
        'in-step       aaaa  "Home screen"  diagrams/screens/home-screen.livediagram.json',
        '1 in-step · 1 unreadable · 1 gone-changed',
        '',
      ].join('\n'),
    );
    io.fileMap.set(LINK, { data: '[covers]\nfolder = "games-0001"\n', mode: 0o644 });
    io.fileMap.set('/work/diagrams/hand.livediagram.json', {
      data: JSON.stringify({
        kind: 'livediagram.document',
        schemaVersion: 1,
        document: { id: 'd-hand', name: 'By hand', tabs: [] },
      }),
      mode: 0o644,
    });
    const lowered = (await cli(io, 'link', 'status')).out;
    expect(lowered).toContain('lowered          -');
    expect(lowered).toContain('diagrams/screens/home-screen.livediagram.json\n');
    expect(lowered).toContain('local-new        -');
    expect(lowered).toContain('lowered-changed  -');
  });
});
