import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import type { FolderedTab } from '../tab-folders';
import { contextOf, fakeApi, TEST_PRODUCT } from '../testing/product';
import { createTabFolderVerb } from './tab-folder';

// Each product's docs/specs/015-api/cli.md "Commands": `tab folder`, change_tabs one change a run.

const TABS: FolderedTab[] = [
  { id: 't1', name: 'A', orderIndex: 0, folder: 'P' },
  { id: 't2', name: 'B', orderIndex: 1 },
];

function setUp(status = 200) {
  const sent: unknown[] = [];
  const api = fakeApi({
    '/sketches/s1': async (request: Request) => {
      sent.push(await request.json());
      if (status !== 200) return Response.json({ error: 'forbidden' }, { status });
      return Response.json({ sketch: { tabs: TABS } });
    },
  });
  const verb = createTabFolderVerb({
    product: TEST_PRODUCT,
    fileOf: async () => ({ id: 's1', tabs: TABS }),
  });
  return { verb, ctx: contextOf(api), sent };
}

describe('tab folder', () => {
  it('puts a tab in a folder, takes one out, renames and ungroups', async () => {
    const { verb, ctx, sent } = setUp();
    const run = (input: Record<string, unknown>) => verb.run!(ctx, verb.input.parse(input));
    expect((await run({ doc: 'Shop', tab: 'B', folder: 'P' })).applied).toEqual([
      '~ tab "B" into folder "P"',
    ]);
    expect((await run({ doc: 'Shop', tab: 'A', loose: true })).applied).toEqual([
      '~ tab "A" out of its folder',
    ]);
    expect((await run({ doc: 'Shop', rename: 'P', to: 'Plans' })).applied).toEqual([
      '~ folder "P" renamed "Plans"',
    ]);
    const ungrouped = await run({ doc: 'Shop', ungroup: 'P' });
    expect(ungrouped.applied).toEqual(['~ folder "P" ungrouped: 1 tab out']);
    expect(verb.text!(ungrouped)).toEqual(ungrouped.applied);
    expect(sent).toHaveLength(4);
    expect(verb.cli!.positionals).toEqual(['doc']);
  });

  it('names the file by the product’s key', async () => {
    const { ctx } = setUp();
    const verb = createTabFolderVerb({
      product: TEST_PRODUCT,
      fileOf: async (_ctx, ref) => ({ id: ref === 'Shop' ? 's1' : 'x', tabs: TABS }),
      fileKey: 'project',
    });
    expect(verb.cli!.positionals).toEqual(['project']);
    const input = verb.input.parse({ project: 'Shop', ungroup: 'P' });
    expect((await verb.run!(ctx, input)).applied).toEqual(['~ folder "P" ungrouped: 1 tab out']);
  });

  it('refuses flags that name no change, two, or half of one', async () => {
    const { verb, ctx } = setUp();
    for (const input of [
      { doc: 'Shop' },
      { doc: 'Shop', tab: 'A', ungroup: 'P' },
      { doc: 'Shop', tab: 'A' },
      { doc: 'Shop', tab: 'A', folder: 'P', loose: true },
      { doc: 'Shop', rename: 'P' },
    ])
      await expect(verb.run!(ctx, verb.input.parse(input))).rejects.toBeInstanceOf(VerbRefusal);
  });

  it('words an unknown tab as not found and a Viewer as forbidden, and throws the rest', async () => {
    const unknown = setUp();
    await expect(
      unknown.verb.run!(
        unknown.ctx,
        unknown.verb.input.parse({ doc: 'Shop', tab: 'Z', folder: 'P' }),
      ),
    ).rejects.toMatchObject({ status: 404, code: 'not-found' });
    const viewer = setUp(403);
    await expect(
      viewer.verb.run!(viewer.ctx, viewer.verb.input.parse({ doc: 'Shop', tab: 'B', folder: 'P' })),
    ).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    const broken = setUp(500);
    await expect(
      broken.verb.run!(broken.ctx, broken.verb.input.parse({ doc: 'Shop', tab: 'B', folder: 'P' })),
    ).rejects.toThrow('api 500');
  });
});
