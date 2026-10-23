import { describe, expect, it } from 'vitest';
import {
  AddressError,
  parseDesignUrl,
  resolveDesign,
  resolveTab,
  type AddressFailure,
} from './addressing';
import { DOC_A, DOC_B, DOC_C, fakeApi, library } from './testing/fake-api';

const HOST = 'https://livedesign.app';

async function failureOf(promise: Promise<unknown> | (() => unknown)): Promise<AddressFailure> {
  try {
    await (typeof promise === 'function' ? promise() : promise);
  } catch (err) {
    if (err instanceof AddressError) return err.failure;
    throw err;
  }
  throw new Error('expected an AddressError');
}

describe('parseDesignUrl', () => {
  it('reads a design link and a share link, on the host or its www twin', () => {
    expect(parseDesignUrl(`${HOST}/design/${DOC_A}`, HOST)).toEqual({ id: DOC_A });
    expect(parseDesignUrl(`https://www.livedesign.app/design/${DOC_A}?tab=x`, HOST)).toEqual({
      id: DOC_A,
    });
    expect(parseDesignUrl(`${HOST}/design/shared?s=abc123`, HOST)).toEqual({
      shareCode: 'abc123',
    });
  });

  it('is null for what is not a web URL', () => {
    expect(parseDesignUrl('Auth flow', HOST)).toBeNull();
    expect(parseDesignUrl('mailto:a@b.c', HOST)).toBeNull();
  });

  it('refuses another origin, a page that is not a design, and a share link without its code', async () => {
    expect(
      await failureOf(() => parseDesignUrl(`https://other.example/design/${DOC_A}`, HOST)),
    ).toMatchObject({
      kind: 'usage',
      hint: '--host https://other.example',
    });
    expect(await failureOf(() => parseDesignUrl(`${HOST}/help`, HOST))).toMatchObject({
      kind: 'usage',
      message: `${HOST}/help is not a design link`,
    });
    expect(await failureOf(() => parseDesignUrl(`${HOST}/design/shared`, HOST))).toMatchObject({
      kind: 'usage',
      message: `${HOST}/design/shared has no share code`,
    });
  });
});

