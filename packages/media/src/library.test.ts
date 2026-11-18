// The Library's contract (liveworkspace/docs/specs/006-media/libraries.md): its rules, each app's door (validation,
// kinds, previews) and the internal door the old shape libraries are read through.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  LIBRARY_PICTURES_BYTES_MAX,
  LIBRARY_PREVIEW_BYTES_MAX,
  canTidyScope,
  canUseScope,
  elementKinds,
  fitsKinds,
  isLibrarySide,
  legacyItemId,
  libraryImageIds,
  libraryPreviewPictures,
  normaliseLibraryFolder,
  normaliseLibraryTitle,
  parseLegacyItemId,
  parseLibraryActor,
  teamMediaOwner,
  withLibraryImageIds,
  type LibraryActor,
} from './library';
import { libraryCalls, type LibraryResult } from './library-client';
import {
  handleLibraryDoor,
  libraryActorOf,
  libraryKitOf,
  type LibraryDoorInput,
} from './library-door';
import { handleLegacyShapeLibrariesDoor, LEGACY_PREVIEWS_MAX_BYTES } from './library-legacy-door';

afterEach(() => vi.restoreAllMocks());

const member: LibraryActor = {
  owner: 'user_m',
  teams: [{ id: 't1', name: 'Platform', role: 'member' }],
};
const admin: LibraryActor = {
  owner: 'user_a',
  teams: [{ id: 't1', name: 'Platform', role: 'admin' }],
};

