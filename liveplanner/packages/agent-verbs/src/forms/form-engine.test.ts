import { describe, expect, it } from 'vitest';
import type { FormLinkResponse } from '@liveplanner/api-schema';
import { presetSetup } from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import { sheetJson, sheetServer } from '../testing/sheets';
import { bugForm, formPlan, formTabBody } from '../testing/forms';
import { addForm, changeForm, readForm, shareForm } from './form-calls';

// The form verbs' calls (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Engine flow"): one read, every
// change checked, then card types, the form and its responses tabs written in that order.
const LINK: FormLinkResponse = {
  link: { code: 'AbCdEfGhIjKlMnOpQrStUv', open: true, createdAt: 1 },
  responses: 4,
  unseen: 0,
  suspendedAt: null,
  canPublish: true,
};

function api(
  link: FormLinkResponse | null = null,
  extra: Record<string, unknown> = {},
  // Routes answered by path pattern (the sheet server's).
  fallback: Record<string, unknown> = {},
) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const record = (answer: unknown) => async (r: Request) => {
    const path = new URL(r.url).pathname.replace(/^\/api/, '');
    if (r.method !== 'GET')
      writes.push({ method: r.method, path, body: await r.json().catch(() => null) });
    return Response.json(answer);
  };
  const routes: Record<string, unknown> = {
    '/projects/doc/plan': formPlan(),
    '/projects/doc/tabs/form': { tab: formTabBody() },
    '/projects/doc/item-types': record({ ok: true }),
    '/projects/doc/tabs/form/form-link': link
      ? record(link)
      : async (r: Request) =>
          r.method === 'GET'
            ? Response.json({
                link: null,
                responses: 0,
                unseen: 0,
                suspendedAt: null,
                canPublish: true,
              })
            : record(LINK)(r),
    '/projects/doc/tabs/form/form': record({ tabId: 'form', rev: 8, name: 'Bug Report' }),
    '/projects': record({ project: { id: 'new' } }),
    ...extra,
  };
  const client = fakeApi(
    new Proxy(routes, {
      get: (target, key: string) =>
        key in target
          ? target[key]
          : key in fallback
            ? fallback[key]
            : /\/changesets$/.test(key)
              ? record({ changeset: { id: 'cs_0000000001', rev: 1 } })
              : undefined,
      has: (target, key: string) => key in target || key in fallback || /\/changesets$/.test(key),
    }),
  );
  return { client, writes };
}

describe('readForm', () => {
  it('reads the form with its link', async () => {
    const { client } = api(LINK);
    const r = await readForm(client, 'doc');
    expect(r).toMatchObject({
      ok: true,
      reading: { heading: 'Bug Report', state: 'accepting', responses: 4 },
    });
  });

  it('reads the plan, the Form tab and its link, never the other tabs', async () => {
    // The per-token read limit is 120 a minute: a read whose cost grew with the project's tabs ran into it.
    const { client } = api(LINK);
    await readForm(client, 'doc');
    expect([...client.calls].sort()).toEqual([
      '/projects/doc/plan',
      '/projects/doc/tabs/form',
      '/projects/doc/tabs/form/form-link',
    ]);
  });
});

describe('addForm', () => {
  it('writes the card type, then the Form tab, then its new board, in that order', async () => {
    const { client, writes } = api();
    const r = await addForm(
      client,
      {
        projectId: 'doc',
        name: 'Lunch Order',
        questions: [{ type: 'single', prompt: 'Main', options: ['Soup', 'Salad'], goesTo: 'Main' }],
        respondsTo: { to: 'board' },
      },
      'mcp',
    );
    expect(r.ok).toBe(true);
    expect(writes.map((w) => `${w.method} ${w.path.replace(/tabs\/[^/]+/, 'tabs/:id')}`)).toEqual([
      'PUT /projects/doc/item-types',
      'POST /projects/doc/tabs/:id/changesets',
      'POST /projects/doc/tabs/:id/changesets',
    ]);
    type Body = {
      expectedRev?: number;
      replace?: { form?: { heading: string }; kind?: string; name?: string };
    };
    const [types, formTab, board] = writes.map((w) => w.body as Body);
    expect(types!.expectedRev).toBe(3);
    expect(formTab!.replace!.form!.heading).toBe('Lunch Order');
    expect(board!.replace).toMatchObject({ kind: 'board', name: 'Lunch Order Responses' });
    expect(r.ok && r.reading.respondsTo).toEqual({
      to: 'board',
      board: 'Lunch Order Responses',
      cardType: 'Lunch Order',
      column: 'New',
    });
  });

  it('makes a project of its own in one request when none is named', async () => {
    const { client, writes } = api();
    const r = await addForm(client, { starter: 'rsvp', name: 'Summer Party' }, 'cli');
    expect(r.ok).toBe(true);
    expect(writes).toHaveLength(1);
    const body = writes[0]!.body as {
      name: string;
      source: string;
      tabs: { kind: string; name: string }[];
    };
    expect(body).toMatchObject({ name: 'Summer Party', source: 'cli' });
    expect(body.tabs.map((t) => [t.kind, t.name])).toEqual([
      ['form', 'Summer Party'],
      ['sheet', 'Summer Party Responses'],
    ]);
  });

  it('refuses before writing anything', async () => {
    const { client, writes } = api();
    const r = await addForm(
      client,
      { projectId: 'doc', questions: [{ type: 'short', prompt: '' }] },
      'mcp',
    );
    expect(r).toMatchObject({ ok: false, code: 'prompt_empty' });
    expect(
      await addForm(client, { projectId: 'doc', starter: 'rsvp', questions: [] }, 'mcp'),
    ).toMatchObject({
      code: 'starter_and_questions',
    });
    expect(writes).toEqual([]);
  });
});

