import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { apiRefusalOf } from './api-refusal';
import { AddressError, parseDocumentUrl, resolveDocument, resolveTab } from './addressing';
import { VerbRefusal } from './define';
import { resolveFolderRef } from './folders';
import { contextOf, DOC_A, fakeApi, library } from './testing/fake-api';
import { submitChangeset } from './write';

// The shared verbs bound to livedocuments (./agent-product.ts): the words its CLI and MCP print stay its own.

const HOST = 'https://livedocuments.app';

async function thrown(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (err) {
    return err;
  }
  throw new Error('expected it to throw');
}

describe('livedocuments’s agent product', () => {
  it('reads its own links and words a refusal with its CLI', async () => {
    expect(parseDocumentUrl(`${HOST}/document/${DOC_A}`, HOST)).toEqual({ id: DOC_A });
    const notALink = await thrown(() => parseDocumentUrl(`${HOST}/help`, HOST));
    expect(notALink).toBeInstanceOf(AddressError);
    expect((notALink as AddressError).failure).toMatchObject({
      what: 'document',
      message: `${HOST}/help is not a document link`,
      hint: 'livedocuments document ls',
    });
    const none = await thrown(() => resolveDocument(fakeApi(library), 'Nope', HOST));
    expect((none as AddressError).failure.message).toBe('no document matches "Nope"');
    const several = await thrown(() => resolveDocument(fakeApi(library), 'aaaa', HOST));
    expect((several as AddressError).failure.message).toBe('"aaaa" matches 2 documents');
    const noTabs = await thrown(() => resolveTab([], undefined, 'Shop'));
    expect((noTabs as AddressError).failure.hint).toBe('livedocuments tab add Shop <name>');
  });

  it('hints its CLI when a folder or a write is refused', async () => {
    const folder = await thrown(() => resolveFolderRef([], 'Nowhere', '--folder'));
    expect(folder).toBeInstanceOf(VerbRefusal);
    expect((folder as VerbRefusal).hint).toBe('livedocuments folder ls');

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
      hint: 're-read: livedocuments tab view "Shop" --tab "Overview"',
    });
  });

  it('words the api refusals with its documents and tools', () => {
    expect(apiRefusalOf(new ApiError(404, '{}'))?.message).toBe(
      'The api refused it: no such document, or it is not shared with you. find_documents lists them.',
    );
    expect(apiRefusalOf(new ApiError(410, '{}'))?.message).toBe(
      'The api refused it: that document is in the Trash: restore it with restore_document first.',
    );
  });
});
