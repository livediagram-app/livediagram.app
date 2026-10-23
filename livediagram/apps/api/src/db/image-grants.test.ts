import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { copyDocument, setDocumentFolder } from './documents';
import { handTeamWorkToHeir } from './teams';
import { migrateOwnerId } from './account';
import { documentRemovalStatements } from './document-removal';
import {
  documentMayServeImage,
  imageGrantCopyStatements,
  imageGrantPlacementStatements,
  servableImageIds,
} from './image-grants';
import { documentPlacesImage } from './image-refs';
import { upsertTab } from './tabs';
import type { DocumentEnv } from '../types';
import { tabWith } from './test-image-fixtures';
import { insert, liveDoc, team } from './test-trash-fixtures';

// Placement grants (docs/specs/009-elements/images.md, "Placement grants"): a
// document serves an image only when the image's owner owns it, or it holds a
// grant earned when the owner placed the image there or carried in by a copy.

// Whose an image is, as the media service's images are known here (src/media.ts).
function image(sql: DatabaseSync, id: string, ownerId: string) {
  insert(sql, 'media_images', { id, owner_id: ownerId });
}

// The byte endpoint's whole share check (routes/images.ts): the document places the image (asked of the document
// itself) and may serve it (D1).
async function documentServesImage(
  env: DocumentEnv,
  documentId: string,
  imageId: string,
  onlyTabId: string | null = null,
): Promise<boolean> {
  const [placed, may] = await Promise.all([
    documentPlacesImage(env, documentId, imageId, onlyTabId),
    documentMayServeImage(env, documentId, imageId),
  ]);
  return placed && may;
}

function grants(sql: DatabaseSync): string[] {
  const rows = sql
    .prepare('SELECT document_id, image_id FROM image_grants ORDER BY document_id, image_id')
    .all() as { document_id: string; image_id: string }[];
  return rows.map((r) => `${r.document_id}:${r.image_id}`);
}

describe('documentServesImage', () => {
  it("serves the document owner's own image", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'D', { owner: 'alice' });
    image(db.sql, 'mine', 'alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'mine'), 0);
    expect(await documentServesImage(db.env, 'D', 'mine')).toBe(true);
    expect([...(await servableImageIds(db.env, 'D', ['mine', 'missing']))]).toEqual(['mine']);
    await db.flush();
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
    await db.flush();
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
    await db.flush();
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
    db.sql.exec("UPDATE documents SET shareable = 1 WHERE id = 'D'");
    image(db.sql, 'editor-img', 'guest-editor');
    image(db.sql, 'participant-img', 'guest-participant');
    image(db.sql, 'viewer-img', 'guest-viewer');
    // A Participant's row keeps the two-valued role at 'view' (the baseline migration); its level says participate.
    for (const [owner, role, level] of [
      ['guest-editor', 'edit', null],
      ['guest-participant', 'view', 'participate'],
      ['guest-viewer', 'view', null],
    ] as const) {
      insert(db.sql, 'share_links', {
        code: `CODE-${owner}`,
        document_id: 'D',
        role,
        level,
        created_at: 0,
      });
      insert(db.sql, 'shared_with', {
        owner_id: owner,
        document_id: 'D',
        role,
        level,
        last_seen: 0,
        share_code: `CODE-${owner}`,
      });
    }
    await upsertTab(db.env, 'D', tabWith('t1', 'editor-img', 'participant-img', 'viewer-img'), 0);
    expect(await documentServesImage(db.env, 'D', 'editor-img')).toBe(true);
    expect(await documentServesImage(db.env, 'D', 'participant-img')).toBe(true);
    expect(await documentServesImage(db.env, 'D', 'viewer-img')).toBe(false);
  });

  it('earns nothing through an edit visit whose link was revoked (a pasted id)', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'D', { owner: 'mallory' });
    db.sql.exec("UPDATE documents SET shareable = 1 WHERE id = 'D'");
    image(db.sql, 'victim-img', 'victim');
    // Victim once opened Mallory's edit link; the link has since gone.
    insert(db.sql, 'shared_with', {
      owner_id: 'victim',
      document_id: 'D',
      role: 'edit',
      last_seen: 0,
      share_code: 'GONE',
    });
    await upsertTab(db.env, 'D', tabWith('t1', 'victim-img'), 0);
    expect(await documentServesImage(db.env, 'D', 'victim-img')).toBe(false);
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
    await db.flush();
    expect(grants(db.sql)).toEqual([]);
  });
});

// A document changing owner keeps serving the images its previous owner placed (docs/specs/009-elements/images.md
// "Placement grants": a grant outlives the membership).
describe('an owner change', () => {
  it("keeps a team document's images serving once its maker leaves the team", async () => {
    const db = sqliteD1();
    team(db.sql, 'T', [
      ['user_alice', 'joined'],
      ['user_bob', 'joined'],
    ]);
    liveDoc(db.sql, 'D', { owner: 'user_alice', team: 'T' });
    image(db.sql, 'alice-img', 'user_alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'alice-img'), 0);
    await handTeamWorkToHeir(db.env, 'T', 'user_alice');
    expect(db.sql.prepare("SELECT owner_id FROM documents WHERE id = 'D'").get()?.owner_id).toBe(
      'user_bob',
    );
    expect(await documentServesImage(db.env, 'D', 'alice-img')).toBe(true);
  });

  it("keeps them serving when a team document moves into someone else's library", async () => {
    const db = sqliteD1();
    team(db.sql, 'T', [['user_bob', 'joined']]);
    liveDoc(db.sql, 'D', { owner: 'user_alice', team: 'T' });
    image(db.sql, 'alice-img', 'user_alice');
    await upsertTab(db.env, 'D', tabWith('t1', 'alice-img'), 0);
    await setDocumentFolder(db.env, 'D', null, null, 'user_bob');
    expect(await documentServesImage(db.env, 'D', 'alice-img')).toBe(true);
  });

  // Sign-up (docs/specs/015-api/api.md "Owner-keyed data"): the guest's images become the account's here, even
  // one the media service keeps on the guest because the account already holds its bytes.
  it("keeps a guest's images serving after sign-up", async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'D', { owner: 'guest-1' });
    image(db.sql, 'guest-img', 'guest-1');
    image(db.sql, 'account-img', 'user_ada');
    image(db.sql, 'guest-only', 'guest-1');
    await upsertTab(db.env, 'D', tabWith('t1', 'guest-img'), 0);
    await upsertTab(db.env, 'D', tabWith('t2', 'guest-only'), 1);
    await migrateOwnerId(db.env, 'guest-1', 'user_ada');
    const owners = db.sql.prepare('SELECT id, owner_id FROM media_images ORDER BY id').all() as {
      id: string;
      owner_id: string;
    }[];
    expect(owners.map((r) => `${r.id}:${r.owner_id}`)).toEqual([
      'account-img:user_ada',
      'guest-img:user_ada',
      'guest-only:user_ada',
    ]);
    expect(await documentServesImage(db.env, 'D', 'guest-img')).toBe(true);
    expect(await documentServesImage(db.env, 'D', 'guest-only')).toBe(true);
  });
});