describe('changeForm', () => {
  it('writes the form through its route at the revision read', async () => {
    const { client, writes } = api();
    const r = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'set_form', heading: 'Crash Report' }],
      'mcp',
    );
    expect(r.ok && r.reading.heading).toBe('Crash Report');
    expect(writes).toEqual([
      {
        method: 'POST',
        path: '/projects/doc/tabs/form/form',
        body: expect.objectContaining({ rev: 7 }),
      },
    ]);
  });

  it('writes a new theme with the form, as the tab’s', async () => {
    const { client, writes } = api();
    await changeForm(client, 'doc', undefined, [{ op: 'set_form', theme: 'forest' }], 'mcp');
    expect(writes[0]!.body).toMatchObject({ theme: 'forest', rev: 7 });
  });

  it('keeps a live form locked but for its settings, writing nothing', async () => {
    const { client, writes } = api(LINK);
    const locked = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'delete_question', question: 'Summary' }],
      'mcp',
    );
    expect(locked).toMatchObject({ ok: false, code: 'form_locked' });
    expect(writes).toEqual([]);
    const settings = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'settings', limit: 20 }],
      'mcp',
    );
    expect(settings.ok).toBe(true);
  });

  it('reads the api’s refusal in agents’ words', async () => {
    const { client } = api(null, {
      '/projects/doc/tabs/form/form': () =>
        Response.json({ error: 'form_changed', rev: 9 }, { status: 409 }),
    });
    const r = await changeForm(client, 'doc', undefined, [{ op: 'settings', limit: 20 }], 'mcp');
    expect(r).toMatchObject({ ok: false, code: 'form_changed' });
    expect(!r.ok && r.message).toContain('read_form again');
  });
});

describe('shareForm', () => {
  it('publishes a form with no link, and closes and deletes one it has', async () => {
    const fresh = api();
    expect(await shareForm(fresh.client, 'doc', undefined, 'publish')).toMatchObject({ ok: true });
    expect(fresh.writes.map((w) => w.method)).toEqual(['POST']);
    const live = api(LINK);
    await shareForm(live.client, 'doc', undefined, 'close');
    await shareForm(live.client, 'doc', undefined, 'delete_link');
    expect(live.writes.map((w) => [w.method, w.body])).toEqual([
      ['PUT', { open: false }],
      ['DELETE', null],
    ]);
  });

  it('refuses to publish a form with problems, naming them', async () => {
    const empty = formTabBody({
      v: 1,
      heading: 'Empty',
      sections: [{ id: 's', title: '', questions: [] }],
    });
    const { client, writes } = api(null, { '/projects/doc/tabs/form': { tab: empty } });
    const r = await shareForm(client, 'doc', undefined, 'publish');
    expect(r).toMatchObject({ ok: false, code: 'form_not_ready' });
    expect(!r.ok && r.message).toContain('Add a question');
    expect(writes).toEqual([]);
  });
});

