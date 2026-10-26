import { describe, expect, it } from 'vitest';
import { contextOf, fakeApi } from '../testing/fake-api';
import {
  ICON_SEARCH_MAX_LIMIT,
  iconSearch,
  schemaView,
  templateLs,
  templateView,
} from './catalogues';

describe('template ls and view', () => {
  it('lists kind, title and category, and shows one as the api outlines it', async () => {
    const api = fakeApi({
      '/templates': {
        categories: [],
        templates: [
          { kind: 'logo-design', title: 'Logo design', description: 'd', category: 'logos' },
        ],
      },
      '/templates/logo-design': { text: 'tab logo-design "Logo design"' },
    });
    const ls = await templateLs.run!(contextOf(api), {});
    expect(templateLs.text!(ls)).toEqual(['logo-design  "Logo design"  logos']);
    expect(templateLs.quiet!(ls)).toEqual(['logo-design']);
    const view = await templateView.run!(contextOf(api), { kind: 'logo-design' });
    expect(templateView.text!(view)).toEqual(['tab logo-design "Logo design"']);
  });
});

describe('icon search', () => {
  it('asks with the query and limit, and says when more matched or none did', async () => {
    const api = fakeApi({
      '/icons?query=message+queue&limit=1': {
        icons: [{ id: 'queue', label: 'Queue', set: 'line' }],
        more: 3,
      },
      '/icons?query=zz&limit=20': { icons: [], more: 0 },
    });
    const hit = await iconSearch.run!(
      contextOf(api),
      iconSearch.input.parse({ text: 'message queue', limit: '1' }),
    );
    expect(iconSearch.text!(hit)).toEqual([
      'queue  "Queue"  line',
      '… 3 more; --limit 4, or narrow the words',
    ]);
    expect(iconSearch.quiet!(hit)).toEqual(['queue']);
    // Never a --limit past the flag's maximum, which the flag itself would refuse.
    expect(iconSearch.text!({ icons: [], more: 70 }).at(-1)).toBe(
      `… 70 more; narrow the words (--limit goes up to ${ICON_SEARCH_MAX_LIMIT})`,
    );
    const none = await iconSearch.run!(contextOf(api), iconSearch.input.parse({ text: 'zz' }));
    expect(iconSearch.text!(none)).toEqual(['no icons match']);
  });
});

describe('schema', () => {
  it('prints the kinds, or one kind', async () => {
    const api = fakeApi({
      '/schema': { text: 'Element kinds' },
      '/schema/sticky': { text: 'sticky: a sticky' },
    });
    expect(schemaView.text!(await schemaView.run!(contextOf(api), {}))).toEqual(['Element kinds']);
    expect((await schemaView.run!(contextOf(api), { kind: 'sticky' })).text).toBe(
      'sticky: a sticky',
    );
  });
});

describe('an unknown name', () => {
  it('is refused with the nearest names the api listed', async () => {
    const unknown = (kinds: string[]) => () =>
      Response.json({ error: 'unknown_kind', kinds }, { status: 404 });
    const api = fakeApi({
      '/schema/rect': unknown(['square', 'rectangle-ish', 'circle']),
      '/schema/zzz': unknown(['square', 'circle']),
      '/templates/logo-desgn': () =>
        Response.json(
          { error: 'unknown_template', kinds: ['logo-design', 'wireframe-website'] },
          { status: 404 },
        ),
      '/templates/x': () => Response.json({ error: 'not_found' }, { status: 404 }),
      '/schema/plain': () => new Response('gone', { status: 404 }),
      '/schema/boom': () => Response.json({ error: 'x' }, { status: 500 }),
    });
    const ctx = contextOf(api);
    expect(await schemaView.run!(ctx, { kind: 'rect' }).catch((e: unknown) => e)).toMatchObject({
      status: 404,
      code: 'unknown_kind',
      message: 'no element kind "rect"; the nearest:',
      lines: ['rectangle-ish'],
      hint: 'livedesign schema',
    });
    expect(await schemaView.run!(ctx, { kind: 'zzz' }).catch((e: unknown) => e)).toMatchObject({
      lines: ['square', 'circle'],
    });
    expect(
      await templateView.run!(ctx, { kind: 'logo-desgn' }).catch((e: unknown) => e),
    ).toMatchObject({
      lines: ['logo-design'],
      hint: 'livedesign template ls',
    });
    expect(await templateView.run!(ctx, { kind: 'x' }).catch((e: unknown) => e)).toMatchObject({
      code: 'not_found',
      lines: [],
    });
    expect(await schemaView.run!(ctx, { kind: 'plain' }).catch((e: unknown) => e)).toMatchObject({
      code: 'not_found',
      lines: [],
    });
    expect(await schemaView.run!(ctx, { kind: 'boom' }).catch((e: unknown) => e)).toMatchObject({
      status: 500,
    });
  });
});
