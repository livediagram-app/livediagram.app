import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './core';
import {
  apiCreateShapeLibrary,
  apiDeleteShapeLibrary,
  apiListShapeLibraries,
  apiUpdateShapeLibrary,
  shapeLibraryErrorCopy,
} from './shape-libraries';

// docs/specs/013-workspace/blueprints/shape-libraries.md "Interfaces and contracts": the four calls
// and what each refusal tells the person.

let calls: { url: string; method: string; body: unknown }[];
let reply: Response;

beforeEach(() => {
  calls = [];
  reply = new Response(JSON.stringify({ libraries: [] }), { status: 200 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return reply.clone();
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const library = { id: 'lib-1', name: 'Team icons', items: [] };

describe('shape library calls', () => {
  it('lists, creates, updates and deletes at /shape-libraries', async () => {
    expect(await apiListShapeLibraries('owner-1')).toEqual([]);
    reply = new Response(JSON.stringify({ library }), { status: 201 });
    expect(
      await apiCreateShapeLibrary('owner-1', {
        id: 'lib-1',
        name: 'Team icons',
        source: 'drawio',
        items: [],
      }),
    ).toEqual(library);
    reply = new Response(JSON.stringify({ library }), { status: 200 });
    await apiUpdateShapeLibrary('owner-1', 'lib-1', { name: 'UML' });
    reply = new Response(null, { status: 204 });
    await apiDeleteShapeLibrary('owner-1', 'lib-1');
    expect(calls.map((c) => [c.method, c.url.replace(/^.*\/api/, ''), c.body])).toEqual([
      ['GET', '/shape-libraries', undefined],
      [
        'POST',
        '/shape-libraries',
        { id: 'lib-1', name: 'Team icons', source: 'drawio', items: [] },
      ],
      ['PUT', '/shape-libraries/lib-1', { name: 'UML' }],
      ['DELETE', '/shape-libraries/lib-1', undefined],
    ]);
  });

  it('throws an ApiError carrying the refusal', async () => {
    reply = new Response(JSON.stringify({ error: 'shape_library_cap' }), { status: 409 });
    const error = await apiCreateShapeLibrary('owner-1', {
      id: 'x',
      name: 'x',
      source: 'drawio',
      items: [],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(shapeLibraryErrorCopy(error)).toBe(
      'You have 100 shape libraries already. Delete one to add another.',
    );
  });
});

describe('shapeLibraryErrorCopy', () => {
  it.each([
    [
      new ApiError('x', 409, 'shape_library_name_taken'),
      'You already have a library with that name.',
    ],
    [new ApiError('x', 413, null), 'This library is too large to store.'],
    [new ApiError('x', 500, null), "Couldn't save this shape library. Try again."],
    [new Error('offline'), "Couldn't save this shape library. Try again."],
  ])('reads %s', (error, copy) => {
    expect(shapeLibraryErrorCopy(error)).toBe(copy);
  });
});
