// The Library's editor side (liveworkspace/docs/specs/006-media/libraries.md): how the palette groups and searches it,
// who may tidy what, the editor's calls and their refusals in words, and a selection made into an item.
import type { LibraryItemSummary } from '@liveworkspace/media';
import { describe, expect, it, vi } from 'vitest';
import { createLibraryApi, LibraryError, libraryApiOver, libraryErrorMessage } from './library-api';
import { libraryDraft, suggestedLibraryTitle } from './library-draft';
import { canTidy, folderNames, libraryGroups, previewSrc } from './library-groups';

const item = (over: Partial<LibraryItemSummary>): LibraryItemSummary => ({
  id: 'x',
  scope: 'personal',
  teamId: null,
  folder: '',
  title: 'Box',
  width: 10,
  height: 10,
  kinds: ['shape'],
  preview: null,
  app: 'livediagram.app',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const TEAMS = [
  { id: 't1', name: 'Platform', role: 'member' as const },
  { id: 't2', name: 'Brand', role: 'admin' as const },
];

describe('libraryGroups', () => {
  const items = [
    item({ id: 'a', title: 'Lambda', folder: 'AWS', createdAt: 1 }),
    item({ id: 'b', title: 'S3', folder: 'AWS', createdAt: 2 }),
    item({ id: 'c', title: 'Note', createdAt: 3 }),
    item({ id: 'd', scope: 'team', teamId: 't2', title: 'Logo', folder: 'Marks' }),
    item({ id: 'e', scope: 'team', teamId: 'gone', title: 'Lost' }),
  ];

  it('puts Personal first, then each team with items, folders top first then by name, newest first', () => {
    const groups = libraryGroups(items, TEAMS);
    expect(groups.map((g) => [g.label, g.role])).toEqual([
      ['Personal', null],
      ['Brand', 'admin'],
    ]);
    expect(groups[0]!.folders.map((f) => [f.name, f.items.map((i) => i.id)])).toEqual([
      ['', ['c']],
      ['AWS', ['b', 'a']],
    ]);
  });

  it('keeps a matching group or folder whole, else the matching items', () => {
    expect(libraryGroups(items, TEAMS, 'brand').map((g) => g.label)).toEqual(['Brand']);
    const aws = libraryGroups(items, TEAMS, 'aws');
    expect(aws[0]!.folders.map((f) => f.items.length)).toEqual([2]);
    expect(libraryGroups(items, TEAMS, ' s3 ')[0]!.folders[0]!.items.map((i) => i.id)).toEqual([
      'b',
    ]);
    expect(libraryGroups(items, TEAMS, 'nothing')).toEqual([]);
  });

  it('lets Personal’s owner and a team’s admins tidy, never a member or a guest’s old shape library', () => {
    const [personal, brand] = libraryGroups(items, TEAMS);
    expect(canTidy(personal!)).toBe(true);
    expect(canTidy(brand!)).toBe(true);
    expect(canTidy({ scope: 'team', role: 'member' })).toBe(false);
    const legacy = { legacy: { app: 'livediagram.app' as const, libraryId: 'L' } };
    expect(canTidy(personal!, legacy, false)).toBe(false);
    expect(canTidy(personal!, legacy, true)).toBe(true);
  });

  it('suggests a destination’s own folders, sorted', () => {
    expect(folderNames(items, 'personal', null)).toEqual(['AWS']);
    expect(folderNames(items, 'team', 't2')).toEqual(['Marks']);
    expect(folderNames(items, 'team', 't1')).toEqual([]);
  });

  it('serves a preview as an inert data URL', () => {
    expect(previewSrc('<svg a="1"/>')).toBe(
      'data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%221%22%2F%3E',
    );
  });
});

describe('createLibraryApi', () => {
  const reply = (body: unknown, status = 200) => Response.json(body, { status });

  it('calls the door for each action', async () => {
    const request = vi.fn(async (path: string, _init: { method: string; body?: unknown }) =>
      path === ''
        ? reply({ items: [], item: { id: 'n' } })
        : reply({ item: { id: 'r' }, renamed: 2, ok: true }),
    );
    const api = createLibraryApi(request);
    await api.list();
    expect(
      (
        await api.save({
          scope: 'personal',
          teamId: null,
          folder: '',
          title: 'A',
          width: 1,
          height: 1,
          elements: [],
        })
      ).id,
    ).toBe('n');
    await api.place('a/b');
    expect((await api.rename('a', 'B')).id).toBe('r');
    expect(await api.renameFolder({ scope: 'personal', teamId: null, from: 'a', to: 'b' })).toBe(2);
    await api.remove('a');
    expect(request.mock.calls.map(([p, init]) => `${init.method} ${p}`)).toEqual([
      'GET ',
      'POST ',
      'POST /a%2Fb/place',
      'PUT /a',
      'PUT /folders',
      'DELETE /a',
    ]);
  });

  it('throws a refusal with its token, in words', async () => {
    const api = createLibraryApi(async () => reply({ error: 'admin_only' }, 403));
    const error = await api.remove('a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LibraryError);
    expect((error as LibraryError).status).toBe(403);
    expect(libraryErrorMessage(error)).toBe('Only the team’s admins can change its library.');
    const broken = createLibraryApi(async () => new Response('nope', { status: 500 }));
    expect(((await broken.list().catch((e: unknown) => e)) as LibraryError).code).toBe('failed');
    for (const code of [
      'library_full',
      'item_too_large',
      'gallery_full',
      'invalid_elements',
      'not_found',
    ]) {
      expect(libraryErrorMessage(new LibraryError(code, 400))).not.toMatch(/Try again/);
    }
    expect(libraryErrorMessage(new Error('x'))).toBe('Couldn’t reach your library. Try again.');
  });
});

describe('libraryApiOver', () => {
  it('calls the app’s door with its identity headers, and a JSON body only when there is one', async () => {
    const fetch = vi.fn(async () => Response.json({ items: [], renamed: 1 }));
    const headers = vi.fn(async (opts: { body: boolean }) => ({ 'X-Body': String(opts.body) }));
    const api = libraryApiOver({ base: 'https://api.test/api/library', fetch, headers });
    await api.list();
    await api.renameFolder({ scope: 'personal', teamId: null, from: 'a', to: 'b' });
    expect(fetch.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      'https://api.test/api/library',
      'https://api.test/api/library/folders',
    ]);
    expect(headers.mock.calls.map(([o]) => o.body)).toEqual([false, true]);
    expect(((fetch.mock.calls[1] as unknown[])[1] as RequestInit).body).toBe(
      JSON.stringify({ scope: 'personal', teamId: null, from: 'a', to: 'b' }),
    );
  });
});

describe('libraryDraft', () => {
  type El = { id: string; type: string; x: number; y: number; label?: string };
  const helpers = {
    duplicate: (els: El[], _ids: ReadonlySet<string>, dx: number, dy: number) =>
      els.map((el) => ({ ...el, id: `${el.id}2`, x: el.x + dx, y: el.y + dy })),
    bounds: (els: El[]) => ({
      x: Math.min(...els.map((e) => e.x)),
      y: Math.min(...els.map((e) => e.y)),
      w: 50,
      h: 30,
    }),
    kindLabel: (el: El) => (el.type === 'shape' ? 'Square' : 'Arrow'),
  };

  it('copies the selection to the origin with fresh ids, its size and a name from its words', () => {
    const draft = libraryDraft(
      [
        { id: 'a', type: 'shape', x: 100, y: 40, label: '\n  Payments API\nmore' },
        { id: 'b', type: 'shape', x: 120, y: 60 },
      ],
      helpers,
    );
    expect(draft).toEqual({
      width: 50,
      height: 30,
      elements: [
        { id: 'a2', type: 'shape', x: 0, y: 0, label: '\n  Payments API\nmore' },
        { id: 'b2', type: 'shape', x: 20, y: 20 },
      ],
      suggestedTitle: 'Payments API',
    });
  });

  it('names an unlabelled selection by its first boxed kind, and saves nothing for none', () => {
    expect(
      suggestedLibraryTitle(
        [
          { id: 'a', type: 'arrow' },
          { id: 'b', type: 'shape' },
        ],
        helpers.kindLabel as never,
      ),
    ).toBe('Square');
    expect(suggestedLibraryTitle([], helpers.kindLabel as never)).toBe('Selection');
    expect(libraryDraft([], helpers)).toBeNull();
    expect(
      libraryDraft([{ id: 'a', type: 'shape', x: 0, y: 0 }], { ...helpers, duplicate: () => [] }),
    ).toBeNull();
  });
});
