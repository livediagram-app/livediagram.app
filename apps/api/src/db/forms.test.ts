import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  claimFormEmail,
  claimResponseNumber,
  createFormLink,
  generateFormCode,
  markFormSeen,
} from './forms';
import { readActivity } from './collab-index';

// form_links' helpers (docs/specs/030-forms/blueprints/forms.md §11).

describe('generateFormCode', () => {
  it('draws 22 base-62 characters, skipping the bytes that would bias it', () => {
    expect(generateFormCode()).toMatch(/^[A-Za-z0-9]{22}$/);
    let calls = 0;
    // The first draw is all biased bytes (248+), the next all zeros.
    const code = generateFormCode((n) => new Uint8Array(n).fill(calls++ === 0 ? 250 : 0));
    expect(code).toBe('A'.repeat(22));
  });
});

describe('claimFormEmail', () => {
  it('sends one email per window, then counts what it held', async () => {
    const { env, sql } = sqliteD1();
    sql.exec(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('d', 'o', 'D', 0, 1, 1)`,
    );
    const link = await createFormLink(env, 'd', 't', 1);
    const code = link!.code;
    expect(await claimFormEmail(env, code, 1000, 500)).toEqual({ send: true, heldBefore: 0 });
    expect(await claimFormEmail(env, code, 1100, 500)).toEqual({ send: false });
    expect(await claimFormEmail(env, code, 1200, 500)).toEqual({ send: false });
    expect(await claimFormEmail(env, code, 1600, 500)).toEqual({ send: true, heldBefore: 2 });
    expect(await claimFormEmail(env, 'missing', 1600, 500)).toEqual({ send: false });
    // A second live link for the same tab is refused.
    expect(await createFormLink(env, 'd', 't', 2)).toBeNull();
  });
});

describe('the Inbox read (docs/specs/030-forms/forms.md "Hearing about responses")', () => {
  it("lists forms with unseen responses on the reader's own documents only", async () => {
    const { env, sql } = sqliteD1();
    const tab = (id: string, doc: string) => {
      sql.prepare('INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 1)').run(
        id,
        'Bug Report',
        JSON.stringify({
          kind: 'form',
          form: { heading: 'Bugs', destination: { tabId: 'board' } },
        }),
      );
      sql
        .prepare(
          'INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES (?, ?, 0, 1)',
        )
        .run(doc, id);
    };
    sql.exec(`
      INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('mine', 'me', 'Ops', 0, 1, 1);
      INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES ('theirs', 'other', 'X', 0, 1, 1);
    `);
    tab('t1', 'mine');
    tab('t2', 'theirs');
    const mine = (await createFormLink(env, 'mine', 't1', 1))!;
    const theirs = (await createFormLink(env, 'theirs', 't2', 1))!;
    for (const code of [mine.code, mine.code, mine.code, theirs.code])
      await claimResponseNumber(env, code, 5000, 500);
    let read = await readActivity(env, 'me', { limit: 10 });
    expect(read.formResponses).toEqual([
      {
        documentId: 'mine',
        documentName: 'Ops',
        teamId: null,
        via: 'own',
        tabId: 't1',
        heading: 'Bugs',
        boardTabId: 'board',
        unseen: 3,
        latestAt: 5000,
      },
    ]);
    await markFormSeen(env, mine.code, 'me');
    read = await readActivity(env, 'me', { limit: 10 });
    expect(read.formResponses).toEqual([]);
  });
});
