import { beforeEach, describe, expect, it } from 'vitest';
import type { FormLinkResponse, PublicFormResponse } from '@livediagram/api-schema';
import { FROM_FORM_FIELD, type FormDefinition } from '@livediagram/forms';
import { ITEMS_MAX, presetSetup, type Item } from '@livediagram/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { generateFormCode, listItems } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { handleForms } from './forms';
import { FORM_RESPONSES_PER_HOUR } from '../forms/respond';

// Form links (docs/specs/030-forms/forms.md, blueprint §11): publishing by role, the public read, responses made
// into cards, every refusal, reports, and a deleted tab taking its link.

let sql: SqliteD1;
let relayed: { op: { kind: string; upserts: Item[] } }[];

const form = (extra: Partial<FormDefinition> = {}): FormDefinition => ({
  v: 1,
  heading: 'Bug Report',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-sum', type: 'short', prompt: 'Summary', required: true, goesTo: { to: 'title' } },
        { id: 'q-what', type: 'paragraph', prompt: 'What happened?' },
        {
          id: 'q-sev',
          type: 'single',
          prompt: 'Severity',
          options: ['Low', 'High'],
          goesTo: { to: 'field', fieldId: 'f-severity' },
        },
      ],
    },
  ],
  destination: { tabId: 'board', typeId: 'bug', status: 'new' },
  ...extra,
});

function writeForm(f: FormDefinition) {
  sql.sql
    .prepare(`UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 'ftab'`)
    .run(JSON.stringify({ kind: 'form', opensIn: 'plan', elements: [], form: f }));
}

