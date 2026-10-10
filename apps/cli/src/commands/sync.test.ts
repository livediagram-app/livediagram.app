import { describe, expect, it } from 'vitest';
import { run } from '../main';
import { linkIdOf } from '../link/local-state';
import { fakeIo, TOKEN, type FakeIo } from '../testing/fake-io';
import { box, hostDoc, linkHost, type HostDoc, type LinkHost } from '../testing/link-host';

// `sync` through the whole command (docs/specs/027-repositories/blueprints/repository-link.md "One sync pass",
// "Actions", "Output lines"), on a fake host whose documents move on.

const folders = [
  { id: 'games', name: 'Minigames', parentId: null, teamId: null },
  { id: 'screens', name: 'Screens', parentId: 'games', teamId: null },
  { id: 'other', name: 'Other', parentId: null, teamId: null },
];

function setup(
  level: 'none' | 'index' | 'files',
  docs: HostDoc[],
  more: Record<string, string> = {},
  links: Record<string, string> = {},
) {
  const host = linkHost(docs, folders);
  const io = fakeIo({
    env: { LIVEDIAGRAM_TOKEN: TOKEN },
    routes: [host.route],
    links,
    files: {
      '/work/livediagram.toml': `[covers]\nfolder = "games"\n[mirror]\nlevel = "${level}"\n`,
      ...more,
    },
  });
  return { host, io };
}

async function sync(io: FakeIo, ...args: string[]) {
  const [outBefore, errBefore] = [io.out().length, io.err().length];
  const code = await run(['sync', ...args], io);
  return { code, out: io.out().slice(outBefore), err: io.err().slice(errBefore) };
}

const home = () => hostDoc('d-home', 'Home screen', { folderId: 'screens' });
const menu = () => hostDoc('d-menu', 'Menu', { folderId: 'games' });
const file = (io: FakeIo, path: string) => io.fileMap.get(path)?.data;
const MIRROR = '/work/diagrams/screens/home-screen.livediagram.json';
const OUTLINE = '/work/diagrams/screens/home-screen.md';
const INDEX = '/work/diagrams/INDEX.md';
const stateDir = async () =>
  `/home/agent/.cache/livediagram/links/${await linkIdOf('/work/livediagram.toml')}`;