describe('rules', () => {
  it('trims titles and folders, and refuses what is out of range', () => {
    expect(normaliseLibraryTitle('  Box ')).toBe('Box');
    expect(normaliseLibraryTitle('')).toBeNull();
    expect(normaliseLibraryTitle('x'.repeat(201))).toBeNull();
    expect(normaliseLibraryTitle(3)).toBeNull();
    expect(normaliseLibraryFolder(' Logos ')).toBe('Logos');
    expect(normaliseLibraryFolder(undefined)).toBe('');
    expect(normaliseLibraryFolder('x'.repeat(81))).toBeNull();
    expect(isLibrarySide(0)).toBe(true);
    expect(isLibrarySide(-1)).toBe(false);
    expect(isLibrarySide(Number.NaN)).toBe(false);
  });

  it('reads the kinds an item uses, and whether an app draws them all', () => {
    const kinds = elementKinds([{ type: 'shape' }, { type: 'arrow' }, { type: 'shape' }, null]);
    expect(kinds).toEqual(['arrow', 'shape']);
    expect(fitsKinds(kinds, new Set(['shape', 'arrow', 'text']))).toBe(true);
    expect(fitsKinds(['event-note'], new Set(['shape']))).toBe(false);
  });

  it('finds the gallery pictures an item places, and swaps them for copies', () => {
    const els = [
      { type: 'image', imageId: 'img1' },
      { type: 'image', imageId: 'img1' },
      { type: 'shape' },
      { type: 'image', src: 'data:x' },
    ];
    expect(libraryImageIds(els)).toEqual(['img1']);
    const swapped = withLibraryImageIds(els, new Map([['img1', 'img2']]));
    expect(libraryImageIds(swapped)).toEqual(['img2']);
    expect(withLibraryImageIds(els, new Map())).toEqual(els);
    expect(teamMediaOwner('t1')).toBe('team:t1');
  });

  it('keeps a save’s picture copies only for its own pictures, as still base64 images, within the budget', () => {
    const els = [
      { type: 'image', imageId: 'img1' },
      { type: 'image', imageId: 'img2' },
      { type: 'image', imageId: 'img3' },
      { type: 'image', imageId: 'img4' },
      { type: 'image', imageId: 'img5' },
    ];
    const jpeg = 'data:image/jpeg;base64,QUJD';
    const kept = libraryPreviewPictures(
      {
        img1: jpeg,
        img2: 'data:image/svg+xml;base64,QUJD',
        img3: 'data:image/png;base64,QU!D',
        img4: 'data:image/webp;base64,QUI=',
        img5: 'data:image/png;base64,QUJ',
        other: jpeg,
      },
      els,
    );
    expect([...kept.keys()]).toEqual(['img1', 'img4']);
    expect(libraryPreviewPictures(null, els).size).toBe(0);
    expect(libraryPreviewPictures({ img1: 3 }, els).size).toBe(0);
    expect(libraryPreviewPictures({ img1: 'data:image/png;base64,' }, els).size).toBe(0);
    expect(libraryPreviewPictures({ img1: 'data:image/png;base64,QQ==' }, els).size).toBe(1);
    // Past the budget, the later pictures are left out.
    const half = `data:image/jpeg;base64,${'A'.repeat(Math.floor(LIBRARY_PICTURES_BYTES_MAX / 2 / 4) * 4)}`;
    expect([...libraryPreviewPictures({ img1: half, img2: half, img3: jpeg }, els).keys()]).toEqual(
      ['img1', 'img3'],
    );
  });

  it('reads the longest copy it takes in linear time', () => {
    // A bad character only at the very end, so every one before it is read.
    const body = 'A'.repeat(Math.floor((LIBRARY_PICTURES_BYTES_MAX - 30) / 4) * 4 - 1);
    const ms = cpuMsOf(() =>
      libraryPreviewPictures({ img1: `data:image/png;base64,${body}!` }, [
        { type: 'image', imageId: 'img1' },
      ]),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });

  it('round-trips an old shape library item’s id, and refuses any other', () => {
    const ref = { app: 'livediagram.app' as const, libraryId: 'L1', itemId: 'i1' };
    expect(parseLegacyItemId(legacyItemId(ref))).toEqual(ref);
    expect(parseLegacyItemId('lib_1')).toBeNull();
    expect(parseLegacyItemId('legacy~nope.app~L1~i1')).toBeNull();
    expect(parseLegacyItemId('legacy~livediagram.app~L1')).toBeNull();
  });

  it('parses the actor an app vouches for, and refuses a malformed one', () => {
    expect(
      parseLibraryActor({ owner: 'user_a', teams: [{ id: 't', name: 'T', role: 'admin' }] }),
    ).toEqual({
      owner: 'user_a',
      teams: [{ id: 't', name: 'T', role: 'admin' }],
    });
    expect(parseLibraryActor({ owner: 'user_a' })).toBeNull();
    expect(
      parseLibraryActor({ owner: 'user_a', teams: [{ id: 't', name: 'T', role: 'owner' }] }),
    ).toBeNull();
    expect(
      parseLibraryActor({ owner: 'user_a', teams: Array.from({ length: 51 }, () => ({})) }),
    ).toBeNull();
    expect(libraryActorOf('user_a', [{ id: 't', name: 'T', role: 'viewer' }]).teams[0]!.role).toBe(
      'member',
    );
    expect(libraryActorOf('user_a', null).teams).toEqual([]);
  });

  it('lets a member use a team library and only an admin tidy it; Personal is its owner’s', () => {
    expect(canUseScope(member, 'team', 't1')).toBe(true);
    expect(canTidyScope(member, 'team', 't1')).toBe(false);
    expect(canTidyScope(admin, 'team', 't1')).toBe(true);
    expect(canUseScope(member, 'team', 't2')).toBe(false);
    expect(canUseScope(member, 'personal', 'user_m')).toBe(true);
    expect(canTidyScope(member, 'personal', 'user_m')).toBe(true);
    expect(canUseScope(member, 'personal', 'user_a')).toBe(false);
    expect(canTidyScope(admin, 'personal', 'user_m')).toBe(false);
  });
});

describe('the service’s calls', () => {
  it('posts each route with the actor', async () => {
    const post = vi.fn(async () => ({ ok: true as const, value: {} }));
    const calls = libraryCalls(post as never);
    await calls.list(member, ['shape']);
    await calls.save(member, {
      scope: 'personal',
      folder: '',
      title: 'A',
      width: 1,
      height: 1,
      elements: [],
      preview: null,
    });
    await calls.place(member, 'x');
    await calls.rename(member, 'x', 'B');
    await calls.renameFolder(member, { scope: 'personal', from: 'a', to: 'b' });
    await calls.remove(member, 'x');
    expect(post.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      '/list',
      '/save',
      '/place',
      '/rename',
      '/rename-folder',
      '/delete',
    ]);
    expect((post.mock.calls[0] as unknown[])[1]).toEqual({ actor: member, kinds: ['shape'] });
  });
});

