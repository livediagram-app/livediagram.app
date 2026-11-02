import { describe, expect, it } from 'vitest';
import type { ChangesetRequest } from '@livedesign/api-schema';
import type { DesignComponent } from '@livedesign/design';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { memoryCopies } from '../testing/memory-copies';
import { box, plainTab, tabAnswer } from '../testing/tabs';
import { componentLs, componentMake, componentSet, componentVerbs } from './component';

const DESIGN = `/designs/${DOC_A}`;
const TAB = `${DESIGN}/tabs/tab-one-0000`;
const LIBRARY = `${DESIGN}/components`;
const nav: DesignComponent = {
  id: 'nav',
  name: 'Nav bar',
  width: 120,
  height: 60,
  updatedAt: 1,
  elements: [box('bar', 'Bar')],
};
const written = {
  dryRun: false,
  changeset: { id: 'cs_1', tabId: 'tab-one-0000', rev: 6, previousRev: 5, rebasedOver: 0 },
  results: [],
  text: '+ card  instance\nrev 5→6 · cs_1 · lint clean',
  warnings: [],
  lint: null,
};
const refusal = (run: Promise<unknown>) => run.catch((e: unknown) => e);

describe('component ls', () => {
  it('prints the components view the api renders, or its JSON', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`${DESIGN}?view=components&door=cli`]: { text: 'component nav "Nav bar"' },
      [`${DESIGN}?view=components&door=cli&budget=50&json=1`]: { components: [] },
    });
    const ctx = contextOf(api);
    const text = await componentLs.run!(ctx, componentLs.input.parse({ doc: 'Auth flow' }));
    expect(componentLs.text!(text)).toEqual(['component nav "Nav bar"']);
    expect(componentLs.json!(text)).toEqual({ text: 'component nav "Nav bar"' });
    const json = await componentLs.run!(
      ctx,
      componentLs.input.parse({ doc: 'Auth flow', budget: '50', json: true }),
    );
    expect(componentLs.json!(json)).toEqual({ components: [] });
    expect(componentLs.text!(json)).toEqual(['{"components":[]}']);
  });
});

describe('component make', () => {
  const tab = plainTab([box('a', 'A'), box('b', 'B', 200)]);
  function routes(changeset: unknown = () => Response.json(written)) {
    const requests: ChangesetRequest[] = [];
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [TAB]: tabAnswer(tab, 5),
      [LIBRARY]: { components: [nav] },
      [`${LIBRARY}/card`]: async (request: Request) =>
        Response.json({ component: JSON.parse(await request.text()) as unknown }),
      [`${TAB}/changesets`]: async (request: Request) => {
        requests.push(JSON.parse(await request.text()) as ChangesetRequest);
        return (changeset as () => Response)();
      },
    });
    return { api, requests };
  }

  it('stores the main, then puts one instance in its place as a changeset at the revision read', async () => {
    const { api, requests } = routes();
    const ctx = contextOf(api, [], [], { copies: memoryCopies() });
    const out = await componentMake.run!(
      ctx,
      componentMake.input.parse({ doc: 'Auth flow', refs: ['a'], name: 'Card', summary: 'Card' }),
    );
    expect(out).toMatchObject({
      component: { id: 'card', name: 'Card', width: 120, height: 60, elements: 1 },
      instance: 'card',
      changeset: { id: 'cs_1', rev: 6 },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      summary: 'Card',
      base: { rev: 5, elements: { a: expect.any(String) } },
    });
    expect(componentMake.text!(out)).toEqual([
      'component card "Card" 120x60 · 1 element',
      written.text,
    ]);
    expect(componentMake.quiet!(out)).toEqual(['card']);
  });

  it('sends no changeset when the main is not stored', async () => {
    const { api, requests } = routes();
    const out = await componentMake.run!(
      contextOf(api),
      componentMake.input.parse({ doc: 'Auth flow', refs: ['a', 'b'] }),
    ).catch((e: unknown) => e);
    // Component 2 has no route for its PUT, so the store refuses: no changeset is sent.
    expect(out).toBeInstanceOf(VerbRefusal);
    expect(out).toMatchObject({ status: 400, code: 'not_found' });
    expect(requests).toEqual([]);
  });

  it('says the main was stored when the tab write is refused', async () => {
    const { api } = routes(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    const ctx = contextOf(api);
    const err = await refusal(
      componentMake.run!(
        ctx,
        componentMake.input.parse({ doc: 'Auth flow', refs: ['a'], name: 'Card' }),
      ),
    );
    expect(err).toBeInstanceOf(Error);
    expect(ctx.notices.at(-1)).toMatch(
      /^The component card \("Card"\) was stored, but the tab did not change/,
    );
  });

  it('refuses a ref that names nothing, and a tab read without a revision', async () => {
    const { api } = routes();
    expect(
      await refusal(
        componentMake.run!(
          contextOf(api),
          componentMake.input.parse({ doc: 'Auth flow', refs: ['zz'] }),
        ),
      ),
    ).toMatchObject({ code: 'target_not_found', hint: expect.stringMatching(/tab view/) });
    const bare = fakeApi({ ...library, ...tabsOfA, [TAB]: { tab } });
    expect(
      await refusal(
        componentMake.run!(
          contextOf(bare),
          componentMake.input.parse({ doc: 'Auth flow', refs: ['a'] }),
        ),
      ),
    ).toMatchObject({ message: 'the tab read carried no revision' });
  });

  it('a stored main with no changeset answered prints a null changeset', async () => {
    const { api } = routes(() => Response.json({ ...written, changeset: null }));
    const out = await componentMake.run!(
      contextOf(api),
      componentMake.input.parse({ doc: 'Auth flow', refs: ['a'], name: 'Card' }),
    );
    expect(out.changeset).toBeNull();
  });
});

