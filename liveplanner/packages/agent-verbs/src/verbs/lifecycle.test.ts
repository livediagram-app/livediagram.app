import { describe, expect, it } from 'vitest';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import {
  projectCreate,
  projectRename,
  projectRestore,
  projectRm,
  projectShare,
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
});

describe('project create', () => {
  it("creates one tab from a file, a template or nothing, marked as the CLI's", async () => {
    const { seen, route } = recorder((_, __, body) => {
      const b = body as { id: string; name: string; tabs: unknown[] };
      return Response.json({ project: { id: b.id, name: b.name, tabs: b.tabs } }, { status: 201 });
    });
    const files: Record<string, string> = {
      'a.json': '[]',
      'r.json': '{"replace":{"template":"swot","theme":"ocean"}}',
    };
    const ctx = contextOf(fakeApi({ '/projects': route }), [], [], {
      readInput: async (p) => files[p]!,
    });
    const out = await projectCreate.run!(ctx, { name: 'Shop', file: 'a.json' });
    await projectCreate.run!(ctx, { name: 'Retro', tab: 'Board', template: 'kanban' });
    await projectCreate.run!(ctx, { name: 'Blank' });
    await projectCreate.run!(ctx, { name: 'R', file: 'r.json' });
    expect(seen.map((s) => s.body)).toEqual([
      {
        id: 'new-1',
        name: 'Shop',
        source: 'cli',
        tabs: [{ id: 'new-2', name: 'Shop', elements: [] }],
      },
      {
        id: 'new-3',
        name: 'Retro',
        source: 'cli',
        tabs: [{ id: 'new-4', name: 'Board', template: 'kanban' }],
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
        tabs: [{ id: 'new-8', name: 'R', template: 'swot' }],
      },
    ]);
    expect(projectCreate.text!(out)).toEqual([
      '+ project new-1 "Shop" · 1 tab · https://liveplanner.app/project/new-1',
    ]);
    expect(projectCreate.quiet!(out)).toEqual(['new-1']);
  });

  it('says how many tabs landed', async () => {
    const api = fakeApi({
      '/projects': () =>
        Response.json(
          { project: { id: 'abcdef1234', name: 'X', tabs: [{}, {}] } },
          { status: 201 },
        ),
    });
    expect((await projectCreate.run!(contextOf(api), { name: 'X' })).text).toBe(
      '+ project abcdef12 "X" · 2 tabs · https://liveplanner.app/project/abcdef1234',
    );
  });

  it('refuses edit operations, an unknown file, and both a file and a template', async () => {
    const files: Record<string, string> = { 'ops.txt': 'rm n1', 'x.json': '{"a":1}' };
    const ctx = contextOf(fakeApi({}), [], [], { readInput: async (p) => files[p]! });
    expect(
      await projectCreate.run!(ctx, { name: 'S', file: 'ops.txt' }).catch((e: unknown) => e),
    ).toMatchObject({
      status: 400,
      message: 'ops.txt holds edit operations, which change a tab that exists',
    });
    expect(
      await projectCreate.run!(ctx, { name: 'S', file: '-' }).catch((e: unknown) => e),
    ).toBeDefined();
    expect(
      await projectCreate.run!(ctx, { name: 'S', file: 'x.json' }).catch((e: unknown) => e),
    ).toMatchObject({ code: 'unknown_source', message: "can't tell what x.json holds" });
    expect(
      await projectCreate.run!(ctx, { name: 'S', file: 'x.json', template: 'kanban' }).catch(
        (e: unknown) => e,
      ),
    ).toMatchObject({ message: 'give -f or --template, not both' });
    const stdin = contextOf(fakeApi({}), [], [], { readInput: async () => 'rm n1' });
    expect(
      await projectCreate.run!(stdin, { name: 'S', file: '-' }).catch((e: unknown) => e),
    ).toMatchObject({ message: 'stdin holds edit operations, which change a tab that exists' });
  });
});