describe('an app’s door', () => {
  const ok = <T>(value: T): LibraryResult<T> => ({ ok: true, value });
  const kit = libraryKitOf({
    kinds: new Set(['shape', 'arrow']),
    migrate: (els) => els,
    isValid: (el) =>
      (el as { type?: string }).type === 'shape' || (el as { type?: string }).type === 'arrow',
    render: () => '<svg/>',
  });
  const service = () => ({
    list: vi.fn(async () => ok({ items: [] })),
    save: vi.fn(async (_a: unknown, input: unknown) => ok({ item: input })),
    place: vi.fn(async () =>
      ok({ elements: [{ type: 'shape' }, { type: 'event-note' }], width: 1, height: 1 }),
    ),
    rename: vi.fn(async () => ok({ item: {} })),
    renameFolder: vi.fn(async () => ok({ renamed: 1 })),
    remove: vi.fn(async () => ({ ok: false as const, status: 403, body: { error: 'admin_only' } })),
  });
  const door = (over: Partial<LibraryDoorInput>) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    return handleLibraryDoor({
      method: 'GET',
      path: [],
      actor: member,
      library: service() as never,
      kit,
      readBody: async () => null,
      json: (body, init) => Response.json(body, init),
      ...over,
    });
  };
  const SAVE = {
    scope: 'team',
    teamId: 't1',
    title: 'Box',
    folder: '',
    width: 10,
    height: 10,
    elements: [{ type: 'shape' }],
  };

  it('asks for the list with the kinds this app draws', async () => {
    const lib = service();
    const res = await door({ library: lib as never });
    expect(res.status).toBe(200);
    expect(lib.list).toHaveBeenCalledWith(member, ['shape', 'arrow']);
  });

  it('turns away no caller, and answers 503 without the service', async () => {
    expect((await door({ actor: null })).status).toBe(401);
    expect((await door({ library: null })).status).toBe(503);
  });

  it('saves only elements this app keeps, with its drawing', async () => {
    const lib = service();
    const res = await door({ method: 'POST', library: lib as never, readBody: async () => SAVE });
    expect(res.status).toBe(201);
    expect(lib.save).toHaveBeenCalledWith(
      member,
      expect.objectContaining({ scope: 'team', teamId: 't1', preview: '<svg/>' }),
    );
    const bad = await door({
      method: 'POST',
      readBody: async () => ({ ...SAVE, elements: [{ type: 'event-note' }] }),
    });
    expect(await bad.json()).toEqual({ error: 'invalid_elements' });
  });

  it('refuses a body that is missing, or a bad scope, title, folder, size or size in bytes', async () => {
    const post = (body: Record<string, unknown> | null) =>
      door({ method: 'POST', readBody: async () => body });
    expect((await post(null)).status).toBe(400);
    expect(await (await post({ ...SAVE, scope: 'team', teamId: '' })).json()).toEqual({
      error: 'invalid_scope',
    });
    expect(await (await post({ ...SAVE, title: '' })).json()).toEqual({ error: 'invalid_title' });
    expect(await (await post({ ...SAVE, folder: 'x'.repeat(81) })).json()).toEqual({
      error: 'invalid_folder',
    });
    expect(await (await post({ ...SAVE, width: -1 })).json()).toEqual({ error: 'invalid_size' });
    expect(await (await post({ ...SAVE, elements: [] })).json()).toEqual({
      error: 'invalid_elements',
    });
    const big = { type: 'shape', label: 'x'.repeat(300_000) };
    expect((await post({ ...SAVE, elements: [big] })).status).toBe(413);
  });

  it('saves without a preview when drawing fails or is too big', async () => {
    for (const render of [
      () => {
        throw new Error('no');
      },
      () => 'x'.repeat(LIBRARY_PREVIEW_BYTES_MAX + 1),
    ]) {
      const lib = service();
      const res = await door({
        method: 'POST',
        library: lib as never,
        kit: libraryKitOf({ kinds: kit.kinds, migrate: (e) => e, isValid: () => true, render }),
        readBody: async () => SAVE,
      });
      expect(res.status).toBe(201);
      expect(lib.save).toHaveBeenCalledWith(member, expect.objectContaining({ preview: null }));
    }
  });

  it('draws a save’s pictures from the copies it sent', async () => {
    const render = vi.fn(
      (_els: readonly unknown[], href: (id: string) => string | undefined) =>
        href('img1') ?? 'none',
    );
    const lib = service();
    const elements = [{ type: 'image', imageId: 'img1' }];
    await door({
      method: 'POST',
      library: lib as never,
      kit: libraryKitOf({
        kinds: new Set(['image']),
        migrate: (e) => e,
        isValid: () => true,
        render,
      }),
      readBody: async () => ({
        ...SAVE,
        elements,
        pictures: { img1: 'data:image/jpeg;base64,QUJD' },
      }),
    });
    expect(lib.save).toHaveBeenCalledWith(
      member,
      expect.objectContaining({ preview: 'data:image/jpeg;base64,QUJD' }),
    );
  });

  it('leaves out of a placed item what this app can’t draw', async () => {
    const res = await door({ method: 'POST', path: ['x', 'place'] });
    expect(((await res.json()) as { elements: unknown[] }).elements).toEqual([{ type: 'shape' }]);
  });

  it('renames an item and a folder, and passes on a refusal to delete', async () => {
    expect(
      (await door({ method: 'PUT', path: ['x'], readBody: async () => ({ title: 'B' }) })).status,
    ).toBe(200);
    expect((await door({ method: 'PUT', path: ['x'], readBody: async () => ({}) })).status).toBe(
      400,
    );
    const folders = (body: Record<string, unknown> | null) =>
      door({ method: 'PUT', path: ['folders'], readBody: async () => body });
    expect((await folders({ scope: 'personal', from: 'a', to: 'b' })).status).toBe(200);
    expect((await folders({ scope: 'personal', from: 'a', to: '' })).status).toBe(400);
    expect((await folders({ scope: 'x', from: 'a', to: 'b' })).status).toBe(400);
    expect((await folders(null)).status).toBe(400);
    const res = await door({ method: 'DELETE', path: ['x'] });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'admin_only' });
  });

  it('answers anything else as missing', async () => {
    expect((await door({ method: 'PATCH', path: ['x'] })).status).toBe(404);
    expect((await door({ method: 'GET', path: ['x', 'y', 'z'] })).status).toBe(404);
    expect((await door({ method: 'GET', path: [''] })).status).toBe(404);
    const failed = service();
    failed.place.mockResolvedValueOnce({
      ok: false,
      status: 404,
      body: { error: 'not_found' },
    } as never);
    expect(
      (await door({ method: 'POST', path: ['x', 'place'], library: failed as never })).status,
    ).toBe(404);
  });
});