describe('sync at files', () => {
  it('writes INDEX.md, a mirror file and an outline file per document, then is in step', async () => {
    const { io } = setup('files', [home(), menu()]);
    expect(await sync(io)).toEqual({
      code: 0,
      out: [
        '+ diagrams/menu.livediagram.json  "Menu" · 1 tab · rev 1',
        '+ diagrams/screens/home-screen.livediagram.json  "Home screen" · 1 tab · rev 1',
        '~ diagrams/INDEX.md',
        '2 written',
        '',
      ].join('\n'),
      err: '',
    });
    expect(file(io, MIRROR)).toContain('{"height":60,"id":"b1","label":"Home screen box"');
    expect(file(io, MIRROR)).not.toContain('pulledAt');
    expect(file(io, OUTLINE)).toContain('```text\ntab ');
    expect(file(io, INDEX)).toContain(
      '- Files: `screens/home-screen.livediagram.json`, `screens/home-screen.md`',
    );
    const before = new Map([...io.fileMap].map(([k, v]) => [k, v.data]));
    expect(await sync(io)).toMatchObject({ code: 0, out: '2 in step\n' });
    for (const path of [MIRROR, OUTLINE, INDEX]) expect(file(io, path)).toBe(before.get(path));
  });

  it('never writes generated Markdown over a file a person wrote, INDEX.md included', async () => {
    const mine = '# My notes\nHand written.\n';
    const { io } = setup('files', [home()], { [OUTLINE]: mine, [INDEX]: mine });
    const { code, out } = await sync(io);
    expect(code).toBe(0);
    expect(file(io, OUTLINE)).toBe(mine);
    expect(file(io, INDEX)).toBe(mine);
    expect(out).not.toContain('INDEX.md');
    // The mirror file itself is still written.
    expect(file(io, MIRROR)).toContain('Home screen box');
  });

  it('refuses to write through a folder that links outside the mirror directory', async () => {
    const { io } = setup('files', [home()], {}, { '/work/diagrams/screens': '/elsewhere/screens' });
    const { code, err } = await sync(io);
    expect(code).not.toBe(0);
    expect(err).toContain('symbolic link');
    expect(file(io, MIRROR)).toBeUndefined();
  });

  it('writes a behind document at its stable path, naming a path a rename would change', async () => {
    const { io, host } = setup('files', [home()]);
    await sync(io);
    host.edit('d-home', 0, [box('b1', 'Play button')]);
    host.doc('d-home').name = 'Start screen';
    expect((await sync(io)).out).toBe(
      [
        '» diagrams/screens/home-screen.livediagram.json would move to diagrams/screens/start-screen.livediagram.json: livediagram sync --relocate',
        '~ diagrams/screens/home-screen.livediagram.json  "Start screen" · Main · rev 1→2',
        '~ diagrams/INDEX.md',
        '1 written',
        '',
      ].join('\n'),
    );
    expect(file(io, MIRROR)).toContain('"name": "Start screen"');
    const moved = await sync(io, '--relocate');
    expect(moved.out).toBe(
      '» diagrams/screens/home-screen.livediagram.json → diagrams/screens/start-screen.livediagram.json\n~ diagrams/INDEX.md\n1 in step\n',
    );
    expect(io.fileMap.has(MIRROR)).toBe(false);
    expect(file(io, '/work/diagrams/screens/start-screen.md')).toContain('# Start screen');
  });

  it('refuses ahead and diverged documents naming push, and the rest proceeds', async () => {
    const { io, host } = setup('files', [home(), menu()]);
    await sync(io);
    const edit = (path: string) =>
      io.fileMap.set(path, { data: file(io, path)!.replace('box"', 'box!"'), mode: 0o644 });
    edit(MIRROR);
    edit('/work/diagrams/menu.livediagram.json');
    host.edit('d-menu');
    host.docs.push(hostDoc('d-new', 'New one', { folderId: 'games' }));
    const result = await sync(io);
    expect(result.code).toBe(1);
    expect(result.out).toBe(
      [
        '! diagrams/menu.livediagram.json: changed here and in livediagram; send it: livediagram push diagrams/menu.livediagram.json',
        '+ diagrams/new-one.livediagram.json  "New one" · 1 tab · rev 1',
        '! diagrams/screens/home-screen.livediagram.json: changed here; send it: livediagram push diagrams/screens/home-screen.livediagram.json',
        '~ diagrams/INDEX.md',
        '1 written · 2 refused',
        '',
      ].join('\n'),
    );
  });

  it('removes a gone document’s files, keeps a changed one, and leaves an unreadable one', async () => {
    const { io, host } = setup('files', [
      home(),
      menu(),
      hostDoc('d-z', 'Zed', { folderId: 'games' }),
    ]);
    await sync(io);
    host.doc('d-home').state = 'trashed';
    host.doc('d-menu').folderId = 'other';
    host.doc('d-z').state = 'purged';
    const zed = file(io, '/work/diagrams/zed.livediagram.json');
    const result = await sync(io);
    expect(result).toMatchObject({
      code: 0,
      out: [
        '- diagrams/screens/home-screen.livediagram.json  "Home screen" · in the Trash',
        '- diagrams/menu.livediagram.json  "Menu" · outside the link',
        '? diagrams/zed.livediagram.json: no document this account can open; left as it is',
        '~ diagrams/INDEX.md',
        '2 removed · 1 unreadable',
        '',
      ].join('\n'),
    });
    expect([...io.fileMap.keys()].filter((k) => k.startsWith('/work/diagrams/'))).toEqual([
      '/work/diagrams/zed.livediagram.json',
      '/work/diagrams/zed.md',
      INDEX,
    ]);
    expect(file(io, '/work/diagrams/zed.livediagram.json')).toBe(zed);
    expect(file(io, INDEX)).toContain('## Zed');
    expect(io.dirMap.has('/work/diagrams/screens')).toBe(false);
  });

  it('keeps a gone file that changed here, and a new one written by hand, never creating it', async () => {
    const { io, host } = setup('files', [home()], {
      '/work/diagrams/hand.livediagram.json': JSON.stringify({
        kind: 'livediagram.document',
        schemaVersion: 1,
        document: { id: 'd-hand', name: 'By hand', tabs: [] },
      }),
    });
    await sync(io);
    io.fileMap.set(MIRROR, { data: file(io, MIRROR)!.replace('box"', 'box!"'), mode: 0o644 });
    host.doc('d-home').state = 'trashed';
    const result = await sync(io);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      `! diagrams/screens/home-screen.livediagram.json: gone from the link, but changed here and not sent; kept. Send it: livediagram push diagrams/screens/home-screen.livediagram.json, or delete it\n`,
    );
    expect(result.out).toContain(
      '? diagrams/hand.livediagram.json: a document written by hand; this version of livediagram does not create it',
    );
    expect(io.fileMap.has(MIRROR)).toBe(true);
    expect(io.requests.some((r) => r.method !== 'GET')).toBe(false);
  });

  it('keeps every file through transient failures, exiting 6 or 7', async () => {
    for (const [state, code, says] of [
      [429, 6, 'https://livediagram.app is rate limiting this token'],
      [503, 7, 'https://livediagram.app failed (HTTP 503)'],
      ['network', 7, 'could not reach https://livediagram.app (fetch failed)'],
    ] as const) {
      const { io, host } = setup('files', [home()]);
      await sync(io);
      const before = new Map([...io.fileMap].filter(([k]) => k.startsWith('/work/')));
      host.doc('d-home').state = state;
      const result = await sync(io);
      expect(result.code).toBe(code);
      expect(result.out).toBe(`! "Home screen": ${says}; files kept\nnothing to do\n`);
      expect(new Map([...io.fileMap].filter(([k]) => k.startsWith('/work/')))).toEqual(before);
    }
  });

  it('refuses a conflicted file naming the fix, and writes a deleted one again, deleting nothing', async () => {
    const { io } = setup('files', [home()], {
      '/work/diagrams/merged.livediagram.json': '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> main\n',
    });
    await sync(io);
    io.fileMap.delete(MIRROR);
    const result = await sync(io);
    expect(result.out).toContain(
      '! diagrams/merged.livediagram.json: holds git conflict markers. Keep one side: git checkout --ours diagrams/merged.livediagram.json (or --theirs), then livediagram sync',
    );
    expect(result.out).toContain('+ diagrams/screens/home-screen.livediagram.json');
    expect(io.requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  it('leaves a reformatted file in step and untouched', async () => {
    const { io } = setup('files', [home()]);
    await sync(io);
    const reformatted = JSON.stringify(JSON.parse(file(io, MIRROR)!));
    io.fileMap.set(MIRROR, { data: reformatted, mode: 0o644 });
    expect((await sync(io)).out).toBe('1 in step\n');
    expect(file(io, MIRROR)).toBe(reformatted);
  });

  it('rewrites a missing outline file of a document in step', async () => {
    const { io } = setup('files', [home()]);
    await sync(io);
    const outline = file(io, OUTLINE);
    io.fileMap.delete(OUTLINE);
    expect((await sync(io)).out).toBe('1 in step\n');
    expect(file(io, OUTLINE)).toBe(outline);
  });

  it('writes nothing on a dry run, the local sync state included, and takes no lock', async () => {
    const { io } = setup('files', [home()]);
    const result = await sync(io, '--dry-run');
    expect(result.out).toBe(
      '+ diagrams/screens/home-screen.livediagram.json  "Home screen" · 1 tab · rev 1\n~ diagrams/INDEX.md\n1 written\ndry run: nothing written\n',
    );
    const state = await stateDir();
    expect(
      [...io.fileMap.keys()].filter((k) => k.startsWith('/work/') || k.startsWith(state)),
    ).toEqual(['/work/livediagram.toml']);
  });
});

describe('sync at index and none', () => {
  it('writes INDEX.md only at index, with header lines, and records the revisions', async () => {
    const { io, host } = setup('index', [home()]);
    expect((await sync(io)).out).toBe(
      '+ "Home screen" · 1 tab · rev 1\n~ diagrams/INDEX.md\n1 written\n',
    );
    expect(file(io, INDEX)).toContain('    `tab ');
    expect([...io.fileMap.keys()].filter((k) => k.startsWith('/work/'))).toEqual([
      '/work/livediagram.toml',
      INDEX,
    ]);
    const state = JSON.parse(file(io, `${await stateDir()}/state.json`)!);
    expect(state.documents['d-home']).toEqual({
      name: 'Home screen',
      tabs: { 'd-home-t1': { rev: 1, syncedAt: expect.any(Number) } },
    });
    expect((await sync(io)).out).toBe('1 in step\n');
    host.edit('d-home');
    expect((await sync(io)).out).toBe(
      '~ "Home screen" · Main · rev 1→2\n~ diagrams/INDEX.md\n1 written\n',
    );
  });

  it('writes nothing in the tree at none, and records the revisions it read', async () => {
    const { io } = setup('none', [home()]);
    expect((await sync(io)).out).toBe('+ "Home screen" · 1 tab · rev 1\n1 written\n');
    expect([...io.fileMap.keys()].filter((k) => k.startsWith('/work/'))).toEqual([
      '/work/livediagram.toml',
    ]);
    expect(file(io, `${await stateDir()}/state.json`)).toContain('d-home');
  });

  it('lowers the level: unchanged files removed, a changed one kept, then INDEX.md at none', async () => {
    const { io } = setup('files', [home(), menu()]);
    await sync(io);
    io.fileMap.set('/work/diagrams/menu.livediagram.json', {
      data: file(io, '/work/diagrams/menu.livediagram.json')!.replace('box"', 'box!"'),
      mode: 0o644,
    });
    io.fileMap.set('/work/livediagram.toml', { data: '[covers]\nfolder = "games"\n', mode: 0o644 });
    const lowered = await sync(io);
    expect(lowered.code).toBe(1);
    expect(lowered.out).toContain(
      '- diagrams/screens/home-screen.livediagram.json  "Home screen" · level index keeps no mirror files',
    );
    expect(lowered.out).toContain(
      '! diagrams/menu.livediagram.json: level index keeps no mirror files',
    );
    expect(io.fileMap.has(MIRROR)).toBe(false);
    expect(file(io, INDEX)).not.toContain('- Files:');
    io.fileMap.delete('/work/diagrams/menu.livediagram.json');
    io.fileMap.set('/work/livediagram.toml', {
      data: '[covers]\nfolder = "games"\n[mirror]\nlevel = "none"\n',
      mode: 0o644,
    });
    expect((await sync(io)).out).toBe('- diagrams/INDEX.md\n2 in step\n');
    expect(io.fileMap.has(INDEX)).toBe(false);
  });
});

describe('sync and the link’s host', () => {
  it('refuses a link to another host before any request, naming the profile to use', async () => {
    const { io } = setup('index', [home()], {
      '/work/livediagram.toml': 'host = "https://self.example"\n[covers]\nfolder = "games"\n',
      '/home/agent/.config/livediagram/config.toml':
        '[profiles.work]\nhost = "https://self.example"\n',
    });
    const result = await sync(io);
    expect(result).toEqual({
      code: 2,
      out: '',
      err: 'error: /work/livediagram.toml links https://self.example; this profile is https://livediagram.app\nhint: livediagram --profile work sync\n',
    });
    expect(io.requests).toEqual([]);
    io.fileMap.delete('/home/agent/.config/livediagram/config.toml');
    expect((await sync(io)).err).toContain('hint: livediagram --host https://self.example sync');
  });

  it('talks only to a self-hosted link’s host', async () => {
    const host: LinkHost = linkHost([home()], folders);
    const self = 'https://self.example';
    const io = fakeIo({
      env: { LIVEDIAGRAM_TOKEN: TOKEN, LIVEDIAGRAM_HOST: self },
      routes: [
        (request, url) =>
          url.pathname === '/api/capabilities'
            ? Response.json({ apiBase: `${self}/api`, authEnabled: true, documentFormat: 2 })
            : host.route(request, url),
      ],
      files: { '/work/livediagram.toml': `host = "${self}"\n[covers]\nfolder = "games"\n` },
    });
    expect((await sync(io)).code).toBe(0);
    expect(new Set(io.requests.map((r) => new URL(r.url).origin))).toEqual(new Set([self]));
  });
});

describe('sync, the rest', () => {
  it('syncs every link below with --all, naming each', async () => {
    const { io } = setup('index', [home()], {
      '/work/apps/b/livediagram.toml': '[covers]\ndocuments = ["d-menu"]\n',
    });
    const result = await sync(io, '--all');
    expect(result.out).toBe(
      [
        'apps/b/livediagram.toml',
        '? d-menu: no document this account can open; left as it is',
        '~ apps/b/diagrams/INDEX.md',
        '1 unreadable',
        '',
        'livediagram.toml',
        '+ "Home screen" · 1 tab · rev 1',
        '~ diagrams/INDEX.md',
        '1 written',
        '',
      ].join('\n'),
    );
  });

  it('refuses --watch with --dry-run', async () => {
    const { io } = setup('index', [home()]);
    expect(await sync(io, '--watch', '--dry-run')).toMatchObject({
      code: 2,
      err: expect.stringContaining('--dry-run writes nothing, so there is nothing to watch'),
    });
  });

  it('logs ids and states only, never names or paths', async () => {
    const { io } = setup('files', [home()]);
    io.fileMap.set('/work/livediagram.toml', {
      data: '[covers]\nfolder = "games"\n[mirror]\nlevel = "files"\n',
      mode: 0o644,
    });
    const debug = fakeIo({
      env: { LIVEDIAGRAM_TOKEN: TOKEN, LIVEDIAGRAM_DEBUG: '1' },
      routes: [linkHost([home()], folders).route],
      files: { '/work/livediagram.toml': file(io, '/work/livediagram.toml')! },
    });
    const { err } = await sync(debug);
    const lines = err.split('\n').filter((l) => l.startsWith('[sync]'));
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\[sync\] link [0-9a-f]{16} level files folder games documents 0$/),
        '[sync] coverage 1 covered folder found',
        '[sync] state d-home new',
        '[sync] wrote d-home d-home-t1 rev 1',
        '[sync] lock taken',
        '[sync] lock released',
        expect.stringMatching(/^\[sync\] pass 1 actions exit 0 \d+ ms$/),
      ]),
    );
    expect(lines.join('\n')).not.toMatch(/Home screen|diagrams\//);
  });

  it('refuses a mirror directory that leads out of the link (E18)', async () => {
    const { io } = setup('files', [home()], {
      '/work/livediagram.toml': '[covers]\nfolder = "games"\n[mirror]\ndir = "out"\n',
    });
    io.linkMap.set('/work/out', '/home/agent');
    io.dirMap.add('/home/agent');
    expect(await sync(io)).toMatchObject({
      code: 1,
      err: expect.stringContaining('mirror.dir must stay inside /work'),
    });
  });
});

