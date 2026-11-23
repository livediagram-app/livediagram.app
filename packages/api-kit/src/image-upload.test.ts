// An app api's side of an image upload with Pro on (media.md "With Pro on").
import { IMAGE_UPLOAD_CEILING_BYTES, MAX_IMAGE_BYTES } from '@liveworkspace/media';
import { limitsFor, type OwnerScope, type Tier } from '@liveworkspace/subscription';
import { describe, expect, it, vi } from 'vitest';
import {
  galleryStorageOf,
  imageGateBytes,
  imageUploadAllowance,
  leavesImageUploadUnread,
  readImageUpload,
  type UploadItemGrant,
} from './image-upload';

const ON = { PRO_ENABLED: 'true' };
const OFF = { PRO_ENABLED: 'false' };

// Each test's own people: the entitlement cache is the isolate's.
let serial = 0;
const person = () => `user_up${++serial}`;

function service(tiers: Record<string, Tier> = {}) {
  const asked: string[] = [];
  return {
    asked,
    env: {
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'k',
      SUBSCRIPTION: {
        fetch: async (_input: string, init?: RequestInit) => {
          const { owner } = JSON.parse(init?.body as string) as { owner: OwnerScope };
          asked.push(owner);
          const tier = tiers[owner] ?? 'free';
          return Response.json({ owner, tier, seats: 3, limits: limitsFor(tier, 3) });
        },
      },
    },
  };
}

const grant = (over: Partial<UploadItemGrant> = {}): UploadItemGrant => ({
  level: 'edit',
  team: 'team_garden',
  owner: 'user_host',
  ...over,
});

describe('the gate', () => {
  it('bounds an image route at the legacy cap with Pro off and the top tier’s with it on', () => {
    expect(imageGateBytes({})).toBe(MAX_IMAGE_BYTES);
    expect(imageGateBytes(OFF)).toBe(MAX_IMAGE_BYTES);
    expect(imageGateBytes(ON)).toBe(IMAGE_UPLOAD_CEILING_BYTES);
  });

  it('leaves only an upload unread, and only with Pro on', () => {
    expect(leavesImageUploadUnread(ON, 'POST', ['api', 'images'])).toBe(true);
    expect(leavesImageUploadUnread(OFF, 'POST', ['api', 'images'])).toBe(false);
    expect(leavesImageUploadUnread({}, 'POST', ['api', 'images'])).toBe(false);
    expect(leavesImageUploadUnread(ON, 'POST', ['api', 'images', 'grants'])).toBe(false);
    expect(leavesImageUploadUnread(ON, 'PUT', ['api', 'images'])).toBe(false);
    expect(leavesImageUploadUnread(ON, 'POST', ['api', 'documents'])).toBe(false);
  });
});