describe('the internal door to the old shape libraries', () => {
  const ITEM = { id: 'i', title: 'A', width: 1, height: 1, elements: [] };
  const read = async () => [
    { id: 'L', name: 'AWS', createdAt: 1, updatedAt: 1, items: [ITEM, { ...ITEM, id: 'j' }] },
  ];
  const ask = (init: {
    key?: string;
    auth?: string;
    owner?: string;
    method?: string;
    draw?: () => string | null;
  }) =>
    handleLegacyShapeLibrariesDoor({
      request: new Request(
        `https://x/api/internal/shape-libraries?owner=${init.owner ?? 'user_a'}`,
        {
          method: init.method ?? 'GET',
          headers:
            init.auth === undefined ? { Authorization: 'Bearer k' } : { Authorization: init.auth },
        },
      ),
      key: 'key' in init ? init.key : 'k',
      read,
      draw: init.draw ?? (() => '<svg/>'),
      json: (body, i) => Response.json(body, i),
    });

  it('answers an account’s libraries with their drawings, to the media key only', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await ask({});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { libraries: { previews: Record<string, string> }[] };
    expect(body.libraries[0]!.previews).toEqual({ i: '<svg/>', j: '<svg/>' });
    expect((await ask({ auth: 'Bearer wrong' })).status).toBe(401);
    expect((await ask({ key: undefined })).status).toBe(401);
    expect((await ask({ owner: 'guest:abc' })).status).toBe(400);
    expect((await ask({ method: 'POST' })).status).toBe(404);
  });

  it('stops drawing at its budget, and skips a drawing that fails or is too big', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const huge = 'x'.repeat(LEGACY_PREVIEWS_MAX_BYTES);
    expect(huge.length).toBeGreaterThan(LIBRARY_PREVIEW_BYTES_MAX);
    const failing = (await (
      await ask({
        draw: () => {
          throw new Error('no');
        },
      })
    ).json()) as {
      libraries: { previews: Record<string, string> }[];
    };
    expect(failing.libraries[0]!.previews).toEqual({});
    const tooBig = (await (await ask({ draw: () => huge })).json()) as {
      libraries: { previews: Record<string, string> }[];
    };
    expect(tooBig.libraries[0]!.previews).toEqual({});
  });
});