describe('resolveDesign', () => {
  it('takes a name ignoring case, or an id prefix of four or more', async () => {
    const api = fakeApi(library);
    expect(await resolveDesign(api, 'auth FLOW', HOST)).toEqual({ id: DOC_A, name: 'Auth flow' });
    expect(await resolveDesign(api, 'aaaa2', HOST)).toEqual({ id: DOC_B, name: 'Auth flow v2' });
  });

  it('finds a 36-character name by name, never reading it as an id', async () => {
    const name = 'Quarterly platform migration plan v2';
    expect(name).toHaveLength(36);
    const api = fakeApi({
      ...library,
      '/designs': {
        designs: [{ id: DOC_C, name, savedAt: Date.UTC(2026, 9, 2), ownerId: 'u' }],
      },
    });
    expect(await resolveDesign(api, name, HOST)).toEqual({ id: DOC_C, name });
  });

  it('reads a full id and a design link directly, without the list', async () => {
    const api = fakeApi({
      [`/designs/${DOC_A}`]: { design: { id: DOC_A, name: 'Auth flow' } },
    });
    expect(await resolveDesign(api, DOC_A, HOST)).toEqual({ id: DOC_A, name: 'Auth flow' });
    expect(await resolveDesign(api, `${HOST}/design/${DOC_A}`, HOST)).toEqual({
      id: DOC_A,
      name: 'Auth flow',
    });
    expect(api.calls).toEqual([`/designs/${DOC_A}`, `/designs/${DOC_A}`]);
  });

  it('lets the api answer an unknown full id', async () => {
    await expect(resolveDesign(fakeApi({}), DOC_A, HOST)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
  });

  it('resolves a share link to its design and keeps the code', async () => {
    const api = fakeApi({ '/share/abc123': { design: { id: DOC_A, name: 'Auth flow' } } });
    expect(await resolveDesign(api, `${HOST}/design/shared?s=abc123`, HOST)).toEqual({
      id: DOC_A,
      name: 'Auth flow',
      shareCode: 'abc123',
    });
  });

  it('refuses no match with the nearest names, and several with the candidates', async () => {
    const api = fakeApi(library);
    expect(await failureOf(resolveDesign(api, 'Auth', HOST))).toMatchObject({
      kind: 'not-found',
      message: 'no design matches "Auth"',
      candidates: [
        { ref: 'aaaa2', name: 'Auth flow v2', detail: 'personal' },
        { ref: 'aaaa1', name: 'Auth flow', detail: 'personal' },
      ],
    });
    expect(await failureOf(resolveDesign(api, 'aaaa', HOST))).toMatchObject({
      kind: 'ambiguous',
      message: '"aaaa" matches 2 designs',
      hint: 'aaaa2',
    });
  });

  it('never treats a prefix shorter than four as an id', async () => {
    expect(await failureOf(resolveDesign(fakeApi(library), 'aaa', HOST))).toMatchObject({
      kind: 'not-found',
      candidates: [],
    });
  });
});

describe('resolveTab', () => {
  const tabs = [
    { id: 'tab-two-0000', name: 'Details', orderIndex: 1 },
    { id: 'tab-one-0000', name: 'Overview', orderIndex: 0 },
    { id: 'tab-thr-0000', name: 'overview', orderIndex: 2 },
  ];

  it('is the first tab by order when none is named', () => {
    expect(resolveTab(tabs, undefined, 'Auth')).toMatchObject({ name: 'Overview' });
  });

  it('takes a name ignoring case, or an id prefix', () => {
    expect(resolveTab(tabs, 'DETAILS', 'Auth')).toMatchObject({ id: 'tab-two-0000' });
    expect(resolveTab(tabs, 'tab-thr', 'Auth')).toMatchObject({ id: 'tab-thr-0000' });
  });

  it('refuses none and several with the tab list, and a design without tabs', async () => {
    expect(await failureOf(() => resolveTab(tabs, 'Nope', 'Auth'))).toMatchObject({
      kind: 'not-found',
      message: 'no tab matches "Nope"',
      hint: 'livedesign tab ls Auth',
      candidates: [
        { ref: 'tab-o', name: 'Overview', detail: 'tab 1' },
        { ref: 'tab-tw', name: 'Details', detail: 'tab 2' },
        { ref: 'tab-th', name: 'overview', detail: 'tab 3' },
      ],
    });
    expect(await failureOf(() => resolveTab(tabs, 'overview', 'Auth'))).toMatchObject({
      kind: 'ambiguous',
      message: '"overview" matches 2 tabs',
    });
    expect(await failureOf(() => resolveTab([], undefined, 'Auth'))).toMatchObject({
      kind: 'not-found',
      message: 'Auth has no tabs',
    });
  });
});

describe('the address log', () => {
  it('names how each address resolved and how many matched', async () => {
    const logs: string[] = [];
    const log = (line: string) => void logs.push(line);
    const api = fakeApi({
      ...library,
      [`/designs/${DOC_A}`]: { design: { id: DOC_A, name: 'Auth flow' } },
      '/share/abc123': { design: { id: DOC_A, name: 'Auth flow' } },
    });
    await resolveDesign(api, 'Auth flow', HOST, log);
    await resolveDesign(api, 'aaaa2', HOST, log);
    await failureOf(resolveDesign(api, 'Nope', HOST, log));
    await resolveDesign(api, DOC_A, HOST, log);
    await resolveDesign(api, `${HOST}/design/${DOC_A}`, HOST, log);
    await resolveDesign(api, `${HOST}/design/shared?s=abc123`, HOST, log);
    const tabs = [{ id: 'tab-one-0000', name: 'Overview', orderIndex: 0 }];
    resolveTab(tabs, undefined, 'Auth', log);
    resolveTab(tabs, 'overview', 'Auth', log);
    resolveTab(tabs, 'tab-o', 'Auth', log);
    await failureOf(() => resolveTab([], undefined, 'Auth', log));
    expect(logs).toEqual([
      'address design name 1 matches',
      'address design prefix 1 matches',
      'address design name 0 matches',
      'address design exact 1 matches',
      'address design url 1 matches',
      'address design url 1 matches',
      'address tab first 1 matches',
      'address tab name 1 matches',
      'address tab prefix 1 matches',
      'address tab first 0 matches',
    ]);
  });
});