describe('imageUploadAllowance', () => {
  it('is the legacy cap with Pro off, without reading the grant or asking the service', async () => {
    const itemGrant = vi.fn(async () => grant());
    const { env, asked } = service();
    const allowance = await imageUploadAllowance(
      { ...env, PRO_ENABLED: '' },
      'livediagram.app',
      person(),
      itemGrant,
    );
    expect(allowance).toEqual({
      pro: false,
      maxBytes: MAX_IMAGE_BYTES,
      itemOwner: null,
      owner: null,
    });
    expect(itemGrant).not.toHaveBeenCalled();
    expect(asked).toEqual([]);
  });

  it('is Free’s for a Free person uploading for no item', async () => {
    const { env } = service();
    const uploader = person();
    expect(await imageUploadAllowance(env, 'livediagram.app', uploader, async () => null)).toEqual({
      pro: true,
      maxBytes: 5_000_000,
      itemOwner: null,
      owner: `p:${uploader}`,
    });
  });

  it('is the team’s in a Pro for Teams item they may add to', async () => {
    const { env } = service({ 't:team_garden': 'team' });
    for (const level of ['edit', 'participate'] as const) {
      const allowance = await imageUploadAllowance(env, 'livediagram.app', person(), async () =>
        grant({ level }),
      );
      expect(allowance).toMatchObject({
        maxBytes: 25_000_000,
        itemOwner: 't:team_garden',
        owner: 't:team_garden',
      });
    }
  });

  it('lends nothing from an item they can only view, or one in the Trash', async () => {
    const { env } = service({ 't:team_garden': 'team' });
    for (const held of [grant({ level: 'view' }), grant({ trashed: true })]) {
      const allowance = await imageUploadAllowance(
        env,
        'livediagram.app',
        person(),
        async () => held,
      );
      expect(allowance).toMatchObject({ maxBytes: 5_000_000, itemOwner: null });
    }
  });

  it('lends the owner’s Largest Image only on a grant to add to the item: an Editor’s or a Participant’s', async () => {
    // A Community post's public link is always `view` (the index refuses any other level for one), so a visitor from
    // the Community, like any viewer by link, is lent nothing. A link the owner made to edit or take part is the
    // owner's own grant, and lends the size for uploads into that item.
    const { env } = service({ 't:team_garden': 'team' });
    const lent = async (level: 'view' | 'participate' | 'edit') =>
      (await imageUploadAllowance(env, 'livediagram.app', person(), async () => grant({ level })))
        .maxBytes;
    expect(await lent('view')).toBe(5_000_000);
    expect(await lent('participate')).toBe(25_000_000);
    expect(await lent('edit')).toBe(25_000_000);
    // No grant at all (the item is not theirs to open): nothing.
    const none = await imageUploadAllowance(env, 'livediagram.app', person(), async () => null);
    expect(none).toMatchObject({ maxBytes: 5_000_000, itemOwner: null });
  });

  it('names a person’s item by its owner', async () => {
    const { env } = service({ 'p:user_host': 'pro' });
    const allowance = await imageUploadAllowance(env, 'livediagram.app', person(), async () =>
      grant({ team: null }),
    );
    expect(allowance).toMatchObject({ maxBytes: 25_000_000, itemOwner: 'p:user_host' });
  });
});

describe('readImageUpload', () => {
  const upload = (bytes: Uint8Array) =>
    new Request('https://app.test/api/images', { method: 'POST', body: bytes });

  it('reads the body whole with Pro off, refusing one over the cap', async () => {
    const taken = await readImageUpload(upload(new Uint8Array(8)), { pro: false, maxBytes: 8 });
    expect(taken?.byteLength).toBe(8);
    expect(
      await readImageUpload(upload(new Uint8Array(9)), { pro: false, maxBytes: 8 }),
    ).toBeNull();
  });

  it('stops reading at the limit with Pro on', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled += 1;
          controller.enqueue(new Uint8Array(4));
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request('https://app.test/api/images', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);
    expect(await readImageUpload(request, { pro: true, maxBytes: 10 })).toBeNull();
    // Three chunks pass ten bytes; the rest of the stream is never asked for.
    expect(pulled).toBe(3);
  });

  it('hands on the bytes it read with Pro on, one chunk or many, and nothing for no body', async () => {
    const one = await readImageUpload(upload(new Uint8Array([1, 2, 3])), {
      pro: true,
      maxBytes: 8,
    });
    expect([...new Uint8Array(one!)]).toEqual([1, 2, 3]);
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3])];
    const many = new Request('https://app.test/api/images', {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          const next = chunks.shift();
          if (next) controller.enqueue(next);
          else controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);
    expect([...new Uint8Array((await readImageUpload(many, { pro: true, maxBytes: 8 }))!)]).toEqual(
      [1, 2, 3],
    );
    // A view into a larger buffer comes back as its own bytes alone.
    const view = new Uint8Array([9, 9, 1, 2, 9]).subarray(2, 4);
    const sliced = new Request('https://app.test/api/images', {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(view);
          controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);
    expect([
      ...new Uint8Array((await readImageUpload(sliced, { pro: true, maxBytes: 8 }))!),
    ]).toEqual([1, 2]);
    const empty = new Request('https://app.test/api/images', { method: 'POST' });
    expect((await readImageUpload(empty, { pro: true, maxBytes: 8 }))?.byteLength).toBe(0);
  });
});

describe('galleryStorageOf', () => {
  it('passes the service’s storage on with Pro on, and nothing with it off', () => {
    const storage = { used: 1, limit: 2, maxImageBytes: 3, owner: 'p:user_a' };
    expect(galleryStorageOf({ images: [], storage })).toEqual({ storage });
    expect(galleryStorageOf({ images: [] })).toEqual({});
  });
});
