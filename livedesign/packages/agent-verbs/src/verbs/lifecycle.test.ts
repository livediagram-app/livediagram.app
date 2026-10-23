import { describe, expect, it } from 'vitest';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import {
  designCreate,
  designRename,
  designRestore,
  designRm,
  designShare,
  tabAdd,
  tabRename,
  tabRm,
} from './lifecycle';

// Records each request's method, path and body, answering from `answer`.
function recorder(answer: (path: string, method: string, body: unknown) => Response | undefined) {
  const seen: { method: string; path: string; body: unknown }[] = [];
  const route = async (request: Request) => {
    const url = new URL(request.url);
    const path = `${url.pathname.replace(/^\/api/, '')}${url.search}`;
    const text = await request.text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    seen.push({ method: request.method, path, body });
    return answer(path, request.method, body) ?? new Response(null, { status: 204 });
  };
  return { seen, route };
}

const written = (text: string) => ({
  dryRun: false,
  changeset: { id: 'cs_1', tabId: 'x', rev: 1, previousRev: 0, rebasedOver: 0 },
  results: [],
  text,
  warnings: [],
  lint: null,
});

describe('design create', () => {
  it("creates one tab from a file, a template or nothing, marked as the CLI's", async () => {
    const { seen, route } = recorder((_, __, body) => {
      const b = body as { id: string; name: string; tabs: unknown[] };
      return Response.json({ design: { id: b.id, name: b.name, tabs: b.tabs } }, { status: 201 });
    });
    const files: Record<string, string> = {
      'a.json': '[{"id":"a","type":"text"}]',
      'r.json': '{"replace":{"elements":[],"theme":"ocean"}}',
    };
    const ctx = contextOf(fakeApi({ '/designs': route }), [], [], {
      readInput: async (p) => files[p]!,
    });
    const out = await designCreate.run!(ctx, { name: 'Shop', file: 'a.json' });
    await designCreate.run!(ctx, { name: 'Retro', tab: 'Board', template: 'logo-design' });
    await designCreate.run!(ctx, { name: 'Blank' });
    await designCreate.run!(ctx, { name: 'R', file: 'r.json' });
    expect(seen.map((s) => s.body)).toEqual([
      {
        id: 'new-1',
        name: 'Shop',
        source: 'cli',
        tabs: [{ id: 'new-2', name: 'Shop', elements: [{ id: 'a', type: 'text' }] }],
      },
      {
        id: 'new-3',
        name: 'Retro',
        source: 'cli',
        tabs: [{ id: 'new-4', name: 'Board', template: 'logo-design' }],
      },
      {
        id: 'new-5',
        name: 'Blank',
        source: 'cli',
        tabs: [{ id: 'new-6', name: 'Blank', elements: [] }],
      },
      {
        id: 'new-7',
        name: 'R',
        source: 'cli',
        tabs: [{ id: 'new-8', name: 'R', elements: [] }],
      },
    ]);
    expect(designCreate.text!(out)).toEqual([
      '+ design new-1 "Shop" · 1 tab · https://livedesign.app/design/new-1',
    ]);
    expect(designCreate.quiet!(out)).toEqual(['new-1']);
  });

  it('says how many tabs landed', async () => {
    const api = fakeApi({
      '/designs': () =>
        Response.json(
          { design: { id: 'abcdef1234', name: 'X', tabs: [{}, {}] } },
          { status: 201 },
        ),
    });
    expect((await designCreate.run!(contextOf(api), { name: 'X' })).text).toBe(
      '+ design abcdef12 "X" · 2 tabs · https://livedesign.app/design/abcdef1234',
    );
  });

  it('refuses edit operations, an unknown file, and both a file and a template', async () => {
    const files: Record<string, string> = { 'ops.txt': 'rm n1', 'x.json': '{"a":1}' };
    const ctx = contextOf(fakeApi({}), [], [], { readInput: async (p) => files[p]! });
    expect(
      await designCreate.run!(ctx, { name: 'S', file: 'ops.txt' }).catch((e: unknown) => e),
    ).toMatchObject({
      status: 400,
      message: 'ops.txt holds edit operations, which change a tab that exists',
    });
    expect(
      await designCreate.run!(ctx, { name: 'S', file: '-' }).catch((e: unknown) => e),
    ).toBeDefined();
    expect(
      await designCreate.run!(ctx, { name: 'S', file: 'x.json' }).catch((e: unknown) => e),
    ).toMatchObject({ code: 'unknown_source', message: "can't tell what x.json holds" });
    expect(
      await designCreate.run!(ctx, { name: 'S', file: 'x.json', template: 'logo-design' }).catch(
        (e: unknown) => e,
      ),
    ).toMatchObject({ message: 'give -f or --template, not both' });
    const stdin = contextOf(fakeApi({}), [], [], { readInput: async () => 'rm n1' });
    expect(
      await designCreate.run!(stdin, { name: 'S', file: '-' }).catch((e: unknown) => e),
    ).toMatchObject({ message: 'stdin holds edit operations, which change a tab that exists' });
  });
});

