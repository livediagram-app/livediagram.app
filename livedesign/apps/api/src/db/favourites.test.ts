import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { addFavourite, listFavouriteIds } from './favourites';

// docs/specs/013-workspace/favourites.md: a star is one insert, no lookup first; the table's foreign key refuses a
// design that is not there, and that refusal is an answer, not a server error.
describe('addFavourite', () => {
  const withDesign = () => {
    const db = sqliteD1();
    db.sql
      .prepare(
        "INSERT INTO designs (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d1', 'o', 'D', 0, 1, 1)",
      )
      .run();
    return db;
  };

  it('stars a design that exists, idempotently', async () => {
    const db = withDesign();
    expect(await addFavourite(db.env, 'o', 'd1')).toBe(true);
    expect(await addFavourite(db.env, 'o', 'd1')).toBe(true);
    expect(await listFavouriteIds(db.env, 'o')).toEqual(['d1']);
  });

  it('answers false for a design that does not exist, starring nothing', async () => {
    const db = withDesign();
    expect(await addFavourite(db.env, 'o', 'gone')).toBe(false);
    expect(await listFavouriteIds(db.env, 'o')).toEqual([]);
  });

  it('still throws any other database failure', async () => {
    const failing = {
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => {
              throw new Error('D1_ERROR: database is locked');
            },
          }),
        }),
      },
    };
    await expect(addFavourite(failing as never, 'o', 'd1')).rejects.toThrow('database is locked');
  });
});