describe('sync, edges', () => {
  it('names --host when a profile’s host does not read', async () => {
    const { io } = setup('index', [home()], {
      '/work/livediagram.toml': 'host = "https://self.example"\n[covers]\nfolder = "games"\n',
      '/home/agent/.config/livediagram/config.toml': '[profiles.odd]\nhost = "not a url"\n',
    });
    expect((await sync(io)).err).toContain('hint: livediagram --host https://self.example sync');
  });

  it('rewrites a document whose tab was refiled, leaving its outline as it was (E27)', async () => {
    const { io, host } = setup('files', [home()]);
    await sync(io);
    const outline = io.fileMap.get(OUTLINE)!;
    host.doc('d-home').tabs[0]!.folder = 'Later';
    expect((await sync(io)).out).toBe(
      '~ diagrams/screens/home-screen.livediagram.json  "Home screen"\n1 written\n',
    );
    expect(file(io, MIRROR)).toContain('"folder": "Later"');
    expect(io.fileMap.get(OUTLINE)).toBe(outline);
  });

  it('fails the whole pass on a refusal of the account, before writing', async () => {
    const { io, host } = setup('files', [home()]);
    host.doc('d-home').state = 403;
    expect((await sync(io)).code).toBe(4);
    expect(io.fileMap.has(INDEX)).toBe(false);
  });

  it('moves through git where git tracks the file, and says so when nothing can move it', async () => {
    const { io, host } = setup('files', [home()]);
    io.runTool = async (command, args) => {
      if (command !== 'git' || args[2] !== 'mv') return null;
      const [from, to] = [`/work/${args[4]}`, `/work/${args[5]}`];
      io.fileMap.set(to, io.fileMap.get(from)!);
      io.fileMap.delete(from);
      return { code: 0, stdout: '' };
    };
    await sync(io);
    io.fileMap.delete(OUTLINE);
    io.dirMap.add('/work/diagrams/screens');
    host.doc('d-home').name = 'Start';
    const moved = await sync(io, '--relocate');
    expect(moved.out).toContain(
      '» diagrams/screens/home-screen.livediagram.json → diagrams/screens/start.livediagram.json',
    );
    expect(file(io, '/work/diagrams/screens/start.livediagram.json')).toContain('"name": "Start"');
    host.doc('d-home').name = 'Again';
    io.runTool = async () => null;
    io.files.move = async () => {
      throw new Error('EACCES');
    };
    const stuck = await sync(io, '--relocate');
    expect(stuck.code).toBe(7);
    expect(stuck.out).toContain(
      '! "Again": could not move diagrams/screens/start.livediagram.json to diagrams/screens/again.livediagram.json (EACCES); files kept',
    );
    expect(file(io, '/work/diagrams/screens/start.livediagram.json')).toContain('"name": "Start"');
  });

  it('keeps a document whose tab read fails, and fails the pass when the credential is refused', async () => {
    const { io, host } = setup('files', [home()]);
    const route = host.route;
    let status = 429;
    io.fetch = async (request) => {
      const url = new URL(request.url);
      if (url.pathname.includes('/tabs/') && status === 0) throw new TypeError('fetch failed');
      if (url.pathname.includes('/tabs/')) return Response.json({ error: 'x' }, { status });
      return (await route(request, url)) ?? Response.json({}, { status: 404 });
    };
    const limited = await sync(io);
    expect(limited.code).toBe(6);
    expect(limited.out).toContain(
      '! "Home screen": https://livediagram.app is rate limiting this token; files kept',
    );
    expect(io.fileMap.has(MIRROR)).toBe(false);
    status = 503;
    expect((await sync(io)).code).toBe(7);
    status = 0;
    expect((await sync(io)).out).toContain(
      'could not reach https://livediagram.app (fetch failed); files kept',
    );
    status = 401;
    expect((await sync(io)).code).toBe(4);
  });

  it('drops a trashed document from INDEX.md at index, and removes an emptied directory', async () => {
    const { io, host } = setup('index', [home()]);
    await sync(io);
    host.doc('d-home').state = 'trashed';
    expect((await sync(io)).out).toBe(
      '- "Home screen" · in the Trash\n~ diagrams/INDEX.md\n1 removed\n',
    );
    const files = setup('files', [home()]);
    await sync(files.io);
    files.io.dirMap.add('/work/diagrams/screens');
    const outline = files.io.fileMap.get(OUTLINE)!;
    files.io.fileMap.set(OUTLINE, { data: `notes by hand\n${outline.data}`, mode: 0o644 });
    files.host.doc('d-home').state = 'trashed';
    await sync(files.io);
    expect(files.io.fileMap.has(MIRROR)).toBe(false);
    expect(files.io.fileMap.get(OUTLINE)!.data).toMatch(/^notes by hand/);
    files.io.fileMap.delete(OUTLINE);
    files.io.dirMap.add('/work/diagrams/empty');
    files.host.doc('d-home').state = 'live';
    await sync(files.io);
    files.host.doc('d-home').state = 'trashed';
    await sync(files.io);
    expect(files.io.dirMap.has('/work/diagrams/screens')).toBe(false);
    expect(files.io.dirMap.has('/work/diagrams/empty')).toBe(true);
  });

  it('names the INDEX.md a dry run at none would remove, keeping it', async () => {
    const { io } = setup('index', [home()]);
    await sync(io);
    io.fileMap.set('/work/livediagram.toml', {
      data: '[covers]\nfolder = "games"\n[mirror]\nlevel = "none"\n',
      mode: 0o644,
    });
    expect((await sync(io, '--dry-run')).out).toBe(
      '- diagrams/INDEX.md\n1 in step\ndry run: nothing written\n',
    );
    expect(io.fileMap.has(INDEX)).toBe(true);
  });
});