describe('a sheet form’s sheet', () => {
  it('gains a column for a question the form adds, after its last header, never over one', async () => {
    const sheetForm = { ...bugForm(), sheet: { tabId: 'budget', sheetId: 'sheet_budget' } };
    const server = sheetServer('doc', [
      sheetJson({ id: 'sheet_budget', tabId: 'budget', title: 'Budget' }, [
        ['#', 'Submitted', 'Summary'],
        [1, '2026-10-15 14:03 UTC', 'It broke'],
      ]),
    ]);
    const { client } = api(
      null,
      {
        '/projects/doc/tabs/form': { tab: formTabBody(sheetForm) },
        '/projects/doc/tabs/budget': {
          tab: { id: 'budget', kind: 'sheet', elements: [], rev: 1 },
        },
      },
      server.routes,
    );
    const r = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'add_question', question: { type: 'email', prompt: 'Email' } }],
      'mcp',
    );
    expect(r.ok).toBe(true);
    expect(r.ok && r.lines.at(-1)).toBe(
      'added the sheet\'s columns "Severity", "Can we contact you?", "Email"',
    );
    const cells = server.writes.flatMap((w) => ('cells' in w.write ? w.write.cells : []));
    expect(cells.flatMap((c) => (c?.i && 's' in c.i ? [c.i.s] : []))).toEqual([
      'Severity',
      'Can we contact you?',
      'Email',
    ]);
  });

  it('is not read when no question is new to it', async () => {
    const sheetForm = { ...bugForm(), sheet: { tabId: 'budget', sheetId: 'sheet_budget' } };
    const { client } = api(null, { '/projects/doc/tabs/form': { tab: formTabBody(sheetForm) } });
    await changeForm(client, 'doc', undefined, [{ op: 'settings', limit: 10 }], 'mcp');
    expect(client.calls.some((c) => c.includes('/sheets'))).toBe(false);
  });
});

