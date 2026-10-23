import { describe, expect, it } from 'vitest';
import {
  AddressError,
  parseProjectUrl,
  resolveProject,
  resolveTab,
  type AddressFailure,
} from './addressing';
import { DOC_A, DOC_B, DOC_C, fakeApi, library } from './testing/fake-api';

const HOST = 'https://liveplanner.app';

async function failureOf(promise: Promise<unknown> | (() => unknown)): Promise<AddressFailure> {
  try {
    await (typeof promise === 'function' ? promise() : promise);
  } catch (err) {
    if (err instanceof AddressError) return err.failure;
    throw err;
  }
  throw new Error('expected an AddressError');
}

describe('parseProjectUrl', () => {
  it('reads a project link and a share link, on the host or its www twin', () => {
    expect(parseProjectUrl(`${HOST}/project/${DOC_A}`, HOST)).toEqual({ id: DOC_A });
    expect(parseProjectUrl(`https://www.liveplanner.app/project/${DOC_A}?tab=x`, HOST)).toEqual({
      id: DOC_A,
    });
    expect(parseProjectUrl(`${HOST}/project/shared?s=abc123`, HOST)).toEqual({
      shareCode: 'abc123',
    });
  });

  it('is null for what is not a web URL', () => {
    expect(parseProjectUrl('Auth flow', HOST)).toBeNull();
    expect(parseProjectUrl('mailto:a@b.c', HOST)).toBeNull();
  });

  it('refuses another origin, a page that is not a project, and a share link without its code', async () => {
    expect(
      await failureOf(() => parseProjectUrl(`https://other.example/project/${DOC_A}`, HOST)),
    ).toMatchObject({
      kind: 'usage',
      hint: '--host https://other.example',
    });
    expect(await failureOf(() => parseProjectUrl(`${HOST}/help`, HOST))).toMatchObject({
      kind: 'usage',
      message: `${HOST}/help is not a plan link`,
    });
    expect(await failureOf(() => parseProjectUrl(`${HOST}/project/shared`, HOST))).toMatchObject({
      kind: 'usage',
      message: `${HOST}/project/shared has no share code`,
    });
  });
});

describe('resolveProject', () => {
  it('takes a name ignoring case, or an id prefix of four or more', async () => {
    const api = fakeApi(library);
    expect(await resolveProject(api, 'auth FLOW', HOST)).toEqual({ id: DOC_A, name: 'Auth flow' });
    expect(await resolveProject(api, 'aaaa2', HOST)).toEqual({ id: DOC_B, name: 'Auth flow v2' });
  });

  it('finds a 36-character name by name, never reading it as an id', async () => {
    const name = 'Quarterly platform migration plan v2';
    expect(name).toHaveLength(36);
    const api = fakeApi({
      ...library,
      '/projects': {
        projects: [{ id: DOC_C, name, savedAt: Date.UTC(2026, 9, 2), ownerId: 'u' }],
      },
    });
    expect(await resolveProject(api, name, HOST)).toEqual({ id: DOC_C, name });
  });

  it('reads a full id and a project link directly, without the list', async () => {
    const api = fakeApi({
      [`/projects/${DOC_A}`]: { project: { id: DOC_A, name: 'Auth flow' } },
    });
    expect(await resolveProject(api, DOC_A, HOST)).toEqual({ id: DOC_A, name: 'Auth flow' });
    expect(await resolveProject(api, `${HOST}/project/${DOC_A}`, HOST)).toEqual({
      id: DOC_A,
      name: 'Auth flow',
    });
    expect(api.calls).toEqual([`/projects/${DOC_A}`, `/projects/${DOC_A}`]);
  });

  it('lets the api answer an unknown full id', async () => {
    await expect(resolveProject(fakeApi({}), DOC_A, HOST)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
  });

  it('resolves a share link to its project and keeps the code', async () => {
    const api = fakeApi({ '/share/abc123': { project: { id: DOC_A, name: 'Auth flow' } } });
    expect(await resolveProject(api, `${HOST}/project/shared?s=abc123`, HOST)).toEqual({
      id: DOC_A,
      name: 'Auth flow',
      shareCode: 'abc123',
    });
  });

  it('refuses no match with the nearest names, and several with the candidates', async () => {
    const api = fakeApi(library);
    expect(await failureOf(resolveProject(api, 'Auth', HOST))).toMatchObject({
      kind: 'not-found',
      message: 'no plan matches "Auth"',
      candidates: [
        { ref: 'aaaa2', name: 'Auth flow v2', detail: 'personal' },
        { ref: 'aaaa1', name: 'Auth flow', detail: 'personal' },
      ],
    });
    expect(await failureOf(resolveProject(api, 'aaaa', HOST))).toMatchObject({
      kind: 'ambiguous',
      message: '"aaaa" matches 2 plans',
      hint: 'aaaa2',
    });
  });

  it('never treats a prefix shorter than four as an id', async () => {
    expect(await failureOf(resolveProject(fakeApi(library), 'aaa', HOST))).toMatchObject({
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

  it('refuses none and several with the tab list, and a project without tabs', async () => {
    expect(await failureOf(() => resolveTab(tabs, 'Nope', 'Auth'))).toMatchObject({
      kind: 'not-found',
      message: 'no tab matches "Nope"',
      hint: 'liveplanner tab ls Auth',
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
      [`/projects/${DOC_A}`]: { project: { id: DOC_A, name: 'Auth flow' } },
      '/share/abc123': { project: { id: DOC_A, name: 'Auth flow' } },
    });
    await resolveProject(api, 'Auth flow', HOST, log);
    await resolveProject(api, 'aaaa2', HOST, log);
    await failureOf(resolveProject(api, 'Nope', HOST, log));
    await resolveProject(api, DOC_A, HOST, log);
    await resolveProject(api, `${HOST}/project/${DOC_A}`, HOST, log);
    await resolveProject(api, `${HOST}/project/shared?s=abc123`, HOST, log);
    const tabs = [{ id: 'tab-one-0000', name: 'Overview', orderIndex: 0 }];
    resolveTab(tabs, undefined, 'Auth', log);
    resolveTab(tabs, 'overview', 'Auth', log);
    resolveTab(tabs, 'tab-o', 'Auth', log);
    await failureOf(() => resolveTab([], undefined, 'Auth', log));
    expect(logs).toEqual([
      'address project name 1 matches',
      'address project prefix 1 matches',
      'address project name 0 matches',
      'address project exact 1 matches',
      'address project url 1 matches',
      'address project url 1 matches',
      'address tab first 1 matches',
      'address tab name 1 matches',
      'address tab prefix 1 matches',
      'address tab first 0 matches',
    ]);
  });
});
