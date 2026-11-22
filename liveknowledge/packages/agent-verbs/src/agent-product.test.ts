import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { apiRefusalOf } from './api-refusal';
import { AddressError, parseDocumentUrl, resolveDocument, resolveTab } from './addressing';
import { VerbRefusal } from './define';
import { resolveFolderRef } from './folders';
import { contextOf, DOC_A, fakeApi, library } from './testing/fake-api';
import { submitChangeset } from './write';

// The shared verbs bound to liveknowledge (./agent-product.ts): the words its CLI and MCP print stay its own.

const HOST = 'https://liveknowledge.app';

async function thrown(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (err) {
    return err;
  }
  throw new Error('expected it to throw');
}

describe('liveknowledge’s agent product', () => {
  it('reads its own links and words a refusal with its CLI', async () => {
    expect(parseDocumentUrl(`${HOST}/document/${DOC_A}`, HOST)).toEqual({ id: DOC_A });
    const notALink = await thrown(() => parseDocumentUrl(`${HOST}/help`, HOST));
    expect(notALink).toBeInstanceOf(AddressError);
    expect((notALink as AddressError).failure).toMatchObject({
      what: 'document',
      message: `${HOST}/help is not a knowledgebase link`,
      hint: 'liveknowledge document ls',
    });
    const none = await thrown(() => resolveDocument(fakeApi(library), 'Nope', HOST));
    expect((none as AddressError).failure.message).toBe('no knowledgebase matches "Nope"');
    const several = await thrown(() => resolveDocument(fakeApi(library), 'aaaa', HOST));
    expect((several as AddressError).failure.message).toBe('"aaaa" matches 2 knowledgebases');
    const noTabs = await thrown(() => resolveTab([], undefined, 'Shop'));
    expect((noTabs as AddressError).failure.hint).toBe('liveknowledge tab add Shop <name>');
  });

  it('hints its CLI when a folder or a write is refused', async () => {
    const folder = await thrown(() => resolveFolderRef([], 'Nowhere', '--folder'));
    expect(folder).toBeInstanceOf(VerbRefusal);
    expect((folder as VerbRefusal).hint).toBe('liveknowledge folder ls');

    const tab = `/documents/${DOC_A}/tabs/tab-one-0000/changesets`;
    const api = fakeApi({
      [tab]: () => Response.json({ error: 'stale_tab', rev: 7 }, { status: 412 }),
    });
    const target = { documentId: DOC_A, tabId: 'tab-one-0000', tabName: 'Overview', doc: 'Shop' };
    const stale = await thrown(() =>
      submitChangeset(contextOf(api), target, { operations: 'rm n1' }, {}),
    );
    expect(stale).toMatchObject({
      code: 'stale_tab',
      hint: 're-read: liveknowledge tab view "Shop" --tab "Overview"',
    });
  });

  it('answers a refusal the api worded itself with the api’s words', () => {
    const verified = new ApiError(
      409,
      JSON.stringify({
        error: 'page_verified',
        message: 'This page is verified. Use suggest_edit.',
      }),
    );
    expect(apiRefusalOf(verified)).toEqual({
      code: 'page_verified',
      message: 'This page is verified. Use suggest_edit.',
    });
    // A code with no message, a message with no code and a body that is no JSON take the shared words.
    expect(apiRefusalOf(new ApiError(403, '{"error":"forbidden"}'))?.message).toBe(
      'The api refused it: you may view this knowledgebase but not change it (or not this part of it).',
    );
    expect(apiRefusalOf(new ApiError(413, '{"message":"too big"}'))?.message).toBe(
      'The api refused it: that is more than the knowledgebase can hold.',
    );
    expect(apiRefusalOf(new ApiError(404, 'not json'))?.code).toBe('http_404');
    // A failure of ours is no refusal: it throws on.
    expect(apiRefusalOf(new ApiError(503, '{"error":"down","message":"x"}'))).toBeNull();
    expect(apiRefusalOf(new Error('boom'))).toBeNull();
  });

  it('words the api refusals with its knowledgebases and tools', () => {
    expect(apiRefusalOf(new ApiError(404, '{}'))?.message).toBe(
      'The api refused it: no such knowledgebase, or it is not shared with you. find_documents lists them.',
    );
    expect(apiRefusalOf(new ApiError(410, '{}'))?.message).toBe(
      'The api refused it: that knowledgebase is in the Trash: restore it with restore_document first.',
    );
  });
});
