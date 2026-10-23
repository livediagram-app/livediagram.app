import { beforeEach, describe, expect, it, vi } from 'vitest';

type CreateDesign = typeof import('@/lib/api-client').apiCreateDesign;
const api = vi.hoisted(() => ({ apiCreateDesign: vi.fn<CreateDesign>() }));
vi.mock('@/lib/api-client', () => api);

import { createDesignInPlace, createInPlaceOf } from './create-in-place';

const ORIGIN = 'https://live.test';
const HOME = { kind: 'explorer', node: { kind: 'home' } } as const;

describe('createInPlaceOf', () => {
  it('takes the wizard href’s place and template first', () => {
    expect(createInPlaceOf('/new?folder=f1&template=wireframe-mobile-app', ORIGIN, HOME)).toEqual({
      folderId: 'f1',
      teamId: null,
      templateKind: 'wireframe-mobile-app',
    });
    expect(createInPlaceOf('/new?team=t1', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: 't1',
      templateKind: null,
    });
  });

  it('fills in the place the frame shows when the href names none', () => {
    expect(
      createInPlaceOf('/new', ORIGIN, { kind: 'explorer', node: { kind: 'folder', id: 'f2' } }),
    ).toEqual({ folderId: 'f2', teamId: null, templateKind: null });
    expect(
      createInPlaceOf('/new?blank=1', ORIGIN, {
        kind: 'explorer',
        node: { kind: 'team', id: 't2' },
      }),
    ).toEqual({ folderId: null, teamId: 't2', templateKind: 'blank' });
    expect(createInPlaceOf('/new?q=roadmap', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: null,
      templateKind: null,
    });
  });
});

describe('createDesignInPlace', () => {
  beforeEach(() => {
    api.apiCreateDesign.mockReset();
    api.apiCreateDesign.mockResolvedValue({} as never);
  });

  it('makes a blank that opens on the editor’s start, in the asked folder', async () => {
    const id = await createDesignInPlace('user_1', {
      folderId: 'f1',
      teamId: null,
      templateKind: null,
    });

    const [owner, made] = api.apiCreateDesign.mock.calls[0]!;
    expect(owner).toBe('user_1');
    expect(made).toMatchObject({ id, name: 'Untitled design', folderId: 'f1', teamId: null });
    expect(made.tabs).toHaveLength(1);
    expect(made.tabs?.[0]?.templateChosen).toBeUndefined();
    expect(made.tabs?.[0]?.elements).toEqual([]);
  });

  it('makes the asked template as /new makes it', async () => {
    await createDesignInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: 'wireframe-mobile-app',
    });

    const [, made] = api.apiCreateDesign.mock.calls[0]!;
    expect(made.name).not.toBe('Untitled design');
    expect(made.tabs?.[0]?.templateChosen).toBe(true);
    expect(made.intent).toBeDefined();
  });

  it('lets a refused create through to the caller', async () => {
    const refused = new Error('403');
    api.apiCreateDesign.mockImplementation(async () => {
      throw refused;
    });

    const made = createDesignInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: null,
    }).catch((err: unknown) => err);

    expect(await made).toBe(refused);
  });
});