describe('design rename, share, rm and restore', () => {
  const docRoutes = (answer: Parameters<typeof recorder>[0]) => {
    const r = recorder(answer);
    return {
      ...r,
      api: fakeApi({
        ...library,
        [`/designs/${DOC_A}`]: (req: Request) =>
          req.method === 'GET' ? Response.json(tabsOfA[`/designs/${DOC_A}`]) : r.route(req),
        [`/designs/${DOC_A}/share`]: r.route,
        '/trash': r.route,
        [`/trash/${DOC_A}/restore`]: r.route,
        '/trash/cccc0000-0000/restore': r.route,
      }),
    };
  };

  it('renames through the design route', async () => {
    const { seen, api } = docRoutes(() => Response.json({ design: { name: 'Sign-in' } }));
    const out = await designRename.run!(contextOf(api), { doc: 'Auth flow', name: 'Sign-in' });
    expect(seen).toEqual([
      { method: 'PUT', path: `/designs/${DOC_A}`, body: { name: 'Sign-in' } },
    ]);
    expect(designRename.text!(out)).toEqual(['~ design aaaa1111 "Auth flow"→"Sign-in"']);
    expect(designRename.quiet!(out)).toEqual([DOC_A]);
  });

  it("makes a share link on the profile's host", async () => {
    const { seen, api } = docRoutes(() =>
      Response.json({ link: { code: 'abc', role: 'edit', expiresAt: null } }),
    );
    const out = await designShare.run!(
      contextOf(api),
      designShare.input.parse({ doc: 'Auth flow', role: 'edit' }),
    );
    expect(seen[0]).toMatchObject({ method: 'POST', body: { role: 'edit', expiry: 'never' } });
    expect(out).toEqual({
      text: 'https://livedesign.app/design/shared?s=abc',
      url: 'https://livedesign.app/design/shared?s=abc',
      role: 'edit',
      expiresAt: null,
    });
    expect(designShare.text!(out)).toEqual([out.url]);
    expect(designShare.quiet!(out)).toEqual([out.url]);
  });

  it('moves a design to the Trash, naming how to restore it; a refusal throws', async () => {
    const { seen, api } = docRoutes(() => undefined);
    const out = await designRm.run!(contextOf(api), { doc: 'Auth flow' });
    expect(seen).toEqual([{ method: 'DELETE', path: `/designs/${DOC_A}`, body: undefined }]);
    expect(out.text).toBe(
      `- design aaaa1111 "Auth flow" · in the Trash for 30 days · restore: livedesign design restore ${DOC_A}`,
    );
    const refused = docRoutes(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    await expect(
      designRm.run!(contextOf(refused.api), { doc: 'Auth flow' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('restores from the Trash by name, id or prefix, refusing none and several', async () => {
    const trash = [
      { id: DOC_A, name: 'Old', teamId: null, teamName: null },
      { id: 'aaaa9999-0000', name: 'Old', teamId: 't', teamName: 'Design' },
      { id: 'cccc0000-0000', name: 'Other', teamId: null, teamName: null },
    ];
    const { seen, api } = docRoutes((path) =>
      path === '/trash' ? Response.json({ trash }) : Response.json({ design: {} }),
    );
    expect((await designRestore.run!(contextOf(api), { doc: 'cccc' })).text).toBe(
      '+ design cccc0000 "Other" restored',
    );
    expect(seen.at(-1)).toMatchObject({ method: 'POST', path: '/trash/cccc0000-0000/restore' });
    expect((await designRestore.run!(contextOf(api), { doc: DOC_A })).id).toBe(DOC_A);
    expect(
      await designRestore.run!(contextOf(api), { doc: 'old' }).catch((e: unknown) => e),
    ).toMatchObject({
      status: 404,
      code: 'ambiguous',
      lines: ['aaaa1  "Old"  personal', 'aaaa9  "Old"  Design'],
    });
    expect(
      await designRestore.run!(contextOf(api), { doc: 'nope' }).catch((e: unknown) => e),
    ).toMatchObject({ code: 'not_found', message: 'nothing in the Trash matches "nope"' });
    expect(designRestore.quiet!({ id: 'x', text: '' })).toEqual(['x']);
  });
});

describe('tab add, rename and rm', () => {
  it('adds a tab as a replace changeset on a new id, based on revision 0', async () => {
    const { seen, route } = recorder(() =>
      Response.json(
        written(
          `+ n1  square "A"\nrev 0→1 · cs_1 · lint clean · revert: livedesign changeset revert ${DOC_A} cs_1`,
        ),
      ),
    );
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/designs/${DOC_A}/tabs/new-1/changesets`]: route,
    });
    const out = await tabAdd.run!(
      contextOf(api),
      tabAdd.input.parse({
        doc: 'Auth flow',
        name: 'Board',
        template: 'logo-design',
        summary: 'Board',
      }),
    );
    expect(seen[0]!.body).toEqual({
      replace: { template: 'logo-design', name: 'Board' },
      base: { rev: 0 },
      summary: 'Board',
    });
    // Named first, and undone by tab rm: a revert would take its elements and leave the tab.
    expect(tabAdd.text!(out)).toEqual([
      `+ tab new-1 "Board"\n+ n1  square "A"\nrev 0→1 · cs_1 · lint clean · undo: livedesign tab rm ${DOC_A} new-1`,
    ]);
    expect(tabAdd.quiet!(out)).toEqual(['cs_1']);
    expect(tabAdd.quiet!({ ...out, changeset: null })).toEqual([]);
  });

  it('renames through the name route and deletes through the tab route', async () => {
    const { seen, route } = recorder((_, method) =>
      method === 'PUT' ? Response.json({ tab: { name: 'Summary' } }) : undefined,
    );
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/designs/${DOC_A}/tabs/tab-one-0000/name`]: route,
      [`/designs/${DOC_A}/tabs/tab-two-0000`]: route,
    });
    const renamed = await tabRename.run!(contextOf(api), {
      doc: 'Auth flow',
      tab: 'Overview',
      name: 'Summary',
    });
    expect(tabRename.text!(renamed)).toEqual(['~ tab tab-one-0000 "Overview"→"Summary"']);
    const removed = await tabRm.run!(contextOf(api), { doc: 'Auth flow', tab: 'Details' });
    expect(tabRm.text!(removed)).toEqual(['- tab tab-two-0000 "Details"']);
    expect(tabRm.quiet!(removed)).toEqual(['tab-two-0000']);
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual([
      `PUT /designs/${DOC_A}/tabs/tab-one-0000/name`,
      `DELETE /designs/${DOC_A}/tabs/tab-two-0000`,
    ]);
  });
});
