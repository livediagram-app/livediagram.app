import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import { contextOf, fakeApi, library } from '../testing/fake-api';
import { folderCreate, folderLs } from './folder';

// `folder ls` and `folder create` (docs/specs/015-api/cli.md "Commands"; blueprint CLI86, CLI87).

const folders = {
  '/folders': {
    folders: [
      { id: 'f0000001-games', name: 'Minigames', parentId: null, teamId: null, ownerId: 'u' },
      {
        id: 'f0000002-scrns',
        name: 'Screens',
        parentId: 'f0000001-games',
        teamId: null,
        ownerId: 'u',
      },
    ],
  },
};

describe('folder ls', () => {
  it('lists the folders as paths with their ids, depth first', async () => {
    const api = fakeApi({ ...library, ...folders });

    const output = await folderLs.run!(contextOf(api), {});

    expect(output).toEqual({
      folders: [
        { id: 'f0000001-games', path: 'Minigames', library: 'personal' },
        { id: 'f0000002-scrns', path: 'Minigames/Screens', library: 'personal' },
      ],
    });
    expect(folderLs.text!(output)).toEqual([
      'f0000001-games  "Minigames"          personal',
      'f0000002-scrns  "Minigames/Screens"  personal',
    ]);
    expect(folderLs.listKey).toBe('folders');
  });

  it('says how to make one when there are none', () => {
    expect(folderLs.text!({ folders: [] })).toEqual([
      'no folders yet: livedocuments folder create <name>',
    ]);
  });
});

describe('folder create', () => {
  function recorder() {
    const bodies: Record<string, unknown>[] = [];
    const route = async (request: Request) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return Response.json({ folder: body }, { status: 201 });
    };
    return { bodies, route };
  }

  it('makes a folder at the top of My Documents and prints its id and path', async () => {
    const { bodies, route } = recorder();
    const api = fakeApi({ ...library, '/folders': route });

    const output = await folderCreate.run!(contextOf(api), { name: 'Minigames' });

    expect(bodies).toEqual([{ id: output.id, name: 'Minigames', parentId: null }]);
    expect(output.path).toBe('Minigames');
    expect(folderCreate.text!(output)).toEqual([`+ folder ${output.id} "Minigames"`]);
  });

  it('makes it inside the folder --in names, its path below it', async () => {
    const { bodies, route } = recorder();
    const api = fakeApi({
      ...library,
      '/folders': async (request: Request) =>
        request.method === 'GET' ? Response.json(folders['/folders']) : route(request),
    });

    const output = await folderCreate.run!(contextOf(api), { name: 'Levels', in: 'Screens' });

    expect(bodies[0]).toMatchObject({ name: 'Levels', parentId: 'f0000002-scrns' });
    expect(output.path).toBe('Minigames/Screens/Levels');
  });

  it('makes it in the team of the folder --in names', async () => {
    const { bodies, route } = recorder();
    const api = fakeApi({
      ...library,
      '/teams': { teams: [{ id: 't1', name: 'Studio' }] },
      '/teams/t1/library': {
        documents: [],
        folders: [
          { id: 'f0000003-studio', name: 'Art', parentId: null, teamId: 't1', ownerId: 'u' },
        ],
      },
      '/folders': async (request: Request) =>
        request.method === 'GET' ? Response.json({ folders: [] }) : route(request),
    });

    const output = await folderCreate.run!(contextOf(api), { name: 'Sketches', in: 'Art' });

    expect(bodies[0]).toMatchObject({
      name: 'Sketches',
      parentId: 'f0000003-studio',
      teamId: 't1',
    });
    expect(output.path).toBe('Art/Sketches');
  });

  it('refuses a --in it cannot find', async () => {
    const api = fakeApi({ ...library, ...folders });

    const err = await folderCreate.run!(contextOf(api), { name: 'X', in: 'Nowhere' }).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(VerbRefusal);
  });
});
