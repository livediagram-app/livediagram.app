import { describe, expect, it } from 'vitest';
import { IMAGE_GRANT_CHECK_MAX, type GrantedImage } from '@liveplanner/api-schema';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import {
  addedPictureIds,
  checkPictureGrants,
  IMAGE_UNKNOWN_MESSAGE,
  pictureEditOf,
  pictureLinkFor,
  pictureValue,
  picturesText,
  splitPictureFields,
  type GrantedPictures,
} from './card-pictures';
import { applyItemChanges } from './item-changes';
import { planListing } from './plan-listing';
import type { PlanState } from './plan-state';

// An agent's pictures on cards (docs/specs/015-api/mcp-server.md §4.5b): Image, Several Images and Attachments
// values read as changes, checked against the plan's grants before a card is written, and listed with a link.

const D = 'plan-1';
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const WORK: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'work',
  label: 'Work Item',
  fields: ['title', 'status', 'attachments', 'f-designs', 'f-mock'],
  custom: [
    { id: 'f-designs', label: 'Designs', kind: 'image', multiple: true },
    { id: 'f-mock', label: 'Mock', kind: 'image' },
  ],
};
const NOTE: ItemTypeDef = { ...WORK, id: 'note', label: 'Note', fields: ['title', 'status'] };
const card = (fields: Item['fields']): Item => ({
  id: 'card-1',
  type: 'work',
  key: 1,
  rank: 'i',
  fields: { title: 'Designs', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const image = (id: string, over: Partial<GrantedImage> = {}): GrantedImage => ({
  id,
  name: `${id}.png`,
  size: 2048,
  type: 'image/png',
  ...over,
});
const granted = (...images: GrantedImage[]): GrantedPictures =>
  new Map(images.map((i) => [i.id, i]));

describe('pictureEditOf', () => {
  it('reads add, remove, both, a bare id, a comma list, a list and list_items entries', () => {
    expect(pictureEditOf({ add: ['a'], remove: 'b' }, 'Designs')).toEqual({
      ok: true,
      edit: { add: ['a'], remove: ['b'] },
    });
    expect(pictureEditOf({ remove: ['b'] }, 'Designs')).toMatchObject({
      edit: { add: [], remove: ['b'] },
    });
    expect(pictureEditOf({ add: [], remove: null }, 'Designs')).toMatchObject({
      edit: { add: [], remove: [] },
    });
    expect(pictureEditOf(' a ', 'Designs')).toMatchObject({ edit: { add: ['a'], remove: [] } });
    expect(pictureEditOf('a, b,,a', 'Designs')).toMatchObject({ edit: { add: ['a', 'b'] } });
    expect(pictureEditOf(['a', { id: 'b', link: 'x' }], 'Designs')).toMatchObject({
      edit: { add: ['a', 'b'] },
    });
    expect(pictureEditOf({ id: 'c', link: 'x' }, 'Designs')).toMatchObject({
      edit: { add: ['c'] },
    });
  });

  it('reads [], null and "" as clearing the field', () => {
    for (const blank of [[], null, '', '  ', undefined])
      expect(pictureEditOf(blank, 'Designs')).toEqual({ ok: true, edit: 'clear' });
  });

  it('refuses anything else, saying how a picture field takes its value', () => {
    for (const bad of [
      3,
      true,
      { set: ['a'] },
      {},
      { add: [1] },
      { remove: [{}] },
      ['x'.repeat(201)],
    ])
      expect(pictureEditOf(bad, 'Designs'), JSON.stringify(bad)).toMatchObject({
        ok: false,
        code: 'value_invalid',
        message: expect.stringContaining('Designs takes pictures by id'),
      });
  });
});

describe('splitPictureFields', () => {
  it('takes the picture fields out by name or id, leaving the rest for resolveFields', () => {
    const split = splitPictureFields(
      { designs: 'a', 'f-mock': ['b'], Attachments: { add: ['c'] }, title: 'T', Unknown: 1 },
      WORK,
    );
    if (!split.ok) throw new Error(split.message);
    expect(split.rest).toEqual({ title: 'T', Unknown: 1 });
    expect([...split.pictures]).toEqual([
      ['f-designs', { add: ['a'], remove: [] }],
      ['f-mock', { add: ['b'], remove: [] }],
      ['attachments', { add: ['c'], remove: [] }],
    ]);
    expect(addedPictureIds(split.pictures)).toEqual(['a', 'b', 'c']);
    expect(
      addedPictureIds(
        new Map([
          ['f-designs', { add: ['a'], remove: [] }],
          ['f-mock', { add: ['a'], remove: [] }],
        ]),
      ),
    ).toEqual(['a']);
    expect(splitPictureFields(undefined, WORK)).toMatchObject({ ok: true, rest: {} });
  });

  it('refuses Attachments on a type that does not offer them, and a value it cannot read', () => {
    expect(splitPictureFields({ attachments: ['a'] }, NOTE)).toMatchObject({
      ok: false,
      code: 'field_unknown',
      message: expect.stringContaining('Note cards have no Attachments'),
    });
    expect(splitPictureFields({ Designs: 5 }, WORK)).toMatchObject({ ok: false });
  });

  it('counts a cleared field as adding nothing', () => {
    const split = splitPictureFields({ Designs: [] }, WORK);
    expect(split.ok && addedPictureIds(split.pictures)).toEqual([]);
  });
});

describe('checkPictureGrants', () => {
  const asking = (answer: (ids: string[]) => Response) => {
    const asked: string[][] = [];
    const api = fakeApi({
      [`/images/grants?p=${D}`]: async (r: Request) => {
        const { ids } = (await r.json()) as { ids: string[] };
        asked.push(ids);
        return answer(ids);
      },
    });
    return { api, asked };
  };

  it('asks once for the ids not asked about, and passes when the plan holds every one', async () => {
    const { api, asked } = asking((ids) =>
      Response.json({ images: ids.filter((i) => i !== 'other').map((i) => image(i)) }),
    );
    const known: GrantedPictures = new Map();
    expect(await checkPictureGrants(api, D, ['a', 'b', 'a'], known)).toEqual({ ok: true });
    expect(await checkPictureGrants(api, D, ['b'], known)).toEqual({ ok: true });
    expect(await checkPictureGrants(api, D, [], known)).toEqual({ ok: true });
    expect(asked).toEqual([['a', 'b']]);
    expect(await checkPictureGrants(api, D, ['other'], known)).toEqual({
      ok: false,
      code: 'image_unknown',
      message: `${IMAGE_UNKNOWN_MESSAGE} ("other")`,
    });
  });

  it(`refuses more than ${IMAGE_GRANT_CHECK_MAX} new pictures a call before asking`, async () => {
    const { api, asked } = asking(() => Response.json({ images: [] }));
    const ids = Array.from({ length: IMAGE_GRANT_CHECK_MAX + 1 }, (_, i) => `img-${i}`);
    expect(await checkPictureGrants(api, D, ids, new Map())).toMatchObject({
      ok: false,
      code: 'too_many_pictures',
    });
    expect(asked).toEqual([]);
  });

  it('words a Viewer, and a server without pictures; anything else is thrown', async () => {
    const status = (s: number, error: string) =>
      asking(() => Response.json({ error }, { status: s })).api;
    expect(await checkPictureGrants(status(403, 'forbidden'), D, ['a'], new Map())).toEqual({
      ok: false,
      code: 'forbidden',
      message: 'You can view this plan but not add pictures to it.',
    });
    expect(
      await checkPictureGrants(status(503, 'images_unavailable'), D, ['a'], new Map()),
    ).toMatchObject({ ok: false, code: 'images_unavailable' });
    await expect(
      checkPictureGrants(status(403, 'read_only_token'), D, ['a'], new Map()),
    ).rejects.toThrow('api 403');
  });
});

describe('pictureValue', () => {
  const had = {
    'f-designs': ['a', 'b'],
    'f-mock': 'm',
    attachments: [{ id: 'x', name: 'x.png', size: 10, type: 'image/png', cover: true }],
  };
  const all = granted(image('c'), image('d'), image('m2'), image('y', { name: null }));

  it('adds to a Several Images field at the end, removes, and clears an emptied one', () => {
    expect(pictureValue('f-designs', WORK, { add: ['c', 'a'], remove: ['b'] }, had, all)).toEqual({
      ok: true,
      value: ['a', 'c'],
    });
    expect(pictureValue('f-designs', WORK, { add: [], remove: ['a', 'b'] }, had, all)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(pictureValue('f-designs', WORK, 'clear', had, all)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('refuses a Several Images field past 20, saying how many more fit', () => {
    const full = { 'f-designs': Array.from({ length: 19 }, (_, i) => `p${i}`) };
    expect(pictureValue('f-designs', WORK, { add: ['c', 'd'], remove: [] }, full, all)).toEqual({
      ok: false,
      code: 'too_many_pictures',
      message: 'Designs holds up to 20 pictures: it has 19, so 1 more fit.',
    });
  });

  it('sets an Image field to the one picture given, and refuses two', () => {
    expect(pictureValue('f-mock', WORK, { add: ['m2'], remove: [] }, had, all)).toEqual({
      ok: true,
      value: 'm2',
    });
    expect(pictureValue('f-mock', WORK, { add: [], remove: ['m'] }, had, all)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(pictureValue('f-mock', WORK, { add: [], remove: ['other'] }, had, all)).toEqual({
      ok: true,
      value: 'm',
    });
    expect(pictureValue('f-mock', WORK, { add: ['c', 'd'], remove: [] }, had, all)).toMatchObject({
      ok: false,
      message: expect.stringContaining('Mock holds one picture'),
    });
  });

  it("makes an Attachments entry from the upload's own record, keeping the cover", () => {
    expect(pictureValue('attachments', WORK, { add: ['y', 'x'], remove: [] }, had, all)).toEqual({
      ok: true,
      value: [
        { id: 'x', name: 'x.png', size: 10, type: 'image/png', cover: true },
        { id: 'y', name: 'Image', size: 2048, type: 'image/png' },
      ],
    });
    expect(pictureValue('attachments', WORK, { add: [], remove: ['x'] }, had, all)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(pictureValue('attachments', WORK, { add: ['c'], remove: [] }, {}, all)).toMatchObject({
      value: [{ id: 'c', name: 'c.png' }],
    });
  });

  it('refuses an upload an attachment cannot hold, and Attachments past 20', () => {
    const odd = granted(image('svg', { type: 'image/svg+xml' }), image('big', { size: 11e6 }));
    for (const id of ['svg', 'big'])
      expect(pictureValue('attachments', WORK, { add: [id], remove: [] }, {}, odd)).toMatchObject({
        ok: false,
        code: 'value_invalid',
      });
    const full = {
      attachments: Array.from({ length: 20 }, (_, i) => ({
        id: `a${i}`,
        name: 'a.png',
        size: 1,
        type: 'image/png',
      })),
    };
    expect(pictureValue('attachments', WORK, { add: ['c'], remove: [] }, full, all)).toEqual({
      ok: false,
      code: 'too_many_pictures',
      message: 'Attachments holds up to 20 pictures: it has 20, so 0 more fit.',
    });
  });
});

describe('picturesText and pictureLinkFor', () => {
  it('counts the pictures, and links each through the api for its plan', () => {
    expect(picturesText('a')).toBe('1 picture');
    expect(picturesText(['a', 'b'])).toBe('2 pictures');
    expect(pictureLinkFor('https://www.liveplanner.app', 'plan 1')('img/1')).toBe(
      'https://www.liveplanner.app/api/images/img%2F1?p=plan%201',
    );
  });
});

describe('change_items with pictures (applyItemChanges)', () => {
  const state = (items: Item[] = [card({ 'f-designs': ['a'] })]): PlanState => ({
    items,
    plan: { boards: [], statuses: [], types: [WORK], itemTypesRev: 1 },
  });
  const harness = (held: string[]) => {
    const writes: unknown[] = [];
    const asked: string[][] = [];
    const api = fakeApi({
      [`/images/grants?p=${D}`]: async (r: Request) => {
        const { ids } = (await r.json()) as { ids: string[] };
        asked.push(ids);
        return Response.json({ images: ids.filter((i) => held.includes(i)).map((i) => image(i)) });
      },
      [`/projects/${D}/items`]: async (r: Request) => {
        const body = (await r.json()) as { fields: Item['fields'] };
        writes.push(body);
        return Response.json({ item: { ...card(body.fields), id: 'card-2', key: 2 }, rev: 2 });
      },
      [`/projects/${D}/items/card-1`]: async (r: Request) => {
        const body = (await r.json()) as { set?: Item['fields'] };
        writes.push(body);
        return Response.json({ item: card({ 'f-designs': ['a'], ...body.set }), rev: 2 });
      },
      [`/projects/${D}/items/card-2`]: async (r: Request) => {
        const body = (await r.json()) as { set?: Item['fields'] };
        writes.push(body);
        return Response.json({ item: { ...card({ ...body.set }), id: 'card-2', key: 2 }, rev: 2 });
      },
    });
    return { api, writes, asked };
  };

  it('checks every added picture in one request, then adds, removes and clears', async () => {
    const { api, writes, asked } = harness(['b', 'c']);
    const result = await applyItemChanges(
      api,
      D,
      [
        { op: 'set', item: '#1', fields: { Designs: { add: ['b'], remove: ['a'] }, Mock: 'c' } },
        { op: 'add', title: 'New', type: 'Work Item', fields: { attachments: ['c'], Mock: [] } },
        { op: 'set', item: '#1', fields: { Designs: null } },
      ],
      state(),
    );
    expect(result.refusal).toBeUndefined();
    expect(asked).toEqual([['b', 'c']]);
    expect(writes).toEqual([
      { set: { 'f-designs': ['b'], 'f-mock': 'c' } },
      {
        type: 'work',
        fields: {
          attachments: [{ id: 'c', name: 'c.png', size: 2048, type: 'image/png' }],
          title: 'New',
        },
      },
      { clear: ['f-designs'] },
    ]);
    expect(result.applied[0]).toContain('set Designs = 1 picture, Mock = 1 picture');
  });

  it('refuses a picture not uploaded for the plan before any card is written', async () => {
    const { api, writes } = harness(['b']);
    const result = await applyItemChanges(
      api,
      D,
      [
        { op: 'add', title: 'First', type: 'Work Item' },
        { op: 'set', item: '#1', fields: { Designs: { add: ['elsewhere'] } } },
      ],
      state(),
    );
    expect(result.applied).toEqual([]);
    expect(result.refusal).toEqual({
      code: 'image_unknown',
      message: `${IMAGE_UNKNOWN_MESSAGE} ("elsewhere")`,
    });
    expect(writes).toEqual([]);
  });

  it('leaves a change whose type it cannot name to its own refusal', async () => {
    for (const change of [
      { op: 'add' as const, title: 'New', type: 'Nope', fields: { Designs: 'b' } },
      { op: 'set' as const, item: '#1', type: 'Nope', fields: { Designs: 'b' } },
    ]) {
      const { api, asked } = harness(['b']);
      const result = await applyItemChanges(api, D, [change], state());
      expect(result.refusal?.code).toBe('type_unknown');
      expect(asked).toEqual([]);
    }
  });

  it('checks a change whose card is made earlier in the call when it comes', async () => {
    const { api, asked } = harness(['b']);
    const result = await applyItemChanges(
      api,
      D,
      [
        { op: 'add', title: 'New', type: 'Work Item' },
        { op: 'set', item: '#2', fields: { Designs: 'b' } },
        { op: 'set', item: '#9', fields: { Designs: 'b' } },
      ],
      state(),
    );
    expect(asked).toEqual([['b']]);
    expect(result.applied).toHaveLength(2);
    expect(result.refusal?.code).toBe('item_unknown');
  });
});

describe('list_items with pictures (planListing)', () => {
  it('lists each picture with a link, and keeps an empty Image field null', () => {
    const state: PlanState = {
      items: [
        card({
          'f-designs': ['a', 'b'],
          'f-mock': ['m', 'n'],
          attachments: [{ id: 'x', name: 'x.png', size: 10, type: 'image/png' }, 'odd'],
        }),
        { ...card({ 'f-mock': '' }), id: 'card-2', key: 2 },
      ],
      plan: { boards: [], statuses: [], types: [WORK], itemTypesRev: 1 },
    };
    const link = (id: string) => `L/${id}`;
    const [first, second] = planListing(state, {}, link).items;
    expect(first!.fields).toMatchObject({
      Designs: [
        { id: 'a', link: 'L/a' },
        { id: 'b', link: 'L/b' },
      ],
      Mock: { id: 'm', link: 'L/m' },
      attachments: [{ id: 'x', name: 'x.png', size: 10, type: 'image/png', link: 'L/x' }, 'odd'],
    });
    expect(second!.fields['Mock']).toBeNull();
    expect(planListing(state).items[0]!.fields['Mock']).toEqual({
      id: 'm',
      link: '/api/images/m',
    });
  });
});