describe('the calls’ every path', () => {
  const triage = () => ({
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 900,
    height: 500,
    planBoard: { ...presetSetup('bug-triage'), addTypes: ['bug'] },
  });
  const boardRoutes = {
    '/projects/doc/items': { items: [], rev: 0 },
    '/projects/doc/tabs/bugs': {
      tab: { id: 'bugs', name: 'Bugs', kind: 'board', rev: 4, elements: [triage()] },
    },
  };

  it('refuses a project with no such Form tab, and a Form tab with no form', async () => {
    expect(await readForm(api().client, 'doc', 'Nope')).toMatchObject({
      ok: false,
      code: 'form_tab_unknown',
    });
    const empty = api(null, {
      '/projects/doc/tabs/form': {
        tab: { id: 'form', name: 'Bug Report', kind: 'form', elements: [], rev: 1 },
      },
    });
    expect(await readForm(empty.client, 'doc')).toMatchObject({
      ok: false,
      code: 'not_a_form_tab',
    });
    expect(
      await changeForm(empty.client, 'doc', 'Nope', [{ op: 'settings', limit: 1 }], 'mcp'),
    ).toMatchObject({ ok: false });
    expect(await shareForm(empty.client, 'doc', 'Nope', 'close')).toMatchObject({ ok: false });
  });

  it('lets an api failure past the refusals throw', async () => {
    const down = api(null, { '/projects/doc/plan': () => new Response('boom', { status: 500 }) });
    await expect(readForm(down.client, 'doc')).rejects.toThrow();
  });

  it('refuses too many changes, an unknown action, and a starter it does not have', async () => {
    const { client } = api();
    const many = Array.from({ length: 51 }, () => ({ op: 'settings' as const, limit: 1 }));
    expect(await changeForm(client, 'doc', undefined, many, 'mcp')).toMatchObject({
      code: 'too_many_changes',
    });
    expect(await changeForm(client, 'doc', undefined, [], 'mcp')).toMatchObject({ ok: true });
    expect(await shareForm(client, 'doc', undefined, 'open' as never)).toMatchObject({
      code: 'action_unknown',
    });
    expect(
      await addForm(client, { projectId: 'doc', starter: 'nope' as never }, 'mcp'),
    ).toMatchObject({ code: 'starter_unknown' });
    expect(
      await changeForm(
        client,
        'doc',
        undefined,
        [{ op: 'delete_question', question: 'Nope' }],
        'mcp',
      ),
    ).toMatchObject({ ok: false });
  });

  it('builds again from a fresh read when another change to the card types landed first', async () => {
    let tries = 0;
    const { client, writes } = api(null, {
      '/projects/doc/item-types': () => {
        tries += 1;
        return tries === 1
          ? Response.json({ error: 'item_types_stale' }, { status: 409 })
          : Response.json({ ok: true });
      },
    });
    const r = await addForm(
      client,
      { projectId: 'doc', name: 'Lunch', questions: [{ type: 'short', prompt: 'Main' }] },
      'mcp',
    );
    expect(r.ok).toBe(true);
    expect(tries).toBe(2);
    const again = await changeForm(
      client,
      'doc',
      undefined,
      [
        {
          op: 'add_question',
          question: { type: 'single', prompt: 'Size', options: ['S'], goesTo: 'Size' },
        },
      ],
      'mcp',
    );
    expect(again.ok).toBe(true);
    expect(writes.some((w) => w.path.endsWith('/form'))).toBe(true);
  });

  it('refuses a card types save the api refuses', async () => {
    const { client } = api(null, {
      '/projects/doc/item-types': () =>
        Response.json({ error: 'item_types_invalid' }, { status: 400 }),
    });
    const r = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'add_question', question: { type: 'short', prompt: 'X', goesTo: 'Xtra' } }],
      'mcp',
    );
    expect(r).toMatchObject({ ok: false, code: 'item_types_invalid' });
  });

  it('starts every starter its way: a board starter on a named board, a blank one nowhere', async () => {
    const { client, writes } = api(null, boardRoutes);
    const bug = await addForm(
      client,
      { projectId: 'doc', starter: 'bug-report', respondsTo: { to: 'board', board: 'Bugs' } },
      'mcp',
    );
    expect(bug.ok && bug.reading.respondsTo).toMatchObject({ board: 'Bugs', cardType: 'Bug' });
    const blank = await addForm(
      client,
      { projectId: 'doc', starter: 'blank', theme: 'forest' },
      'mcp',
    );
    expect(blank.ok && blank.reading.respondsTo).toEqual({ to: 'nowhere' });
    const form = writes.at(-1)!.body as { replace: { theme: string } };
    expect(form.replace.theme).toBe('forest');
    const feature = await addForm(
      client,
      {
        projectId: 'doc',
        starter: 'feature-request',
        respondsTo: { to: 'board', board: 'Bugs', cardType: 'Bug' },
      },
      'mcp',
    );
    expect(feature.ok).toBe(true);
    expect(
      await addForm(
        client,
        { projectId: 'doc', starter: 'contact', respondsTo: { to: 'board', board: 'Nope' } },
        'mcp',
      ),
    ).toMatchObject({ code: 'board_unknown' });
  });

  it('gives the board a new card type, saying so, or says when it could not', async () => {
    const ok = api(null, boardRoutes);
    const r = await addForm(
      ok.client,
      {
        projectId: 'doc',
        name: 'RSVP',
        questions: [{ type: 'short', prompt: 'Name' }],
        respondsTo: { to: 'board', board: 'Bugs', cardType: 'Task' },
      },
      'mcp',
    );
    expect(r.ok && r.made.at(-1)).toBe(`"Bugs" now takes the form's card type`);
    const failing = api();
    const f = await addForm(
      failing.client,
      {
        projectId: 'doc',
        name: 'RSVP',
        questions: [{ type: 'short', prompt: 'Name' }],
        respondsTo: { to: 'board', board: 'Bugs', cardType: 'Task' },
      },
      'mcp',
    );
    expect(f.ok && f.made.at(-1)).toMatch(/could not take the form's card type/);
  });

  it('builds from sections: the first one’s words, later ones with rules, and settings', async () => {
    const { client } = api();
    const r = await addForm(
      client,
      {
        projectId: 'doc',
        name: 'Hiring',
        description: 'Apply here',
        sections: [
          {
            title: 'About You',
            description: 'Who you are',
            questions: [{ type: 'single', prompt: 'Right to work?', options: ['Yes', 'No'] }],
          },
          {
            title: 'Visa',
            description: 'If not',
            showIf: { question: 'Right to work?', anyOf: ['No'] },
            questions: [{ type: 'paragraph', prompt: 'Which visa?' }],
          },
          { questions: [] },
        ],
        settings: { limit: 50 },
      },
      'mcp',
    );
    expect(r.ok && r.lines).toEqual(
      expect.arrayContaining([
        'the first page shows the form\'s heading ("Hiring"), not its own title "About You"',
        "the first page shows the form's description, not its own description",
      ]),
    );
    expect(r.ok && r.reading.sections.map((s) => s.title ?? '')).toEqual(['', 'Visa', '']);
    expect(r.ok && r.reading.settings.limit).toBe(50);
    const firstOnly = await addForm(
      client,
      {
        projectId: 'doc',
        sections: [{ description: 'Hello', questions: [{ type: 'short', prompt: 'Q' }] }],
      },
      'mcp',
    );
    expect(firstOnly.ok && firstOnly.reading.description).toBe('Hello');
    const afterQuestions = await addForm(
      client,
      {
        projectId: 'doc',
        questions: [{ type: 'short', prompt: 'Q' }],
        sections: [{ questions: [{ type: 'short', prompt: 'R' }] }],
      },
      'mcp',
    );
    expect(afterQuestions.ok && afterQuestions.reading.sections).toHaveLength(2);
  });

  it('refuses a section, question, rule or setting that does not hold, writing nothing', async () => {
    const { client, writes } = api();
    const bad = [
      { sections: [{ questions: [] }, { title: 'x'.repeat(81), questions: [] }] },
      { sections: [{ questions: [] }, { questions: [{ type: 'short' as const, prompt: '' }] }] },
      {
        sections: [
          { questions: [] },
          { showIf: { question: 'Nope', anyOf: ['x'] }, questions: [] },
        ],
      },
      { questions: [{ type: 'short' as const, prompt: '' }] },
      { questions: [{ type: 'short' as const, prompt: 'Q' }], settings: { limit: 0 } },
      {
        questions: [{ type: 'short' as const, prompt: 'Q' }],
        respondsTo: { to: 'sheet' as const, sheet: 'Nope' },
      },
    ];
    for (const input of bad)
      expect(await addForm(client, { projectId: 'doc', ...input }, 'mcp')).toMatchObject({
        ok: false,
      });
    expect(writes).toEqual([]);
  });

  it('makes a new project with no card types to bring when its form needs none', async () => {
    const { client, writes } = api();
    const r = await addForm(client, { name: 'Blank', starter: 'blank' }, 'mcp');
    expect(r.ok).toBe(true);
    expect(writes[0]!.body).not.toHaveProperty('itemTypes');
  });

  it('writes a new responses sheet as a Sheet tab, its theme the form’s, and gives it its headers', async () => {
    const server = sheetServer('doc', []);
    const { client, writes } = api(null, {}, server.routes);
    const r = await changeForm(
      client,
      'doc',
      undefined,
      [
        { op: 'set_form', theme: 'ocean' },
        { op: 'responds_to', to: 'sheet' },
      ],
      'mcp',
    );
    expect(r.ok).toBe(true);
    const tab = writes.find(
      (w) => (w.body as { replace?: { kind?: string } }).replace?.kind === 'sheet',
    );
    expect(tab).toBeDefined();
    expect(r.ok && r.made.at(-1)).toBe('its header row is written by the first response');
  });

  it('opens a closed form again and says when one already takes responses', async () => {
    const closed = api({ ...LINK, link: { ...LINK.link!, open: false } });
    expect(
      (await shareForm(closed.client, 'doc', undefined, 'publish')).ok && closed.writes[0]!.body,
    ).toEqual({ open: true });
    const open = api(LINK);
    const r = await shareForm(open.client, 'doc', undefined, 'publish');
    expect(r.ok && r.lines).toEqual(['already taking responses']);
    const none = api();
    expect(await shareForm(none.client, 'doc', undefined, 'close')).toMatchObject({
      code: 'form_not_published',
    });
    expect(await shareForm(none.client, 'doc', undefined, 'delete_link')).toMatchObject({
      code: 'form_not_published',
    });
  });

  it('refuses a publish the api refuses, in its words', async () => {
    const { client } = api(null, {
      '/projects/doc/tabs/form/form-link': (r: Request) =>
        r.method === 'GET'
          ? Response.json({
              link: null,
              responses: 0,
              unseen: 0,
              suspendedAt: null,
              canPublish: true,
            })
          : Response.json({ error: 'form_suspensions' }, { status: 403 }),
    });
    const r = await shareForm(client, 'doc', undefined, 'publish');
    expect(r).toMatchObject({ ok: false, code: 'form_suspensions' });
  });
});

