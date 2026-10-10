import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { migrateFrom, sqliteD1 } from '../test-sqlite-d1';
import { copyDocument } from './documents';
import { documentRemovalStatements } from './document-removal';
import {
  documentServesImage,
  imageGrantCopyStatements,
  imageGrantPlacementStatements,
  servableImageIds,
} from './image-grants';
import { resetImageRefIndexMemo } from './image-refs';
import { linkTabToDocument, upsertTab } from './tabs';
import { tabWith } from './test-image-fixtures';
import { insert, liveDoc, team } from './test-trash-fixtures';

// Placement grants (docs/specs/009-elements/images.md, "Placement grants"): a
// document serves an image only when the image's owner owns it, or it holds a
// grant earned when the owner placed the image there or carried in by a copy.

afterEach(() => resetImageRefIndexMemo());

function image(sql: DatabaseSync, id: string, ownerId: string) {
  insert(sql, 'images', {
    id,
    owner_id: ownerId,
    content_type: 'image/png',
    byte_size: 1,
    width: 1,
    height: 1,
    sha256: id,
    created_at: 0,
  });
}

function grants(sql: DatabaseSync): string[] {
  return sql
    .prepare('SELECT document_id, image_id FROM image_grants ORDER BY document_id, image_id')
    .all()
    .map((r) => `${r.document_id}:${r.image_id}`);
}

describe('documentServesImage', () => {
  it("serves the document owner's own image", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'D', { owner: 'alice' });
    image(db.sql, 'mine', 'alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'mine'), 0);
    expect(await documentServesImage(db.env, 'D', 'mine')).toBe(true);
    expect([...(await servableImageIds(db.env, 'D', ['mine', 'missing']))]).toEqual(['mine']);
    expect(grants(db.sql)).toEqual([]);
  });

  // The paste-the-id case: a reader of Alice's document copies an image id
  // into a document of their own that Alice has no tie to.
  it("refuses another owner's image placed in a document that owner has no tie to", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'theirs', { owner: 'mallory' });
    image(db.sql, 'alice-img', 'alice');
    await upsertTab(db.env, 'theirs', tabWith('t1', 'alice-img'), 0);
    expect(await documentServesImage(db.env, 'theirs', 'alice-img')).toBe(false);
    expect(grants(db.sql)).toEqual([]);
    expect([...(await servableImageIds(db.env, 'theirs', ['alice-img']))]).toEqual([]);
  });

  it('refuses an image the document does not place, even its owner’s', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'D', { owner: 'alice' });
    image(db.sql, 'elsewhere', 'alice');
    expect(await documentServesImage(db.env, 'D', 'elsewhere')).toBe(false);
  });

  it("grants a teammate's image placed in a team document, and keeps it after they leave", async () => {
    const db = sqliteD1();
    team(db.sql, 'T', [['user_bob', 'joined']]);
    liveDoc(db.sql, 'D', { owner: 'user_alice', team: 'T' });
    image(db.sql, 'bob-img', 'user_bob');
    await upsertTab(db.env, 'D', tabWith('t1', 'bob-img'), 0);
    expect(grants(db.sql)).toEqual(['D:bob-img']);
    db.sql.exec("DELETE FROM team_members WHERE user_id = 'user_bob'");
    expect(await documentServesImage(db.env, 'D', 'bob-img')).toBe(true);
  });

  it('grants nothing for a member who has only been invited', async () => {
    const db = sqliteD1();
    team(db.sql, 'T', [['user_bob', 'pending']]);
    liveDoc(db.sql, 'D', { owner: 'user_alice', team: 'T' });
    image(db.sql, 'bob-img', 'user_bob');
    await upsertTab(db.env, 'D', tabWith('t1', 'bob-img'), 0);
    expect(await documentServesImage(db.env, 'D', 'bob-img')).toBe(false);
  });

  it("grants an edit collaborator's and a Participant's image, and not a view-only visitor's", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'D', { owner: 'alice' });
    image(db.sql, 'editor-img', 'guest-editor');
    image(db.sql, 'participant-img', 'guest-participant');
    image(db.sql, 'viewer-img', 'guest-viewer');
    // A Participant's row keeps the two-valued role at 'view' (migration 0080); its level says participate.
    for (const [owner, role, level] of [
      ['guest-editor', 'edit', null],
      ['guest-participant', 'view', 'participate'],
      ['guest-viewer', 'view', null],
    ] as const) {
      insert(db.sql, 'shared_with', {
        owner_id: owner,
        document_id: 'D',
        role,
        level,
        last_seen: 0,
      });
    }
    await upsertTab(db.env, 'D', tabWith('t1', 'editor-img', 'participant-img', 'viewer-img'), 0);
    expect(await documentServesImage(db.env, 'D', 'editor-img')).toBe(true);
    expect(await documentServesImage(db.env, 'D', 'participant-img')).toBe(true);
    expect(await documentServesImage(db.env, 'D', 'viewer-img')).toBe(false);
  });

  it('confines a tab-scoped visitor to their own tab', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'D', { owner: 'alice' });
    image(db.sql, 'i1', 'alice');
    image(db.sql, 'i2', 'alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'i1'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'i2'), 1);
    expect(await documentServesImage(db.env, 'D', 'i1', 't1')).toBe(true);
    expect(await documentServesImage(db.env, 'D', 'i2', 't1')).toBe(false);
  });
});

