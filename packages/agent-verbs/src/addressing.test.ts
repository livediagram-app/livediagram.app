import { describe, expect, it } from 'vitest';
import {
  AddressError,
  parseDocumentUrl,
  resolveDocument,
  resolveTab,
  type AddressFailure,
} from './addressing';
import { DOC_A, DOC_B, DOC_C, fakeApi, library } from './testing/fake-api';

const HOST = 'https://livediagram.app';

async function failureOf(promise: Promise<unknown> | (() => unknown)): Promise<AddressFailure> {
  try {
    await (typeof promise === 'function' ? promise() : promise);
  } catch (err) {
    if (err instanceof AddressError) return err.failure;
    throw err;
  }
  throw new Error('expected an AddressError');
}

describe('parseDocumentUrl', () => {
  it('reads a document link and a share link, on the host or its www twin', () => {
    expect(parseDocumentUrl(`${HOST}/document/${DOC_A}`, HOST)).toEqual({ id: DOC_A });
    expect(parseDocumentUrl(`https://www.livediagram.app/document/${DOC_A}?tab=x`, HOST)).toEqual({
      id: DOC_A,
    });
    expect(parseDocumentUrl(`${HOST}/document/shared?s=abc123`, HOST)).toEqual({
      shareCode: 'abc123',
    });
  });

  it('is null for what is not a web URL', () => {
    expect(parseDocumentUrl('Auth flow', HOST)).toBeNull();
    expect(parseDocumentUrl('mailto:a@b.c', HOST)).toBeNull();
  });

  it('refuses another origin, a page that is not a document, and a share link without its code', async () => {
    expect(
      await failureOf(() => parseDocumentUrl(`https://other.example/document/${DOC_A}`, HOST)),
    ).toMatchObject({
      kind: 'usage',
      hint: '--host https://other.example',
    });
    expect(await failureOf(() => parseDocumentUrl(`${HOST}/help`, HOST))).toMatchObject({
      kind: 'usage',
      message: `${HOST}/help is not a document link`,
    });
    expect(await failureOf(() => parseDocumentUrl(`${HOST}/document/shared`, HOST))).toMatchObject({
      kind: 'usage',
      message: `${HOST}/document/shared has no share code`,
    });
  });
});

describe('resolveDocument', () => {
  it('takes a name ignoring case, or an id prefix of four or more', async () => {
    const api = fakeApi(library);
    expect(await resolveDocument(api, 'auth FLOW', HOST)).toEqual({ id: DOC_A, name: 'Auth flow' });
    expect(await resolveDocument(api, 'aaaa2', HOST)).toEqual({ id: DOC_B, name: 'Auth flow v2' });
  });

  it('finds a 36-character name by name, never reading it as an id', async () => {
    const name = 'Quarterly platform migration plan v2';
    expect(name).toHaveLength(36);
    const api = fakeApi({
      ...library,
      '/documents': {
        documents: [{ id: DOC_C, name, savedAt: Date.UTC(2026, 9, 2), ownerId: 'u' }],
      },
    });
    expect(await resolveDocument(api, name, HOST)).toEqual({ id: DOC_C, name });
  });

  it('reads a full id and a document link directly, without the list', async () => {
    const api = fakeApi({
      [`/documents/${DOC_A}`]: { document: { id: DOC_A, name: 'Auth flow' } },
    });
    expect(await resolveDocument(api, DOC_A, HOST)).toEqual({ id: DOC_A, name: 'Auth flow' });
    expect(await resolveDocument(api, `${HOST}/document/${DOC_A}`, HOST)).toEqual({
      id: DOC_A,
      name: 'Auth flow',
    });
    expect(api.calls).toEqual([`/documents/${DOC_A}`, `/documents/${DOC_A}`]);
  });

  it('lets the api answer an unknown full id', async () => {
    await expect(resolveDocument(fakeApi({}), DOC_A, HOST)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    });
  });

  it('resolves a share link to its document and keeps the code', async () => {
    const api = fakeApi({ '/share/abc123': { document: { id: DOC_A, name: 'Auth flow' } } });
    expect(await resolveDocument(api, `${HOST}/document/shared?s=abc123`, HOST)).toEqual({
      id: DOC_A,
      name: 'Auth flow',
      shareCode: 'abc123',
    });
  });

  it('refuses no match with the nearest names, and several with the candidates', async () => {
    const api = fakeApi(library);
    expect(await failureOf(resolveDocument(api, 'Auth', HOST))).toMatchObject({
      kind: 'not-found',
      message: 'no document matches "Auth"',
      candidates: [
        { ref: 'aaaa2', name: 'Auth flow v2', detail: 'personal' },
        { ref: 'aaaa1', name: 'Auth flow', detail: 'personal' },
      ],
    });
    expect(await failureOf(resolveDocument(api, 'aaaa', HOST))).toMatchObject({
      kind: 'ambiguous',
      message: '"aaaa" matches 2 documents',
      hint: 'aaaa2',
    });
  });

  it('never treats a prefix shorter than four as an id', async () => {
    expect(await failureOf(resolveDocument(fakeApi(library), 'aaa', HOST))).toMatchObject({
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

  it('refuses none and several with the tab list, and a document without tabs', async () => {
    expect(await failureOf(() => resolveTab(tabs, 'Nope', 'Auth'))).toMatchObject({
      kind: 'not-found',
      message: 'no tab matches "Nope"',
      hint: 'livediagram tab ls Auth',
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
      [`/documents/${DOC_A}`]: { document: { id: DOC_A, name: 'Auth flow' } },
      '/share/abc123': { document: { id: DOC_A, name: 'Auth flow' } },
    });
    await resolveDocument(api, 'Auth flow', HOST, log);
    await resolveDocument(api, 'aaaa2', HOST, log);
    await failureOf(resolveDocument(api, 'Nope', HOST, log));
    await resolveDocument(api, DOC_A, HOST, log);
    await resolveDocument(api, `${HOST}/document/${DOC_A}`, HOST, log);
    await resolveDocument(api, `${HOST}/document/shared?s=abc123`, HOST, log);
    const tabs = [{ id: 'tab-one-0000', name: 'Overview', orderIndex: 0 }];
    resolveTab(tabs, undefined, 'Auth', log);
    resolveTab(tabs, 'overview', 'Auth', log);
    resolveTab(tabs, 'tab-o', 'Auth', log);
    await failureOf(() => resolveTab([], undefined, 'Auth', log));
    expect(logs).toEqual([
      'address document name 1 matches',
      'address document prefix 1 matches',
      'address document name 0 matches',
      'address document exact 1 matches',
      'address document url 1 matches',
      'address document url 1 matches',
      'address tab first 1 matches',
      'address tab name 1 matches',
      'address tab prefix 1 matches',
      'address tab first 0 matches',
    ]);
  });
});
