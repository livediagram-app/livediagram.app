import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1, testCopyDesign, type SqliteD1 } from '../test-sqlite-d1';
import {
  designServesImage,
  imageGrantPlacementStatements,
  noteEntitled,
  servableImageIds,
} from './image-grants';
import { upsertTab } from './tabs';
import { tabWith } from './test-image-fixtures';

// Placement grants (docs/specs/009-elements/images.md, "Placement grants"), in the design's own SQLite: a design
// serves an image only when the image's owner owns the design, or it holds a grant earned when the owner placed
// the image there while they could add content to it, or carried in by a copy.

const NOW = Date.now();
const HOUR = 3_600_000;

function design(id: string, owner: string): SqliteD1 {
  const db = sqliteD1();
  start(db.sql, id, owner);
  return db;
}

function start(sql: DatabaseSync, id: string, owner: string) {
  sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, 1, 1)',
    )
    .run(id, owner, id);
}

// Whose an image is, as the design learnt it from the media service (src/media.ts learnMediaOwners).
function image(sql: DatabaseSync, id: string, ownerId: string) {
  sql.prepare('INSERT INTO media_images (id, owner_id) VALUES (?, ?)').run(id, ownerId);
}

function grants(sql: DatabaseSync): string[] {
  const rows = sql
    .prepare('SELECT design_id, image_id FROM image_grants ORDER BY design_id, image_id')
    .all() as { design_id: string; image_id: string }[];
  return rows.map((r) => `${r.design_id}:${r.image_id}`);
}

describe('designServesImage', () => {
  it("serves the design owner's own image, with no grant", async () => {
    const db = design('D', 'alice');
    image(db.sql, 'mine', 'alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'mine'), 0);
    expect(await designServesImage(db.env, 'D', 'mine')).toBe(true);
    expect([...(await servableImageIds(db.env, 'D', ['mine', 'missing']))]).toEqual(['mine']);
    expect(grants(db.sql)).toEqual([]);
  });

  // The paste-the-id case: a reader of Alice's design copies an image id into a design of their own that Alice
  // has no tie to.
  it("refuses another owner's image placed in a design that owner cannot add to", async () => {
    const db = design('theirs', 'mallory');
    image(db.sql, 'alice-img', 'alice');
    await upsertTab(db.env, 'theirs', tabWith('t1', 'alice-img'), 0);
    expect(await designServesImage(db.env, 'theirs', 'alice-img')).toBe(false);
    expect(grants(db.sql)).toEqual([]);
    expect([...(await servableImageIds(db.env, 'theirs', ['alice-img']))]).toEqual([]);
  });

  it('refuses an image the design does not place, even its owner’s', async () => {
    const db = design('D', 'alice');
    image(db.sql, 'elsewhere', 'alice');
    expect(await designServesImage(db.env, 'D', 'elsewhere')).toBe(false);
  });

  it('refuses an image whose owner the design never learnt', async () => {
    const db = design('D', 'alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'unknown'), 0);
    expect(await designServesImage(db.env, 'D', 'unknown')).toBe(false);
  });

  // A teammate, an edit collaborator or a Participant reached the design with a grant that lets them add content
  // (design-room.ts notes them): the images they own that the design places are granted as the body is saved, and
  // keep serving once their access ends.
  it("grants the image of someone who may add content, and keeps it after their access lapses", async () => {
    const db = design('D', 'user_alice');
    image(db.sql, 'bob-img', 'user_bob');
    await noteEntitled(db.env, 'user_bob', NOW + HOUR);
    await upsertTab(db.env, 'D', tabWith('t1', 'bob-img'), 0);
    expect(grants(db.sql)).toEqual(['D:bob-img']);
    db.sql.exec("UPDATE entitled SET until = 0 WHERE person_id = 'user_bob'");
    expect(await designServesImage(db.env, 'D', 'bob-img')).toBe(true);
  });

  // A revoked or expired link earns nothing: an id pasted after access went is not laundered into a grant.
  it('earns nothing once the entitlement has lapsed', async () => {
    const db = design('D', 'mallory');
    image(db.sql, 'victim-img', 'victim');
    await noteEntitled(db.env, 'victim', NOW - 1);
    await upsertTab(db.env, 'D', tabWith('t1', 'victim-img'), 0);
    expect(grants(db.sql)).toEqual([]);
    expect(await designServesImage(db.env, 'D', 'victim-img')).toBe(false);
  });

  it('only ever moves an entitlement on', async () => {
    const db = design('D', 'alice');
    await noteEntitled(db.env, 'bob', NOW + 2 * HOUR);
    await noteEntitled(db.env, 'bob', NOW + HOUR);
    expect(db.sql.prepare("SELECT until FROM entitled WHERE person_id = 'bob'").get()).toEqual({
      until: NOW + 2 * HOUR,
    });
  });

  it('confines a tab-scoped visitor to their own tab', async () => {
    const db = design('D', 'alice');
    image(db.sql, 'i1', 'alice');
    image(db.sql, 'i2', 'alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'i1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'i2'), 1);
    expect(await designServesImage(db.env, 'D', 'i1', 't1')).toBe(true);
    expect(await designServesImage(db.env, 'D', 'i2', 't1')).toBe(false);
  });
});

describe('copies', () => {
  async function source() {
    const db = design('src', 'alice');
    image(db.sql, 'alice-img', 'alice');
    image(db.sql, 'planted', 'carol');
    await upsertTab(db.env, 'src', tabWith('t1', 'alice-img', 'planted'), 0);
    return db;
  }

  it("serves the source's images in a visitor's copy, and nothing the source could not serve", async () => {
    const db = await source();
    await testCopyDesign(db.env, 'src', 'copy', 'visitor', 'Copy');
    expect(await designServesImage(db.env, 'copy', 'alice-img')).toBe(true);
    expect(await designServesImage(db.env, 'copy', 'planted')).toBe(false);
  });

  it('carries grants through a copy and a copy of a copy', async () => {
    const db = await source();
    await testCopyDesign(db.env, 'src', 'c1', 'visitor', 'Copy');
    await testCopyDesign(db.env, 'c1', 'c2', 'someone', 'Copy of copy');
    expect(await designServesImage(db.env, 'c1', 'alice-img')).toBe(true);
    expect(await designServesImage(db.env, 'c2', 'alice-img')).toBe(true);
  });
});

describe('empty id lists', () => {
  it('write and read nothing for a body that places no image', async () => {
    const db = sqliteD1();
    expect(imageGrantPlacementStatements(db.env, 't1', [], 0)).toEqual([]);
    expect((await servableImageIds(db.env, 'a', [])).size).toBe(0);
  });
});