describe('the last paths', () => {
  const sheetForm = { ...bugForm(), sheet: { tabId: 'budget', sheetId: 'sheet_budget' } };
  const routesFor = (form = sheetForm) => ({
    '/projects/doc/tabs/form': { tab: formTabBody(form) },
    '/projects/doc/tabs/budget': { tab: { id: 'budget', kind: 'sheet', elements: [], rev: 1 } },
  });

  it('adds one column, said as one, and nothing to a sheet that has every header', async () => {
    const server = sheetServer('doc', [
      sheetJson({ id: 'sheet_budget', tabId: 'budget', title: 'Budget' }, [
        ['#', 'Submitted', 'Summary', 'Severity', 'Can we contact you?'],
      ]),
    ]);
    const { client } = api(null, routesFor(), server.routes);
    const one = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'add_question', question: { type: 'email', prompt: 'Email' } }],
      'mcp',
    );
    expect(one.ok && one.lines.at(-1)).toBe('added the sheet\'s column "Email"');
    const writes = server.writes.length;
    const none = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'responds_to', to: 'sheet', sheet: 'Budget' }],
      'mcp',
    );
    expect(none.ok).toBe(true);
    expect(server.writes.length).toBe(writes);
  });

  it('says the first response writes the columns when the sheet cannot be written', async () => {
    const { client } = api(null, routesFor(), sheetServer('doc', []).routes);
    const r = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'add_question', question: { type: 'email', prompt: 'Email' } }],
      'mcp',
    );
    expect(r.ok && r.made).toEqual(["the sheet's new columns are written by the first response"]);
  });

  it('keeps a first section’s description that matches the form’s, and a new project’s card types', async () => {
    const { client, writes } = api();
    const same = await addForm(
      client,
      {
        projectId: 'doc',
        description: 'Hi',
        sections: [{ description: 'Hi', questions: [{ type: 'short', prompt: 'Q' }] }],
      },
      'mcp',
    );
    expect(same.ok && same.lines.some((l) => l.includes('its own description'))).toBe(false);
    await addForm(client, { name: 'Lunch', questions: [{ type: 'short', prompt: 'Main' }] }, 'mcp');
    expect(writes.at(-1)!.body).toHaveProperty('itemTypes');
  });

  it('builds a change again when the card types moved first', async () => {
    let tries = 0;
    const { client } = api(null, {
      '/projects/doc/item-types': () => {
        tries += 1;
        return tries === 1
          ? Response.json({ error: 'item_types_stale' }, { status: 409 })
          : Response.json({ ok: true });
      },
    });
    const r = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'add_question', question: { type: 'short', prompt: 'X', goesTo: 'Xtra' } }],
      'mcp',
    );
    expect(r.ok).toBe(true);
    expect(tries).toBe(2);
  });
});