describe('component set', () => {
  function routes() {
    const patches: unknown[] = [];
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [LIBRARY]: {
        components: [
          nav,
          { ...nav, id: 'nav-2', name: 'Nav two' },
          { ...nav, id: 'card', name: 'Card' },
        ],
      },
      [`${LIBRARY}/nav`]: async (request: Request) => {
        const patch = JSON.parse(await request.text()) as Record<string, unknown>;
        patches.push(patch);
        return Response.json({ component: { ...nav, ...patch } });
      },
      [`${LIBRARY}/card`]: () => Response.json({ error: 'not_found' }, { status: 404 }),
    });
    return { api, patches };
  }
  const files: Record<string, string> = {
    'patch.json': '{"remove":["bar"],"name":"From file"}',
    'list.json': '[1]',
    'bad.json': '{',
  };

  it('patches the main a word names: by id, by name, from a file', async () => {
    const { api, patches } = routes();
    const ctx = contextOf(api, [], [], { readInput: async (p) => files[p]! });
    const renamed = await componentSet.run!(
      ctx,
      componentSet.input.parse({ doc: 'Auth flow', component: 'nav', name: 'Top', archived: true }),
    );
    expect(componentSet.text!(renamed)).toEqual([
      'component nav "Top" 120x60 archived · 1 element',
    ]);
    expect(componentSet.quiet!(renamed)).toEqual(['nav']);
    await componentSet.run!(
      ctx,
      componentSet.input.parse({
        doc: 'Auth flow',
        component: 'NAV BAR',
        restore: true,
        patch: 'patch.json',
      }),
    );
    expect(patches).toEqual([
      { name: 'Top', archived: true },
      { remove: ['bar'], name: 'From file', archived: false },
    ]);
  });

  it('refuses a word that names no main or several, nothing to change, and a bad patch', async () => {
    const { api } = routes();
    const ctx = contextOf(api, [], [], { readInput: async (p) => files[p]! });
    const set = (input: Record<string, unknown>) =>
      refusal(componentSet.run!(ctx, componentSet.input.parse({ doc: 'Auth flow', ...input })));
    expect(await set({ component: 'zz', name: 'x' })).toMatchObject({
      status: 404,
      code: 'target_not_found',
      lines: ['nav "Nav bar"', 'nav-2 "Nav two"', 'card "Card"'],
    });
    expect(await set({ component: 'na', name: 'x' })).toMatchObject({
      status: 400,
      code: 'target_ambiguous',
      message: '"na" names 2 components',
    });
    expect(await set({ component: 'nav' })).toMatchObject({ code: 'invalid_value' });
    expect(await set({ component: 'nav', patch: 'list.json' })).toMatchObject({
      message: '--patch is not a JSON object',
    });
    expect(await set({ component: 'nav', patch: 'bad.json' })).toMatchObject({
      message: '--patch is not a JSON object',
    });
    expect(await set({ component: 'card', name: 'x' })).toMatchObject({
      status: 404,
      code: 'not_found',
    });
  });

  it('a refusal other than a missing main is a 400', async () => {
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [LIBRARY]: { components: [nav] },
      [`${LIBRARY}/nav`]: () =>
        Response.json({ error: 'bad_request', message: 'invalid patch' }, { status: 400 }),
    });
    expect(
      await refusal(
        componentSet.run!(
          contextOf(api),
          componentSet.input.parse({ doc: 'Auth flow', component: 'nav', name: 'x' }),
        ),
      ),
    ).toMatchObject({ status: 400, message: 'invalid patch' });
  });
});

describe('the component verbs', () => {
  it('are ls, make and set', () => {
    expect(componentVerbs.map((v) => v.id)).toEqual([
      'component.ls',
      'component.make',
      'component.set',
    ]);
    const two = { id: 'n', name: 'N', width: 10.4, height: 20, archived: false, elements: 2 };
    expect(componentSet.text!(two)).toEqual(['component n "N" 10x20 · 2 elements']);
  });
});