describe('a broken file at a document’s mirror path', () => {
  it('holds the document back until it is fixed, leaving no duplicate', async () => {
    const { io } = setup('files', [home()]);
    await sync(io);
    const good = file(io, MIRROR)!;
    io.fileMap.set(MIRROR, {
      data: `<<<<<<< HEAD\n${good}=======\n${good}>>>>>>> main\n`,
      mode: 0o644,
    });
    const held = await sync(io);
    expect(held).toMatchObject({
      code: 1,
      out: [
        '! "Home screen": not written while diagrams/screens/home-screen.livediagram.json holds git conflict markers. Keep one side: git checkout --ours diagrams/screens/home-screen.livediagram.json (or --theirs), then livediagram sync',
        '! diagrams/screens/home-screen.livediagram.json: holds git conflict markers. Keep one side: git checkout --ours diagrams/screens/home-screen.livediagram.json (or --theirs), then livediagram sync',
        '2 refused',
        '',
      ].join('\n'),
    });
    expect([...io.fileMap.keys()].filter((k) => k.includes('home-screen-'))).toEqual([]);
    expect(file(io, INDEX)).toContain('## Home screen');
    await run(['link', 'status'], io);
    expect(io.out()).toMatch(
      /\nheld +\S+ +"Home screen" +diagrams\/screens\/home-screen\.livediagram\.json\n/,
    );
    expect(io.out()).toMatch(/\n1 held · 1 conflicted\n$/);
    io.fileMap.set(MIRROR, { data: good, mode: 0o644 });
    expect((await sync(io)).out).toBe('1 in step\n');
  });
});

