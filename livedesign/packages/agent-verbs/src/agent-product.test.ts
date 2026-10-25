import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { apiRefusalOf } from './api-refusal';
import { AddressError, parseDesignUrl, resolveDesign, resolveTab } from './addressing';
import { VerbRefusal } from './define';
import { resolveFolderRef } from './folders';
import { contextOf, DOC_A, fakeApi, library } from './testing/fake-api';
import { submitChangeset } from './write';

// The shared verbs bound to livedesign (./agent-product.ts): the words its CLI and MCP print stay its own.

const HOST = 'https://livedesign.app';

async function thrown(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (err) {
    return err;
  }
  throw new Error('expected it to throw');
}

describe('livedesign’s agent product', () => {
  it('reads its own links and words a refusal with its CLI', async () => {
    expect(parseDesignUrl(`${HOST}/design/${DOC_A}`, HOST)).toEqual({ id: DOC_A });
    const notALink = await thrown(() => parseDesignUrl(`${HOST}/help`, HOST));
    expect(notALink).toBeInstanceOf(AddressError);
    expect((notALink as AddressError).failure).toMatchObject({
      what: 'design',
      message: `${HOST}/help is not a design link`,
      hint: 'livedesign design ls',
    });
    const none = await thrown(() => resolveDesign(fakeApi(library), 'Nope', HOST));
    expect((none as AddressError).failure.message).toBe('no design matches "Nope"');
    const several = await thrown(() => resolveDesign(fakeApi(library), 'aaaa', HOST));
    expect((several as AddressError).failure.message).toBe('"aaaa" matches 2 designs');
    const noTabs = await thrown(() => resolveTab([], undefined, 'Shop'));
    expect((noTabs as AddressError).failure.hint).toBe('livedesign tab add Shop <name>');
  });

  it('hints its CLI when a folder or a write is refused', async () => {
    const folder = await thrown(() => resolveFolderRef([], 'Nowhere', '--folder'));
    expect(folder).toBeInstanceOf(VerbRefusal);
    expect((folder as VerbRefusal).hint).toBe('livedesign folder ls');

    const tab = `/designs/${DOC_A}/tabs/tab-one-0000/changesets`;
    const api = fakeApi({
      [tab]: () => Response.json({ error: 'stale_tab', rev: 7 }, { status: 412 }),
    });
    const target = { designId: DOC_A, tabId: 'tab-one-0000', tabName: 'Overview', doc: 'Shop' };
    const stale = await thrown(() =>
      submitChangeset(contextOf(api), target, { operations: 'rm n1' }, {}),
    );
    expect(stale).toMatchObject({
      code: 'stale_tab',
      hint: 're-read: livedesign tab view "Shop" --tab "Overview"',
    });
  });

  it('words the api refusals with its designs and tools', () => {
    expect(apiRefusalOf(new ApiError(404, '{}'))?.message).toBe(
      'The api refused it: no such design, or it is not shared with you. find_designs lists them.',
    );
    expect(apiRefusalOf(new ApiError(410, '{}'))?.message).toBe(
      'The api refused it: that design is in the Trash: restore it with restore_design first.',
    );
  });
});
