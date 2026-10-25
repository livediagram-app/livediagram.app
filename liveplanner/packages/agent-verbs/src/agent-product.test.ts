import { describe, expect, it } from 'vitest';
import { AddressError, parseProjectUrl, resolveProject, resolveTab } from './addressing';
import { VerbRefusal } from './define';
import { resolveFolderRef } from './folders';
import { contextOf, DOC_A, fakeApi, library } from './testing/fake-api';
import { submitChangeset } from './write';

// The shared verbs bound to liveplanner (./agent-product.ts): the words its CLI and MCP print stay its own.

const HOST = 'https://liveplanner.app';

async function thrown(run: () => unknown): Promise<unknown> {
  try {
    await run();
  } catch (err) {
    return err;
  }
  throw new Error('expected it to throw');
}

describe('liveplanner’s agent product', () => {
  it('reads its own links and words a refusal with its CLI', async () => {
    expect(parseProjectUrl(`${HOST}/project/${DOC_A}`, HOST)).toEqual({ id: DOC_A });
    const notALink = await thrown(() => parseProjectUrl(`${HOST}/help`, HOST));
    expect(notALink).toBeInstanceOf(AddressError);
    expect((notALink as AddressError).failure).toMatchObject({
      what: 'project',
      message: `${HOST}/help is not a plan link`,
      hint: 'liveplanner project ls',
    });
    const none = await thrown(() => resolveProject(fakeApi(library), 'Nope', HOST));
    expect((none as AddressError).failure.message).toBe('no plan matches "Nope"');
    const several = await thrown(() => resolveProject(fakeApi(library), 'aaaa', HOST));
    expect((several as AddressError).failure.message).toBe('"aaaa" matches 2 plans');
    const noTabs = await thrown(() => resolveTab([], undefined, 'Shop'));
    expect((noTabs as AddressError).failure.hint).toBe('liveplanner tab add Shop <name>');
  });

  it('hints its CLI when a folder or a write is refused', async () => {
    const folder = await thrown(() => resolveFolderRef([], 'Nowhere', '--folder'));
    expect(folder).toBeInstanceOf(VerbRefusal);
    expect((folder as VerbRefusal).hint).toBe('liveplanner folder ls');

    const tab = `/projects/${DOC_A}/tabs/tab-one-0000/changesets`;
    const api = fakeApi({
      [tab]: () => Response.json({ error: 'stale_tab', rev: 7 }, { status: 412 }),
    });
    const target = {
      projectId: DOC_A,
      tabId: 'tab-one-0000',
      tabName: 'Overview',
      project: 'Shop',
    };
    const stale = await thrown(() =>
      submitChangeset(contextOf(api), target, { operations: 'rm n1' }, {}),
    );
    expect(stale).toMatchObject({
      code: 'stale_tab',
      hint: 're-read: liveplanner tab view "Shop" --tab "Overview"',
    });
  });
});