describe('copies', () => {
  async function source() {
    const db = sqliteD1();
    liveDoc(db.sql, 'src', { owner: 'alice' });
    image(db.sql, 'alice-img', 'alice');
    image(db.sql, 'planted', 'carol');
    await upsertTab(db.env, 'src', tabWith('t1', 'alice-img', 'planted'), 0);
    return db;
  }

  it("serves the source's images in a visitor's copy, and nothing the source could not serve", async () => {
    const db = await source();
    await copyDocument(db.env, 'src', 'copy', 'visitor', 'Copy');
    expect(await documentServesImage(db.env, 'copy', 'alice-img')).toBe(true);
    expect(await documentServesImage(db.env, 'copy', 'planted')).toBe(false);
  });

  it('carries grants through a Community copy and a copy of a copy', async () => {
    const db = await source();
    await copyDocument(db.env, 'src', 'c1', 'visitor', 'Copy', null, true);
    await copyDocument(db.env, 'c1', 'c2', 'someone', 'Copy of copy');
    expect(await documentServesImage(db.env, 'c1', 'alice-img')).toBe(true);
    expect(await documentServesImage(db.env, 'c2', 'alice-img')).toBe(true);
  });
});

// "Add a Tab to Another Document": the new holder serves what the tab already showed.
describe('linked tabs', () => {
  it("carries a teammate's image into a document the tab is linked into, and nothing planted", async () => {
    const db = sqliteD1();
    team(db.sql, 'T', [['user_bob', 'joined']]);
    liveDoc(db.sql, 'teamDoc', { owner: 'user_alice', team: 'T' });
    liveDoc(db.sql, 'personal', { owner: 'user_alice' });
    image(db.sql, 'bob-img', 'user_bob');
    image(db.sql, 'planted', 'carol');
    await upsertTab(db.env, 'teamDoc', tabWith('t1', 'bob-img', 'planted'), 0);
    expect(await linkTabToDocument(db.env, 'personal', 't1')).toBe(true);
    expect(await documentServesImage(db.env, 'personal', 'bob-img')).toBe(true);
    expect(await documentServesImage(db.env, 'personal', 'planted')).toBe(false);
  });
});

describe('empty id lists', () => {
  it('write and read nothing for a body that places no image', async () => {
    const db = sqliteD1();
    expect(imageGrantPlacementStatements(db.env, 't1', [], 0)).toEqual([]);
    expect(imageGrantCopyStatements(db.env, 'a', 'b', [], 0)).toEqual([]);
    expect((await servableImageIds(db.env, 'a', [])).size).toBe(0);
  });
});

describe('removal', () => {
  it("deletes a removed document's grants", async () => {
    const db = sqliteD1();
    team(db.sql, 'T', [['user_bob', 'joined']]);
    liveDoc(db.sql, 'D', { owner: 'user_alice', team: 'T' });
    image(db.sql, 'bob-img', 'user_bob');
    await upsertTab(db.env, 'D', tabWith('t1', 'bob-img'), 0);
    await db.env.DB.batch(documentRemovalStatements(db.env, { column: 'id', value: 'D' }));
    expect(grants(db.sql)).toEqual([]);
  });
});

// Migration 0075 cannot tell an old paste from a legitimate placement, so
// every reference that already crossed owners keeps rendering.
describe('migration 0075', () => {
  it('grants every existing cross-owner reference and nothing else', () => {
    const db = sqliteD1({}, { before: '0075' });
    liveDoc(db.sql, 'D', { owner: 'alice' });
    image(db.sql, 'own', 'alice');
    image(db.sql, 'foreign', 'bob');
    insert(db.sql, 'tabs', { id: 't1', name: 't1', data: '{}', updated_at: 0 });
    insert(db.sql, 'document_tabs', {
      document_id: 'D',
      tab_id: 't1',
      order_index: 0,
      added_at: 0,
    });
    insert(db.sql, 'image_refs', { tab_id: 't1', image_id: 'own' });
    insert(db.sql, 'image_refs', { tab_id: 't1', image_id: 'foreign' });
    migrateFrom(db.sql, '0075');
    expect(grants(db.sql)).toEqual(['D:foreign']);
  });
});
