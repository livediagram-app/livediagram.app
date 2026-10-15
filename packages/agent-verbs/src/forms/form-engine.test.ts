import { describe, expect, it } from 'vitest';
import type { FormLinkResponse } from '@livediagram/api-schema';
import { fakeApi } from '../testing/fake-api';
import { formPlan, formTabBody } from '../testing/forms';
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

function api(link: FormLinkResponse | null = null, extra: Record<string, unknown> = {}) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const record = (answer: unknown) => async (r: Request) => {
    const path = new URL(r.url).pathname.replace(/^\/api/, '');
    if (r.method !== 'GET')
      writes.push({ method: r.method, path, body: await r.json().catch(() => null) });
    return Response.json(answer);
  };
  const routes: Record<string, unknown> = {
    '/documents/doc/plan': formPlan(),
    '/documents/doc/tabs/form': { tab: formTabBody() },
    '/documents/doc/item-types': record({ ok: true }),
    '/documents/doc/tabs/form/form-link': link
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
    '/documents/doc/tabs/form/form': record({ tabId: 'form', rev: 8, name: 'Bug Report' }),
    '/documents': record({ document: { id: 'new' } }),
    ...extra,
  };
  const client = fakeApi(
    new Proxy(routes, {
      get: (target, key: string) =>
        key in target
          ? target[key]
          : /\/changesets$/.test(key)
            ? record({ changeset: { id: 'cs_0000000001', rev: 1 } })
            : undefined,
      has: (target, key: string) => key in target || /\/changesets$/.test(key),
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
    // The per-token read limit is 120 a minute: a read whose cost grew with the document's tabs ran into it.
    const { client } = api(LINK);
    await readForm(client, 'doc');
    expect([...client.calls].sort()).toEqual([
      '/documents/doc/plan',
      '/documents/doc/tabs/form',
      '/documents/doc/tabs/form/form-link',
    ]);
  });
});

describe('addForm', () => {
  it('writes the card type, then the Form tab, then its new board, in that order', async () => {
    const { client, writes } = api();
    const r = await addForm(
      client,
      {
        documentId: 'doc',
        name: 'Lunch Order',
        questions: [{ type: 'single', prompt: 'Main', options: ['Soup', 'Salad'], goesTo: 'Main' }],
        respondsTo: { to: 'board' },
      },
      'mcp',
    );
    expect(r.ok).toBe(true);
    expect(writes.map((w) => `${w.method} ${w.path.replace(/tabs\/[^/]+/, 'tabs/:id')}`)).toEqual([
      'PUT /documents/doc/item-types',
      'POST /documents/doc/tabs/:id/changesets',
      'POST /documents/doc/tabs/:id/changesets',
    ]);
    const [types, formTab, board] = writes.map((w) => w.body as Record<string, any>);
    expect(types!.expectedRev).toBe(3);
    expect(formTab!.replace.form.heading).toBe('Lunch Order');
    expect(board!.replace).toMatchObject({ kind: 'board', name: 'Lunch Order Responses' });
    expect(r.ok && r.reading.respondsTo).toEqual({
      to: 'board',
      board: 'Lunch Order Responses',
      cardType: 'Lunch Order',
      column: 'New',
    });
  });

  it('makes a document of its own in one request when none is named', async () => {
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
      { documentId: 'doc', questions: [{ type: 'short', prompt: '' }] },
      'mcp',
    );
    expect(r).toMatchObject({ ok: false, code: 'prompt_empty' });
    expect(
      await addForm(client, { documentId: 'doc', starter: 'rsvp', questions: [] }, 'mcp'),
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
        path: '/documents/doc/tabs/form/form',
        body: expect.objectContaining({ rev: 7 }),
      },
    ]);
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
      '/documents/doc/tabs/form/form': () =>
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
    const { client, writes } = api(null, { '/documents/doc/tabs/form': { tab: empty } });
    const r = await shareForm(client, 'doc', undefined, 'publish');
    expect(r).toMatchObject({ ok: false, code: 'form_not_ready' });
    expect(!r.ok && r.message).toContain('Add a question');
    expect(writes).toEqual([]);
  });
});