async function owner<T = FormLinkResponse>(
  method: string,
  path: string,
  opts: { owner?: string; code?: string; body?: unknown } = {},
) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, `/api/documents/d1/tabs/ftab/${path}`, {
    env: sql.env,
    owner: opts.owner ?? 'owner',
    ...(opts.code ? { headers: { 'X-Share-Code': opts.code } } : {}),
    ...(opts.body === undefined ? {} : { body: opts.body }),
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleDocuments(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

async function pub<T = unknown>(method: string, path: string, body?: unknown, raw?: string) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, `/api/forms/${path}`, {
    env: sql.env,
    owner: null,
    ...(raw !== undefined ? { rawBody: raw } : body === undefined ? {} : { body }),
    headers: { 'CF-Connecting-IP': '203.0.113.9' },
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleForms(ctx);
  await Promise.all(pending);
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

async function publish(): Promise<string> {
  const res = await owner('POST', 'form-link');
  expect(res.status).toBe(200);
  return res.body.link!.code;
}

const items = () => listItems(sql.env, 'd1');

beforeEach(() => {
  sql = sqliteD1();
  relayed = [];
  (sql.env as unknown as { DOCUMENT_ROOM: unknown }).DOCUMENT_ROOM = {
    idFromName: (n: string) => n,
    get: () => ({
      fetch: async (_url: string, init: RequestInit) => {
        relayed.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      },
    }),
  };
  const catalogue = {
    version: 1,
    types: [
      {
        id: 'bug',
        label: 'Bug',
        newTitle: 'New bug',
        glyph: 'bug',
        color: '#0284c7',
        fields: ['title', 'status', 'description', 'f-severity'],
        custom: [{ id: 'f-severity', label: 'Severity', kind: 'choice', options: ['Low', 'High'] }],
      },
    ],
  };
  sql.sql
    .prepare(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at, item_types) VALUES ('d1', 'owner', 'Ops', 1, 1, 1, ?)`,
    )
    .run(JSON.stringify(catalogue));
  const board = {
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    planBoard: presetSetup('bug-triage'),
  };
  sql.sql
    .prepare(`INSERT INTO tabs (id, name, data, updated_at) VALUES ('board', 'Bugs', ?, 1)`)
    .run(JSON.stringify({ kind: 'board', elements: [board] }));
  sql.sql.exec(`
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('ftab', 'Bug Report', '{}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 'board', 0, 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 'ftab', 1, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
    INSERT INTO share_links (code, document_id, role, level, tab_id, created_at) VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO share_links (code, document_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
  `);
  writeForm(form());
});

describe('publishing (docs/specs/030-forms/forms.md "Publishing and the form link")', () => {
  it('starts unpublished, then publishes a 22-character link, once', async () => {
    expect((await owner('GET', 'form-link')).body).toEqual({
      link: null,
      responses: 0,
      unseen: 0,
      suspendedAt: null,
      canPublish: true,
    });
    const code = await publish();
    expect(code).toMatch(/^[A-Za-z0-9]{22}$/);
    expect((await owner('POST', 'form-link')).status).toBe(409);
  });

  it('refuses to publish a form not ready to fill in, naming why', async () => {
    writeForm({ ...form(), sections: [{ id: 's-1', title: '', questions: [] }] });
    expect((await owner('POST', 'form-link')).body).toEqual({
      error: 'form_not_ready',
      problems: [{ kind: 'no_questions' }],
    });
  });

  it('refuses to publish without a working destination', async () => {
    writeForm(form({ destination: undefined }));
    expect((await owner('POST', 'form-link')).body).toMatchObject({
      error: 'form_destination_missing',
    });
    writeForm(form({ destination: { tabId: 'board', typeId: 'bug', status: 'gone' } }));
    expect((await owner('POST', 'form-link')).status).toBe(409);
  });

  it('refuses a tab that is no Form tab', async () => {
    sql.sql
      .prepare(`UPDATE tabs SET data = '{"elements":[]}', rev = rev + 1 WHERE id = 'ftab'`)
      .run();
    expect((await owner('POST', 'form-link')).status).toBe(404);
  });

  it('lets an Editor link publish, shows Viewers and Participants the count but never the code', async () => {
    expect((await owner('POST', 'form-link', { owner: 'visitor', code: 'PART' })).status).toBe(403);
    expect((await owner('POST', 'form-link', { owner: 'visitor', code: 'VIEW' })).status).toBe(403);
    const made = await owner('POST', 'form-link', { owner: 'editor', code: 'EDIT' });
    expect(made.body.link?.code).toMatch(/^[A-Za-z0-9]{22}$/);
    for (const code of ['VIEW', 'PART']) {
      const seen = await owner('GET', 'form-link', { owner: 'visitor', code });
      expect(seen.status).toBe(200);
      expect(seen.body.link).toMatchObject({ code: '', open: true });
      expect(
        (await owner('PUT', 'form-link', { owner: 'visitor', code, body: { open: false } })).status,
      ).toBe(403);
      expect((await owner('DELETE', 'form-link', { owner: 'visitor', code })).status).toBe(403);
    }
    expect((await owner('GET', 'form-link', { owner: 'stranger' })).status).toBe(403);
  });

  it('closes, reopens and deletes the link', async () => {
    const code = await publish();
    expect((await owner('PUT', 'form-link', { body: { open: false } })).body.link?.open).toBe(
      false,
    );
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('closed');
    expect((await owner('PUT', 'form-link', { body: { open: 'no' } })).status).toBe(400);
    expect((await owner('PUT', 'form-link', { body: { open: true } })).body.link?.open).toBe(true);
    expect((await owner('DELETE', 'form-link')).body.link).toBeNull();
    expect((await pub('GET', code)).status).toBe(404);
    expect((await owner('PUT', 'form-link', { body: { open: true } })).status).toBe(404);
  });

  it('takes the link away with its tab', async () => {
    const code = await publish();
    const pending: Promise<unknown>[] = [];
    const res = await handleDocuments(
      makeTestRouteContext('DELETE', '/api/documents/d1/tabs/ftab', {
        env: sql.env,
        owner: 'owner',
        waitUntil: (p) => void pending.push(p),
      }),
    );
    await Promise.all(pending);
    expect(res.status).toBe(204);
    expect((await pub('GET', code)).status).toBe(404);
    expect(sql.sql.prepare('SELECT COUNT(*) AS n FROM form_links').get()).toEqual({ n: 0 });
  });

  // The user's call (2026-10-15): deleting the board a form sends to pauses the form, its link kept.
  it('pauses a form whose board is deleted, keeping its link', async () => {
    const code = await publish();
    const del = async (tab: string) => {
      const pending: Promise<unknown>[] = [];
      const res = await handleDocuments(
        makeTestRouteContext('DELETE', `/api/documents/d1/tabs/${tab}`, {
          env: sql.env,
          owner: 'owner',
          waitUntil: (p) => void pending.push(p),
        }),
      );
      await Promise.all(pending);
      return res.status;
    };
    expect((await pub('GET', code)).status).toBe(200);
    expect(await del('board')).toBe(204);
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('closed');
    expect((await owner('GET', 'form-link')).body).toMatchObject({ link: { open: false } });
    // It cannot open again while its responses have nowhere to go.
    expect((await owner('PUT', 'form-link', { body: { open: true } })).status).toBe(409);
  });

  it('refuses to open a closed form again until it is ready, and always lets it close', async () => {
    await publish();
    expect((await owner('PUT', 'form-link', { body: { open: false } })).status).toBe(200);
    const f = form();
    writeForm({
      ...f,
      sections: [{ ...f.sections[0]!, questions: [{ id: 'q-x', type: 'short', prompt: '' }] }],
    });
    const res = await owner<{ error: string }>('PUT', 'form-link', { body: { open: true } });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('form_not_ready');
    writeForm(form());
    expect((await owner('PUT', 'form-link', { body: { open: true } })).status).toBe(200);
  });
});

describe('the public form (docs/specs/030-forms/forms.md "Filling in a form")', () => {
  it('shows the form without where its answers go', async () => {
    const code = await publish();
    const res = await pub<PublicFormResponse>('GET', code);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('open');
    expect(JSON.stringify(res.body)).not.toMatch(/goesTo|destination|f-severity/);
    expect(res.body.look).toMatchObject({
      backdrop: { light: expect.any(String), dark: expect.any(String) },
      accent: { light: expect.any(String), dark: expect.any(String) },
      finish: 'flexible',
    });
  });

  it('answers every miss with the same 404', async () => {
    expect((await pub('GET', 'short')).status).toBe(404);
    expect((await pub('GET', generateFormCode())).status).toBe(404);
    const code = await publish();
    sql.sql.prepare('UPDATE documents SET trashed_at = 1').run();
    expect((await pub('GET', code)).status).toBe(404);
  });

  it('shows a closed form its closed message, past its close time or response limit', async () => {
    const code = await publish();
    writeForm(form({ closesAt: 1, closedMessage: 'See you next year.' }));
    expect((await pub<PublicFormResponse>('GET', code)).body).toMatchObject({
      state: 'closed',
      heading: 'Bug Report',
      message: 'See you next year.',
      look: { finish: 'flexible' },
    });
    writeForm(form({ limit: 1 }));
    await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'One' } });
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('closed');
    expect((await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'Two' } })).body).toEqual({
      error: 'form_closed',
    });
  });

  it('shows a form whose board went as closed', async () => {
    const code = await publish();
    sql.sql
      .prepare(
        `UPDATE tabs SET data = '{"kind":"board","elements":[]}', rev = rev + 1 WHERE id = 'board'`,
      )
      .run();
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('closed');
    expect((await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'x' } })).status).toBe(
      409,
    );
  });

  it('answers only GET and POST at their paths', async () => {
    const code = await publish();
    expect((await pub('POST', code)).status).toBe(405);
    expect((await pub('GET', `${code}/responses`)).status).toBe(405);
    expect((await pub('GET', `${code}/reports`)).status).toBe(405);
    expect((await pub('GET', `${code}/other`)).status).toBe(404);
  });
});

describe('responses (docs/specs/030-forms/forms.md "What a response makes")', () => {
  it('makes one card in the destination, relays it and numbers it', async () => {
    const code = await publish();
    const res = await pub('POST', `${code}/responses`, {
      answers: { 'q-sum': 'Crash on save', 'q-what': 'It froze', 'q-sev': 'High', 'q-gone': 'x' },
    });
    expect(res).toEqual({ status: 201, body: { number: 1 } });
    const [card] = await items();
    expect(card).toMatchObject({
      type: 'bug',
      fields: {
        title: 'Crash on save',
        status: 'new',
        description: 'What happened?\nIt froze',
        'f-severity': 'High',
        [FROM_FORM_FIELD]: 'ftab:1',
      },
      createdBy: { name: 'Bug Report form', color: '#0284c7' },
    });
    expect(relayed.map((r) => r.op.kind)).toEqual(['items']);
    expect(
      (await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'Again' } })).body,
    ).toEqual({ number: 2 });
    const seen = await owner('GET', 'form-link');
    expect(seen.body).toMatchObject({ responses: 2, unseen: 2 });
    expect((await owner('POST', 'form-seen')).body).toMatchObject({ unseen: 0 });
  });

  it('refuses bad answers by question, taking no number', async () => {
    const code = await publish();
    const res = await pub('POST', `${code}/responses`, { answers: { 'q-sev': 'Medium' } });
    expect(res).toEqual({
      status: 400,
      body: { error: 'invalid_answers', errors: { 'q-sum': 'required', 'q-sev': 'not_an_option' } },
    });
    expect((await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'Ok' } })).body).toEqual({
      number: 1,
    });
  });

  it('refuses a body that is not answers', async () => {
    const code = await publish();
    expect((await pub('POST', `${code}/responses`, undefined, '{nope')).status).toBe(400);
    expect((await pub('POST', `${code}/responses`, { answers: 'x' })).status).toBe(400);
    expect((await pub('POST', `${code}/responses`, undefined, 'x'.repeat(70_000))).status).toBe(
      413,
    );
  });

  it('drops a response that fills the hidden field, answering as if kept', async () => {
    const code = await publish();
    const res = await pub('POST', `${code}/responses`, {
      answers: { 'q-sum': 'Spam' },
      website: 'http://x',
    });
    expect(res).toEqual({ status: 201, body: { number: 0 } });
    expect(await items()).toEqual([]);
  });

  it('holds the hourly cap per form', async () => {
    const code = await publish();
    sql.sql
      .prepare('UPDATE form_links SET hour_start = ?, hour_count = ?')
      .run(Date.now(), FORM_RESPONSES_PER_HOUR);
    expect((await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'x' } })).body).toEqual({
      error: 'form_busy',
    });
    sql.sql.prepare('UPDATE form_links SET hour_start = 1').run();
    expect((await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'x' } })).status).toBe(
      201,
    );
  });

  it('says the form is full when the document holds as many cards as it can', async () => {
    const code = await publish();
    const insert = sql.sql.prepare(
      `INSERT INTO items (document_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('d1', ?, 'bug', ?, 'a', '{}', 1, 1, 1, '{}', '{}')`,
    );
    for (let i = 1; i <= ITEMS_MAX; i += 1) insert.run(`i${i}`, i);
    const res = await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'x' } });
    expect(res).toEqual({ status: 413, body: { error: 'form_full' } });
  });

  it('titles a card by the form and its number when nothing goes to Title', async () => {
    const f = form();
    delete f.sections[0]!.questions[0]!.goesTo;
    writeForm(f);
    const code = await publish();
    await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'Hello' } });
    expect((await items())[0]!.fields).toMatchObject({
      title: 'Bug Report #1',
      description: 'Summary\nHello',
    });
  });
});

describe('responses to a Sheet (docs/specs/030-forms/forms.md "Responses to a Sheet")', () => {
  const SHEET = 'shtAAAAAA001';
  // The sheet on its Sheet tab, that tab in the document.
  const seedSheet = () => {
    sql.sql
      .prepare(
        `INSERT OR IGNORE INTO tabs (id, name, data, updated_at, element_count, rev) VALUES ('stab', 'Responses', '{}', 1, 0, 0)`,
      )
      .run();
    sql.sql
      .prepare(
        `INSERT OR IGNORE INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 'stab', 1, 1)`,
      )
      .run();
    sql.sql
      .prepare(
        `INSERT INTO sheets (document_id, id, tab_id, title, layout, rev, created_at, updated_at, updated_by)
         VALUES ('d1', ?, 'stab', 'Responses', '{"rows":["ra01","ra02","ra03"],"cols":["ca01","ca02"]}', 0, 1, 1, '{}')`,
      )
      .run(SHEET);
  };
  const cells = () =>
    sql.sql
      .prepare(
        `SELECT row_id, col_id, input FROM sheet_cells WHERE sheet_id = ? ORDER BY row_id, col_id`,
      )
      .all(SHEET) as { row_id: string; col_id: string; input: string }[];
  const textAt = (row: string) =>
    cells()
      .filter((c) => c.row_id === row)
      .map((c) => JSON.parse(c.input) as Record<string, unknown>);

  it('adds a row under the headers it writes, a column per question, no card', async () => {
    seedSheet();
    writeForm(form({ sheet: { tabId: 'stab', sheetId: SHEET } }));
    const code = await publish();
    const res = await pub('POST', `${code}/responses`, {
      answers: { 'q-sum': 'Crash on save', 'q-sev': 'High' },
    });
    expect(res).toEqual({ status: 201, body: { number: 1 } });
    expect(await items()).toEqual([]);
    expect(textAt('ra01').map((i) => i['s'])).toContain('Summary');
    const row = textAt('ra02');
    expect(row).toContainEqual({ n: 1 });
    expect(row).toContainEqual({ s: 'Crash on save' });
    await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'Again' } });
    expect(textAt('ra03')).toContainEqual({ s: 'Again' });
    expect((await owner('GET', 'form-link')).body).toMatchObject({ responses: 2 });
  });

  it('closes when its sheet is gone, and previews an unpublished form into a Preview row', async () => {
    writeForm(form({ sheet: { tabId: 'stab', sheetId: SHEET } }));
    expect((await owner('POST', 'form-link')).status).toBe(409);
    seedSheet();
    const preview = await owner('POST', 'form-preview', { body: { answers: { 'q-sum': 'Try' } } });
    expect(preview).toEqual({ status: 201, body: { number: 0 } });
    expect(textAt('ra02')).toContainEqual({ s: 'Preview' });
    expect((await owner('POST', 'form-preview', { body: { answers: {} } })).body).toMatchObject({
      error: 'invalid_answers',
    });
    const code = await publish();
    sql.sql.prepare(`DELETE FROM sheets WHERE id = ?`).run(SHEET);
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('closed');
    expect((await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'x' } })).status).toBe(
      409,
    );
  });

  // A deleted Sheet tab can leave its sheet behind: a row there would never be seen.
  it("takes no row, Preview or response, once the sheet's tab has left the document", async () => {
    seedSheet();
    writeForm(form({ sheet: { tabId: 'stab', sheetId: SHEET } }));
    const code = await publish();
    sql.sql.prepare(`DELETE FROM document_tabs WHERE tab_id = 'stab'`).run();
    expect(
      (await owner('POST', 'form-preview', { body: { answers: { 'q-sum': 'Try' } } })).status,
    ).toBe(409);
    expect((await pub<PublicFormResponse>('GET', code)).body.state).toBe('closed');
    expect((await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'x' } })).status).toBe(
      409,
    );
    expect(cells()).toEqual([]);
  });
});

describe('an Editor\'s Preview (docs/specs/030-forms/forms.md "Preview")', () => {
  it("counts a published form's preview as a response, titled Preview, even while closed", async () => {
    expect(
      (await owner('POST', 'form-preview', { body: { answers: { 'q-sum': 'x' } } })).body,
    ).toEqual({ error: 'form_not_published' });
    await publish();
    await owner('PUT', 'form-link', { body: { open: false } });
    const res = await owner('POST', 'form-preview', {
      body: { answers: { 'q-sum': 'Checkout broke' }, website: 'ignored for a preview' },
    });
    expect(res).toEqual({ status: 201, body: { number: 1 } });
    const [card] = await items();
    expect(card!.fields).toMatchObject({
      title: 'Preview: Checkout broke',
      [FROM_FORM_FIELD]: 'ftab:1',
    });
    // Counted, and seen by the previewer who was up to date.
    expect((await owner('GET', 'form-link')).body).toMatchObject({ responses: 1, unseen: 0 });
  });

  it("keeps unseen responses new, refuses bad answers, and is an Editor's alone", async () => {
    const code = await publish();
    await pub('POST', `${code}/responses`, { answers: { 'q-sum': 'Real one' } });
    await owner('POST', 'form-preview', { body: { answers: { 'q-sum': 'Mine' } } });
    expect((await owner('GET', 'form-link')).body).toMatchObject({ responses: 2, unseen: 2 });
    expect((await owner('POST', 'form-preview', { body: { answers: {} } })).body).toMatchObject({
      error: 'invalid_answers',
    });
    expect((await owner('GET', 'form-preview')).status).toBe(405);
    expect(
      (
        await owner('POST', 'form-preview', {
          owner: 'visitor',
          code: 'VIEW',
          body: { answers: {} },
        })
      ).status,
    ).toBe(403);
  });
});

describe('reports (docs/specs/030-forms/forms.md "Report This Form")', () => {
  const ip = async (code: string, browser: string, address: string, reason = 'phishing') => {
    const ctx = makeTestRouteContext('POST', `/api/forms/${code}/reports`, {
      env: sql.env,
      owner: null,
      body: { reason, browser },
      headers: { 'CF-Connecting-IP': address },
    });
    return (await handleForms(ctx)).status;
  };

  it('suspends a link reported from three networks, for good', async () => {
    const code = await publish();
    expect(await ip(code, 'browser-aaaa', '198.51.100.1')).toBe(201);
    // A second browser on the same network counts once.
    expect(await ip(code, 'browser-bbbb', '198.51.100.2')).toBe(201);
    expect(await ip(code, 'browser-cccc', '192.0.2.7')).toBe(201);
    expect((await pub('GET', code)).status).toBe(200);
    expect(await ip(code, 'browser-dddd', '203.0.113.50')).toBe(201);
    expect((await pub('GET', code)).status).toBe(404);
    const after = await owner('GET', 'form-link');
    expect(after.body).toMatchObject({
      link: null,
      suspendedAt: expect.any(Number),
      canPublish: true,
    });
    // Publishing again makes a new link that carries on the numbering.
    const next = await publish();
    expect(next).not.toBe(code);
  });

  it('refuses a malformed report', async () => {
    const code = await publish();
    expect(await ip(code, 'browser-aaaa', '198.51.100.1', 'meh')).toBe(400);
    expect(await ip(code, 'x', '198.51.100.1')).toBe(400);
    expect(await ip(generateFormCode(), 'browser-aaaa', '198.51.100.1')).toBe(404);
  });

  it('stops a document publishing after two suspensions', async () => {
    for (let i = 0; i < 2; i += 1) {
      const code = await publish();
      for (const [n, a] of [
        ['a', '198.51.100.1'],
        ['b', '203.0.113.1'],
        ['c', '192.0.2.1'],
      ] as const)
        await ip(code, `browser-${n}${i}xxxx`, a);
    }
    expect((await owner('GET', 'form-link')).body.canPublish).toBe(false);
    expect((await owner('POST', 'form-link')).body).toMatchObject({ error: 'form_suspensions' });
  });
});

describe('an agent’s form write (docs/specs/030-forms/forms.md "Agents")', () => {
  const write = (f: unknown, opts: { owner?: string; code?: string; rev?: number } = {}) =>
    owner<{ error?: string; rev?: number; name?: string }>('POST', 'form', {
      ...(opts.owner ? { owner: opts.owner } : {}),
      ...(opts.code ? { code: opts.code } : {}),
      body: { form: f, ...(opts.rev === undefined ? {} : { rev: opts.rev }) },
    });
  const stored = () => {
    const row = sql.sql.prepare(`SELECT name, rev, data FROM tabs WHERE id = 'ftab'`).get() as {
      name: string;
      rev: number;
      data: string;
    };
    return { name: row.name, rev: row.rev, form: JSON.parse(row.data).form as FormDefinition };
  };

  it('replaces the form at the revision read, the tab taking its heading, and tells open editors', async () => {
    const res = await write(form({ heading: 'Crash Report' }), { rev: stored().rev });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Crash Report', rev: stored().rev });
    expect(stored()).toMatchObject({ name: 'Crash Report', form: { heading: 'Crash Report' } });
    expect(relayed.at(-1)?.op).toMatchObject({
      kind: 'tab-meta',
      tabId: 'ftab',
      patch: { name: 'Crash Report', form: { heading: 'Crash Report' } },
    });
  });

  it('refuses a form changed since it was read, naming the revision', async () => {
    const res = await write(form({ heading: 'X' }), { rev: stored().rev - 1 });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'form_changed', rev: stored().rev });
    expect(stored().name).toBe('Bug Report');
  });

  it('is an Editor’s: a Participant or a Viewer is refused', async () => {
    expect((await write(form({ heading: 'X' }), { owner: 'guest', code: 'PART' })).status).toBe(
      403,
    );
    expect((await write(form({ heading: 'X' }), { owner: 'guest', code: 'VIEW' })).status).toBe(
      403,
    );
    expect((await write(form({ heading: 'X' }), { owner: 'guest', code: 'EDIT' })).status).toBe(
      200,
    );
  });

  it('locks a form taking responses but its settings, and frees it once closed', async () => {
    await publish();
    const locked = await write(form({ heading: 'Crash Report' }));
    expect(locked).toMatchObject({ status: 409, body: { error: 'form_locked' } });
    expect(stored().name).toBe('Bug Report');
    expect((await write(form({ limit: 50, confirmation: 'Thanks!' }))).status).toBe(200);
    expect(stored().form).toMatchObject({ limit: 50, confirmation: 'Thanks!' });
    expect((await owner('PUT', 'form-link', { body: { open: false } })).status).toBe(200);
    expect((await write(form({ heading: 'Crash Report' }))).status).toBe(200);
  });

  it('refuses a tab that holds no form, and a body that is no form', async () => {
    const other = makeTestRouteContext('POST', '/api/documents/d1/tabs/board/form', {
      env: sql.env,
      owner: 'owner',
      body: { form: form() },
    });
    const res = await handleDocuments(other);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('not_a_form_tab');
    expect((await write('nope')).body.error).toBe('invalid_body');
  });
});
