import { beforeEach, describe, expect, it, vi } from 'vitest';

type CreateProject = typeof import('@/lib/api-client').apiCreateProject;
const api = vi.hoisted(() => ({ apiCreateProject: vi.fn<CreateProject>() }));
vi.mock('@/lib/api-client', () => api);

import { createProjectInPlace, createInPlaceOf } from './create-in-place';

const ORIGIN = 'https://live.test';
const HOME = { kind: 'explorer', node: { kind: 'home' } } as const;

describe('createInPlaceOf', () => {
  it('takes the wizard href’s place and template first', () => {
    expect(createInPlaceOf('/new?folder=f1&template=kanban', ORIGIN, HOME)).toEqual({
      folderId: 'f1',
      teamId: null,
      templateKind: 'kanban',
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
      createInPlaceOf('/new?template=kanban', ORIGIN, {
        kind: 'explorer',
        node: { kind: 'team', id: 't2' },
      }),
    ).toEqual({ folderId: null, teamId: 't2', templateKind: 'kanban' });
    expect(createInPlaceOf('/new?q=roadmap', ORIGIN, HOME)).toEqual({
      folderId: undefined,
      teamId: null,
      templateKind: null,
    });
  });
});

describe('createProjectInPlace', () => {
  beforeEach(() => {
    api.apiCreateProject.mockReset();
    api.apiCreateProject.mockResolvedValue({} as never);
  });

  it('makes a blank that opens on the editor’s start, in the asked folder', async () => {
    const id = await createProjectInPlace('user_1', {
      folderId: 'f1',
      teamId: null,
      templateKind: null,
    });

    const [owner, made] = api.apiCreateProject.mock.calls[0]!;
    expect(owner).toBe('user_1');
    expect(made).toMatchObject({ id, name: 'Untitled plan', folderId: 'f1', teamId: null });
    expect(made.tabs).toHaveLength(1);
    expect(made.tabs?.[0]?.templateChosen).toBeUndefined();
    expect(made.tabs?.[0]?.elements).toEqual([]);
  });

  it('makes the asked template as /new makes it', async () => {
    await createProjectInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: 'kanban',
    });

    const [, made] = api.apiCreateProject.mock.calls[0]!;
    expect(made.name).not.toBe('Untitled plan');
    expect(made.tabs?.[0]?.templateChosen).toBe(true);
    expect(made.intent).toBeDefined();
  });

  it('lets a refused create through to the caller', async () => {
    const refused = new Error('403');
    api.apiCreateProject.mockImplementation(async () => {
      throw refused;
    });

    const made = createProjectInPlace('user_1', {
      folderId: undefined,
      teamId: null,
      templateKind: null,
    }).catch((err: unknown) => err);

    expect(await made).toBe(refused);
  });
});
