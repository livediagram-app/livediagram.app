import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { ITEM_TYPES, type Item } from '@liveplanner/items';
import { VerbRefusal } from '../define';
import { uploadForPlan } from '../images/plan-upload';
import { apiRefusalOf } from '../plan/api-refusal';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { imageAdd } from './image';
import { itemLs, itemSet, withPictureRemovals } from './item';

// Pictures from the CLI (docs/specs/015-api/cli.md "Pictures") and the upload the MCP's upload_image shares
// (docs/specs/015-api/mcp-server.md §4.5b): uploaded for a plan, then placed with item set.

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...be32(13),
  0x49,
  0x48,
  0x44,
  0x52,
  ...be32(4),
  ...be32(3),
  8,
  6,
  0,
  0,
  0,
]);
const stored = {
  id: 'img-1',
  contentType: 'image/png',
  byteSize: PNG.byteLength,
  width: 4,
  height: 3,
  originalName: 'mock.png',
  createdAt: Date.UTC(2026, 10, 12),
};
const uploadPath = `/images?p=${DOC_A}`;

function uploads(answer: (r: Request) => Response | Promise<Response>) {
  const seen: Request[] = [];
  const api = fakeApi({
    ...library,
    ...tabsOfA,
    [uploadPath]: (r: Request) => {
      seen.push(r);
      return answer(r);
    },
  });
  return { api, seen };
}

describe('uploadForPlan', () => {
  it("uploads through the plan's own route, naming the tool", async () => {
    const { api, seen } = uploads(() => Response.json({ image: stored, deduped: false }));
    const got = await uploadForPlan(api, DOC_A, { bytes: PNG, name: 'mock.png' }, 'mcp');
    expect(got).toMatchObject({ id: 'img-1', name: 'mock.png', size: PNG.byteLength });
    expect(seen[0]!.headers.get('X-Image-Source')).toBe('mcp');
  });

  it('words a Viewer, a plan it cannot reach and a full gallery; a read-only token as the api says', async () => {
    const refusal = async (status: number, body: object) => {
      const { api } = uploads(() => Response.json(body, { status }));
      try {
        await uploadForPlan(api, DOC_A, { bytes: PNG, name: null }, 'mcp');
      } catch (err) {
        return err;
      }
      throw new Error('no refusal');
    };
    expect(await refusal(403, { error: 'forbidden' })).toMatchObject({
      code: 'forbidden',
      message: 'You can view this plan but not add pictures to it.',
    });
    expect(await refusal(404, { error: 'not_found' })).toMatchObject({ code: 'not_found' });
    const full = (await refusal(409, { error: 'gallery_full' })) as VerbRefusal;
    expect(full).toBeInstanceOf(VerbRefusal);
    expect(full.message).toContain('with the Image Gallery in the Explorer, then upload again.');
    const readOnly = await refusal(403, { error: 'read_only_token' });
    expect(readOnly).toBeInstanceOf(ApiError);
    expect(await refusal(400, { error: 'bad' })).toBeInstanceOf(ApiError);
  });

  it('reads as a tool error in its own words (apiRefusalOf)', () => {
    const err = new VerbRefusal({
      status: 413,
      code: 'file_too_large',
      message: 'Too big.',
      hint: '',
    });
    expect(apiRefusalOf(err)).toEqual({ code: 'file_too_large', message: 'Too big.' });
  });
});

describe('image add', () => {
  it('uploads a file the CLI reads, named by it, for the plan named', async () => {
    const { api, seen } = uploads(() => Response.json({ image: stored, deduped: false }));
    const ctx = contextOf(api, [], [], { readBytes: async () => PNG });
    const out = await imageAdd.run!(ctx, {
      project: DOC_A,
      source: 'designs/mock.png',
      name: undefined,
    });
    expect(seen[0]!.headers.get('X-Image-Original-Name')).toBe('mock.png');
    expect(seen[0]!.headers.get('X-Image-Source')).toBe('cli');
    expect(imageAdd.text!(out)).toEqual(['uploaded img-1 4x3 29 B "mock.png"']);
    expect(imageAdd.quiet!(out)).toEqual(['img-1']);
    expect(imageAdd.text!({ ...out, deduped: true })[0]!.startsWith('already in the gallery')).toBe(
      true,
    );
  });

  it('fetches a URL itself, and refuses a file where it reads none', async () => {
    const { api } = uploads(() => Response.json({ image: stored, deduped: false }));
    // A URL the public fetch refuses before any request: the refusal is the shared upload's.
    await expect(
      imageAdd.run!(contextOf(api), {
        project: DOC_A,
        source: 'https://127.0.0.1/a.png',
        name: 'A',
      }),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^url_/) });
    await expect(
      imageAdd.run!(contextOf(api), { project: DOC_A, source: 'a.png', name: undefined }),
    ).rejects.toMatchObject({ code: 'usage' });
  });
});

describe('item set and item ls with pictures', () => {
  const WORK = {
    ...ITEM_TYPES[1],
    id: 'work',
    label: 'Work Item',
    fields: ['title', 'status', 'f-designs'],
    custom: [{ id: 'f-designs', label: 'Designs', kind: 'image' as const, multiple: true }],
  };
  const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
  const card: Item = {
    id: 'card-1',
    type: 'work',
    key: 1,
    rank: 'i',
    fields: { title: 'Mocks', 'f-designs': ['old'] },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: by,
    updatedBy: by,
  };
  const items = `/projects/${DOC_A}/items`;
  const harness = () => {
    const writes: unknown[] = [];
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [items]: { items: [card], rev: 1 },
      [`/projects/${DOC_A}/plan`]: { boards: [], statuses: [], types: [WORK], itemTypesRev: 1 },
      [`/images/grants?p=${DOC_A}`]: async (r: Request) => {
        const { ids } = (await r.json()) as { ids: string[] };
        return Response.json({
          images: ids.map((id) => ({ id, name: null, size: 10, type: 'image/png' })),
        });
      },
      [`${items}/card-1`]: async (r: Request) => {
        const body = (await r.json()) as { set?: Item['fields'] };
        writes.push(body);
        return Response.json({ item: { ...card, fields: { ...card.fields, ...body.set } } });
      },
    });
    return { ctx: contextOf(api), writes };
  };

  it('adds by key=id and takes off with --remove', async () => {
    const { ctx, writes } = harness();
    await itemSet.run!(
      ctx,
      itemSet.input.parse({
        project: DOC_A,
        item: '#1',
        fields: ['Designs=a,b'],
        remove: ['Designs=old'],
      }),
    );
    expect(writes[0]).toEqual({ set: { 'f-designs': ['a', 'b'] } });
  });

  it('reads --remove beside an add of the same key, or alone', () => {
    expect(withPictureRemovals({ Designs: 'a' }, ['Designs=b, c'])).toEqual({
      Designs: { add: 'a', remove: ['b', 'c'] },
    });
    expect(withPictureRemovals({}, ['attachments=x'])).toEqual({ attachments: { remove: ['x'] } });
    // Keys fieldsFromPairs reads as a list or a number still read as ids.
    expect(withPictureRemovals({}, ['labels=a,b', 'estimate=3'])).toEqual({
      labels: { remove: ['a', 'b'] },
      estimate: { remove: ['3'] },
    });
  });

  it('lists each picture with a link on its host', async () => {
    const { ctx } = harness();
    const out = await itemLs.run!(ctx, { project: DOC_A, type: undefined, status: undefined });
    expect(out.items[0]!.fields['Designs']).toEqual([
      { id: 'old', link: `https://liveplanner.app/api/images/old?p=${DOC_A}` },
    ]);
  });
});