describe('a dry run', () => {
  it('prints what a real sync would, INDEX.md included, with --relocate or without', async () => {
    for (const flags of [[], ['--relocate']]) {
      const { io, host } = setup('files', [
        home(),
        menu(),
        hostDoc('d-z', 'Zed', { folderId: 'games' }),
      ]);
      await sync(io);
      host.edit('d-home', 0, [box('b1', 'Play'), box('b2', 'Scores', 200)]);
      host.doc('d-menu').name = 'Main menu';
      host.docs.push(hostDoc('d-new', 'New one', { folderId: 'games' }));
      const dry = await sync(io, '--dry-run', ...flags);
      expect(dry.out).toContain('~ diagrams/INDEX.md\n');
      const real = await sync(io, ...flags);
      expect(dry.out).toBe(`${real.out}dry run: nothing written\n`);
    }
  });
});

// A pass judges the files its scan read; an edit saved while it runs (the api answering in between) is the person's.
// The write or removal re-reads the file first and refuses when its bytes moved on (blueprint "One sync pass").
describe('an edit saved while the pass runs', () => {
  // Edits `path` by hand at the first api request after the scan has read it.
  const editDuringPass = (io: FakeIo, path: string) => {
    const [read, fetch] = [io.files.read, io.fetch];
    let scanned = false;
    let edited = false;
    io.files.read = async (p) => {
      if (p === path) scanned = true;
      return read(p);
    };
    io.fetch = async (request) => {
      if (scanned && !edited) {
        edited = true;
        io.fileMap.set(path, { data: file(io, path)!.replace('box"', 'box!"'), mode: 0o644 });
      }
      return fetch(request);
    };
    return () => file(io, path);
  };

  it('is never written over by a behind document', async () => {
    const { io, host } = setup('files', [home()]);
    await sync(io);
    host.edit('d-home', 0, [box('b1', 'Play button')]);
    const now = editDuringPass(io, MIRROR);
    const result = await sync(io);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      '! diagrams/screens/home-screen.livediagram.json: changed here and in livediagram; send it:',
    );
    expect(now()).toContain('box!"');
    expect(now()).not.toContain('Play button');
  });

  it('is never removed with a document gone from the link', async () => {
    const { io, host } = setup('files', [home()]);
    await sync(io);
    host.doc('d-home').state = 'trashed';
    const now = editDuringPass(io, MIRROR);
    const result = await sync(io);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      '! diagrams/screens/home-screen.livediagram.json: gone from the link, but changed here and not sent; kept.',
    );
    expect(now()).toContain('box!"');
  });

  it('is never removed by a lowered level, refused naming the level', async () => {
    const { io } = setup('files', [home()]);
    await sync(io);
    io.fileMap.set('/work/livediagram.toml', { data: '[covers]\nfolder = "games"\n', mode: 0o644 });
    const now = editDuringPass(io, MIRROR);
    const result = await sync(io);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      '! diagrams/screens/home-screen.livediagram.json: level index keeps no mirror files',
    );
    expect(result.out).not.toContain('- diagrams/screens/home-screen.livediagram.json');
    expect(now()).toContain('box!"');
    expect(io.fileMap.has(OUTLINE)).toBe(true);
  });
});

describe('the local sync state directory', () => {
  it('is made 0700 before the lock is created inside it', async () => {
    const { io } = setup('files', [home()]);
    const calls: string[] = [];
    const [mkdir, createExclusive] = [io.files.mkdir, io.files.createExclusive];
    io.files.mkdir = async (path, mode) => {
      calls.push(`mkdir ${path} ${mode?.toString(8)}`);
      return mkdir(path, mode);
    };
    io.files.createExclusive = async (path, data) => {
      calls.push(`create ${path}`);
      return createExclusive(path, data);
    };
    await sync(io);
    const dir = await stateDir();
    const inState = calls.filter((c) => c.includes(dir));
    expect(inState.slice(0, 2)).toEqual([`mkdir ${dir} 700`, `create ${dir}/lock`]);
  });
});
