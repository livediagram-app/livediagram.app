import { describe, expect, it } from 'vitest';
import type { DesignComponent } from '@livedesign/design';
import { DOC_A, fakeApi } from '../testing/fake-api';
import { box, plainTab } from '../testing/tabs';
import {
  componentSummary,
  patchComponent,
  prepareMakeComponent,
  readLibrary,
  storeComponent,
  storedButNotPlaced,
} from './calls';

const LIBRARY = `/designs/${DOC_A}/components`;
const nav: DesignComponent = {
  id: 'nav',
  name: 'Nav bar',
  width: 120,
  height: 60,
  updatedAt: 1,
  elements: [box('bar', 'Bar')],
};
const answer = (status: number, body: unknown) => () => Response.json(body, { status });

describe('readLibrary', () => {
  it('answers the mains that validate', async () => {
    const api = fakeApi({ [LIBRARY]: { components: [nav, { id: 'broken' }] } });
    expect(await readLibrary(api, DOC_A)).toEqual([nav]);
  });
});

describe('storeComponent and patchComponent', () => {
  it('answer the main as stored', async () => {
    const bodies: unknown[] = [];
    const route = async (request: Request) => {
      bodies.push([request.method, JSON.parse(await request.text())]);
      return Response.json({ component: { ...nav, name: 'Top' } });
    };
    const api = fakeApi({ [`${LIBRARY}/nav`]: route });
    expect(await storeComponent(api, DOC_A, nav)).toMatchObject({ ok: true });
    expect(await patchComponent(api, DOC_A, 'nav', { name: 'Top' })).toMatchObject({
      ok: true,
      component: { name: 'Top' },
    });
    expect(bodies).toEqual([
      ['PUT', nav],
      ['PATCH', { name: 'Top' }],
    ]);
  });

  it('refuse in the api’s own words', async () => {
    const refusedWith = async (status: number, body: unknown, main = true) => {
      const api = fakeApi({ [`${LIBRARY}/nav`]: answer(status, body) });
      return main
        ? patchComponent(api, DOC_A, 'nav', { name: 'x' })
        : storeComponent(api, DOC_A, nav);
    };
    expect(await refusedWith(409, { error: 'too_many_components' }, false)).toEqual({
      ok: false,
      code: 'too_many_components',
      message: 'the design holds the most components it may (200)',
    });
    expect(await refusedWith(413, { error: 'too_large' }, false)).toMatchObject({
      code: 'too_large',
      message: "a component's JSON holds at most 256 KB",
    });
    expect(await refusedWith(404, { error: 'not_found' })).toMatchObject({
      code: 'not_found',
      message: 'no such component in this design',
    });
    expect(
      await refusedWith(400, { error: 'bad_request', message: 'invalid patch' }),
    ).toMatchObject({
      code: 'bad_request',
      message: 'invalid patch',
      hint: expect.stringMatching(/component ls/),
    });
    // A 400 without a message, a 404 from a store, a body that is not JSON: the generic wording.
    expect(await refusedWith(400, { error: 'bad_request' })).toMatchObject({
      code: 'bad_request',
      message: 'The api refused it (bad_request).',
    });
    expect(await refusedWith(404, { error: 'not_found' }, false)).toMatchObject({
      message: expect.stringMatching(/^The api refused it: no such design/),
    });
    const notJson = fakeApi({ [`${LIBRARY}/nav`]: () => new Response('nope', { status: 400 }) });
    expect(await patchComponent(notJson, DOC_A, 'nav', {})).toMatchObject({ code: 'http_400' });
    await expect(refusedWith(500, { error: 'boom' })).rejects.toThrow(/api 500/);
  });
});

describe('prepareMakeComponent', () => {
  const tab = { ...plainTab([box('a', 'A'), box('b', 'B', 200)]), rev: 3 };
  const input = { refs: ['a'], name: 'Card', now: 5 };

  it('reads the library, plans on the tab and stores the main', async () => {
    const stored: unknown[] = [];
    const api = fakeApi({
      [LIBRARY]: { components: [nav] },
      [`${LIBRARY}/card`]: async (request: Request) => {
        const main = JSON.parse(await request.text()) as DesignComponent;
        stored.push(main.id);
        return Response.json({ component: main });
      },
    });
    const made = await prepareMakeComponent(api, DOC_A, tab, input);
    expect(made).toMatchObject({
      ok: true,
      component: { id: 'card' },
      plan: { instanceId: 'card' },
    });
    expect(stored).toEqual(['card']);
  });

  it('stops at the first refusal: the read, the plan, the store', async () => {
    expect(
      await prepareMakeComponent(fakeApi({ [LIBRARY]: answer(403, {}) }), DOC_A, tab, input),
    ).toMatchObject({ ok: false, code: 'http_403' });
    const api = fakeApi({ [LIBRARY]: { components: [] } });
    expect(await prepareMakeComponent(api, DOC_A, tab, { ...input, refs: ['zz'] })).toMatchObject({
      code: 'target_not_found',
    });
    // No route for the PUT: the store's 404.
    expect(await prepareMakeComponent(api, DOC_A, tab, input)).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });
});

describe('the answers', () => {
  it('name a main and say a stored one was not placed', () => {
    expect(componentSummary(nav)).toEqual({
      id: 'nav',
      name: 'Nav bar',
      width: 120,
      height: 60,
      archived: false,
      elements: 1,
    });
    expect(storedButNotPlaced(nav)).toMatch(/^The component nav \("Nav bar"\) was stored/);
  });
});
