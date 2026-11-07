import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SHAPE_LIBRARIES_PER_OWNER, type ShapeLibraryItem } from '@livehuddle/api-schema';
import { personStore } from '../person-client';
import { testPersonStores } from '../test-person-store';
import type { Env } from '../types';

// The person's store keeps the write side of shape libraries (cap, duplicate ids, name rules, update, delete) for
// account deletion and the guest move, though the routes no longer reach it (Work Tracker #515: read-only). Runs
// against a real PersonStore on node:sqlite.

const square = { id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60 };
const item = {
  id: 'i1',
  title: 'Service',
  width: 120,
  height: 60,
  elements: [square],
} as unknown as ShapeLibraryItem;
const lib = (id: string, name = id) => ({ id, name, source: 'drawio' as const, items: [item] });

let env: Env;
const store = (owner = 'owner-1') => personStore(env, owner);

beforeEach(() => {
  env = { PERSON_STORE: testPersonStores() } as unknown as Env;
});

describe('creating a library', () => {
  it('stores it, then reads it back by id and in the list', async () => {
    const made = await store().createShapeLibrary(lib('a', 'Team icons'), 3);
    expect(made).toMatchObject({ id: 'a', name: 'Team icons', ownerId: 'owner-1' });
    expect(await store().shapeLibrary('a')).toMatchObject({ id: 'a' });
    expect((await store().shapeLibraries()).map((l) => l.id)).toEqual(['a']);
  });

  it('suffixes a name already in use', async () => {
    await store().createShapeLibrary(lib('a', 'team icons'), 5);
    await store().createShapeLibrary(lib('b', 'Team icons (2)'), 5);
    expect(await store().createShapeLibrary(lib('c', 'Team icons'), 5)).toMatchObject({
      name: 'Team icons (3)',
    });
  });

  it('refuses past the cap and for an id already used', async () => {
    for (let i = 0; i < MAX_SHAPE_LIBRARIES_PER_OWNER; i++) {
      await store().createShapeLibrary(lib(`L${i}`), MAX_SHAPE_LIBRARIES_PER_OWNER);
    }
    expect(await store().createShapeLibrary(lib('extra'), MAX_SHAPE_LIBRARIES_PER_OWNER)).toBe(
      'cap',
    );
    expect(
      await store().createShapeLibrary(lib('L0', 'Other'), MAX_SHAPE_LIBRARIES_PER_OWNER + 1),
    ).toBe('exists');
  });
});

describe('updating and deleting a library', () => {
  it('renames (not into another library name), replaces items, and answers not_found', async () => {
    await store().createShapeLibrary(lib('a', 'Team icons'), 5);
    await store().createShapeLibrary(lib('b', 'UML'), 5);
    expect(await store().updateShapeLibrary('a', { name: 'uml' })).toBe('name_taken');
    expect(await store().updateShapeLibrary('a', { name: 'TEAM ICONS' })).toMatchObject({
      name: 'TEAM ICONS',
    });
    expect(await store().updateShapeLibrary('a', { items: [] })).toMatchObject({ items: [] });
    expect(await store().updateShapeLibrary('nope', { name: 'x' })).toBe('not_found');
  });

  it('deletes one library, and says so when there is none', async () => {
    await store().createShapeLibrary(lib('a'), 5);
    expect(await store().deleteShapeLibrary('a')).toBe(true);
    expect(await store().deleteShapeLibrary('a')).toBe(false);
    expect(await store().shapeLibraries()).toEqual([]);
  });

  it("keeps one person's libraries out of another's", async () => {
    await store('owner-2').createShapeLibrary(lib('a'), 5);
    expect(await store().shapeLibrary('a')).toBeNull();
    expect(await store().deleteShapeLibrary('a')).toBe(false);
  });
});