describe('project rename, share, rm and restore', () => {
  const docRoutes = (answer: Parameters<typeof recorder>[0]) => {
    const r = recorder(answer);
    return {
      ...r,
      api: fakeApi({
        ...library,
        [`/projects/${DOC_A}`]: (req: Request) =>
          req.method === 'GET' ? Response.json(tabsOfA[`/projects/${DOC_A}`]) : r.route(req),
        [`/projects/${DOC_A}/share`]: r.route,
        '/trash': r.route,
        [`/trash/${DOC_A}/restore`]: r.route,
        '/trash/cccc0000-0000/restore': r.route,
      }),
    };
  };

  it('renames through the project route', async () => {
    const { seen, api } = docRoutes(() => Response.json({ project: { name: 'Sign-in' } }));
    const out = await projectRename.run!(contextOf(api), { project: 'Auth flow', name: 'Sign-in' });
    expect(seen).toEqual([
      { method: 'PUT', path: `/projects/${DOC_A}`, body: { name: 'Sign-in' } },
    ]);
    expect(projectRename.text!(out)).toEqual(['~ project aaaa1111 "Auth flow"→"Sign-in"']);
    expect(projectRename.quiet!(out)).toEqual([DOC_A]);
  });

  it("makes a share link on the profile's host", async () => {
    const { seen, api } = docRoutes(() =>
      Response.json({ link: { code: 'abc', role: 'edit', expiresAt: null } }),
    );
    const out = await projectShare.run!(
      contextOf(api),
      projectShare.input.parse({ project: 'Auth flow', role: 'edit' }),
    );
    expect(seen[0]).toMatchObject({ method: 'POST', body: { role: 'edit', expiry: 'never' } });
    expect(out).toEqual({
      text: 'https://liveplanner.app/project/shared?s=abc',
      url: 'https://liveplanner.app/project/shared?s=abc',
      role: 'edit',
      expiresAt: null,
    });
    expect(projectShare.text!(out)).toEqual([out.url]);
    expect(projectShare.quiet!(out)).toEqual([out.url]);
  });

  it('moves a project to the Trash, naming how to restore it; a refusal throws', async () => {
    const { seen, api } = docRoutes(() => undefined);
    const out = await projectRm.run!(contextOf(api), { project: 'Auth flow' });
    expect(seen).toEqual([{ method: 'DELETE', path: `/projects/${DOC_A}`, body: undefined }]);
    expect(out.text).toBe(
      `- project aaaa1111 "Auth flow" · in the Trash for 30 days · restore: liveplanner project restore ${DOC_A}`,
    );
    const refused = docRoutes(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    await expect(
      projectRm.run!(contextOf(refused.api), { project: 'Auth flow' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('restores from the Trash by name, id or prefix, refusing none and several', async () => {
    const trash = [
      { id: DOC_A, name: 'Old', teamId: null, teamName: null },
      { id: 'aaaa9999-0000', name: 'Old', teamId: 't', teamName: 'Design' },
      { id: 'cccc0000-0000', name: 'Other', teamId: null, teamName: null },
    ];
    const { seen, api } = docRoutes((path) =>
      path === '/trash' ? Response.json({ trash }) : Response.json({ project: {} }),
    );
    expect((await projectRestore.run!(contextOf(api), { project: 'cccc' })).text).toBe(
      '+ project cccc0000 "Other" restored',
    );
    expect(seen.at(-1)).toMatchObject({ method: 'POST', path: '/trash/cccc0000-0000/restore' });
    expect((await projectRestore.run!(contextOf(api), { project: DOC_A })).id).toBe(DOC_A);
    expect(
      await projectRestore.run!(contextOf(api), { project: 'old' }).catch((e: unknown) => e),
    ).toMatchObject({
      status: 404,
      code: 'ambiguous',
      lines: ['aaaa1  "Old"  personal', 'aaaa9  "Old"  Design'],
    });
    expect(
      await projectRestore.run!(contextOf(api), { project: 'nope' }).catch((e: unknown) => e),
    ).toMatchObject({ code: 'not_found', message: 'nothing in the Trash matches "nope"' });
    expect(projectRestore.quiet!({ id: 'x', text: '' })).toEqual(['x']);
  });
});

describe('tab add, rename and rm', () => {
  it('adds a tab as a replace changeset on a new id, based on revision 0', async () => {
    const { seen, route } = recorder(() =>
      Response.json(
        written(
          `+ n1  square "A"\nrev 0→1 · cs_1 · revert: liveplanner changeset revert ${DOC_A} cs_1`,
        ),
      ),
    );
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`/projects/${DOC_A}/tabs/new-1/changesets`]: route,
    });
    const out = await tabAdd.run!(
      contextOf(api),
      tabAdd.input.parse({
        project: 'Auth flow',
        name: 'Board',
        template: 'kanban',
        summary: 'Board',
      }),
    );
    expect(seen[0]!.body).toEqual({
      replace: { template: 'kanban', name: 'Board' },
      base: { rev: 0 },
      summary: 'Board',
    });
    // Named first, and undone by tab rm: a revert would take its elements and leave the tab.
    expect(tabAdd.text!(out)).toEqual([
      `+ tab new-1 "Board"\n+ n1  square "A"\nrev 0→1 · cs_1 · undo: liveplanner tab rm ${DOC_A} new-1`,
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
      [`/projects/${DOC_A}/tabs/tab-one-0000/name`]: route,
      [`/projects/${DOC_A}/tabs/tab-two-0000`]: route,
    });
    const renamed = await tabRename.run!(contextOf(api), {
      project: 'Auth flow',
      tab: 'Overview',
      name: 'Summary',
    });
    expect(tabRename.text!(renamed)).toEqual(['~ tab tab-one-0000 "Overview"→"Summary"']);
    const removed = await tabRm.run!(contextOf(api), { project: 'Auth flow', tab: 'Details' });
    expect(tabRm.text!(removed)).toEqual(['- tab tab-two-0000 "Details"']);
    expect(tabRm.quiet!(removed)).toEqual(['tab-two-0000']);
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual([
      `PUT /projects/${DOC_A}/tabs/tab-one-0000/name`,
      `DELETE /projects/${DOC_A}/tabs/tab-two-0000`,
    ]);
  });
});