describe('a sheet the form makes or switches to', () => {
  it('heads a new sheet, with no line said, and reads one that already has every header as done', async () => {
    const server = sheetServer('doc', [
      sheetJson({ id: 'sheet_budget', tabId: 'budget', title: 'Budget' }, [
        ['#', 'Submitted', 'Summary', 'Severity', 'Can we contact you?'],
      ]),
    ]);
    // A Sheet tab's changeset makes its sheet, as the api does for a marked Sheet element.
    const newTab = /^\/projects\/doc\/tabs\/[0-9a-f-]{36}$/;
    const routes = new Proxy(server.routes, {
      has: (t, k: string) => k in t || k.endsWith('/changesets') || newTab.test(k),
      get: (t, k: string) =>
        newTab.test(k)
          ? { tab: { id: k.split('/')[4], kind: 'sheet', elements: [], rev: 1 } }
          : k.endsWith('/changesets')
            ? async (r: Request) => {
                const body = (await r.json()) as {
                  replace?: { kind?: string; elements?: { planSheet?: { sheetId: string } }[] };
                };
                const sheetId = body.replace?.elements?.[0]?.planSheet?.sheetId;
                if (body.replace?.kind === 'sheet' && sheetId)
                  server.sheets.push(
                    sheetJson({ id: sheetId, tabId: k.split('/')[4]!, title: 'Sheet 1' }),
                  );
                return Response.json({ changeset: { id: 'cs_0000000002', rev: 1 } });
              }
            : t[k],
    });
    const { client } = api(
      null,
      {
        '/projects/doc/tabs/budget': {
          tab: { id: 'budget', kind: 'sheet', elements: [], rev: 1 },
        },
      },
      routes,
    );
    const made = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'responds_to', to: 'sheet' }],
      'mcp',
    );
    expect(made.ok && made.made).toHaveLength(1);
    expect(server.sheets.at(-1)!.title).toBe('Bug Report Responses');
    const before = server.writes.length;
    const switched = await changeForm(
      client,
      'doc',
      undefined,
      [{ op: 'responds_to', to: 'sheet', sheet: 'Budget' }],
      'mcp',
    );
    expect(switched.ok).toBe(true);
    expect(server.writes.length).toBe(before);
  });
});
