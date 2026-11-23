// @vitest-environment jsdom
// The Image Gallery with Pro on (liveworkspace/docs/specs/006-media/media.md "With Pro on"): the storage meter from
// the numbers the list answered, a tier's refusal as the shared notice, the ceiling in place of the app's cap, and
// with Pro off none of it.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MAX_IMAGE_BYTES } from '@liveworkspace/api-schema/image-limits';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Explorer } from '../explorer/Explorer';
import { createFakeIndex } from '../test/fakeClient';
import { appLibraryHosts, uploadRefusal } from './http';
import type { GalleryHost } from './types';
import { UploadLimitError } from './upload-limit-error';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const token = async () => 'tok';
const STORAGE = { used: 312_000_000, limit: 500_000_000, maxImageBytes: 5_000_000, owner: ME };
const png = (size = 8) => new File([new Uint8Array(size)], 'site-plan.png', { type: 'image/png' });

beforeEach(() => {
  setProForTests(true);
  localStorage.clear();
  URL.createObjectURL ??= () => 'blob:x';
  URL.revokeObjectURL ??= () => {};
});
afterEach(() => {
  setProForTests(null);
  vi.unstubAllGlobals();
});

describe('the gallery’s host', () => {
  it('keeps the storage the list answered, and none from a list without one', async () => {
    const answers = [json({ images: [], storage: STORAGE }), json({ images: [] })];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answers.shift()!),
    );
    const gallery = appLibraryHosts('livediagram', { token }).gallery!;
    expect(gallery.storage!()).toBeNull();
    await gallery.list();
    expect(gallery.storage!()).toEqual(STORAGE);
    await gallery.list();
    expect(gallery.storage!()).toBeNull();
  });

  it('throws a tier’s refusal with the limit the server said, and any other refusal as words', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4, height: 3, close() {} }));
    const refusals = [
      json(
        { error: 'file_too_large', limitBytes: 5e6, limit: 5e6, current: 7.2e6, owner: ME },
        413,
      ),
      json({ error: 'gallery_full', reason: 'count', limit: 500, current: 500 }, 403),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => refusals.shift()!),
    );
    const gallery = appLibraryHosts('livediagram', { token }).gallery!;
    const refused = await gallery.upload!(png()).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(UploadLimitError);
    expect((refused as UploadLimitError).limit).toEqual({
      kind: 'too_large',
      limit: 5e6,
      current: 7.2e6,
      owner: ME,
    });
    await expect(gallery.upload!(png())).rejects.toThrow('Your gallery is full.');
  });

  it('lets a file past the app’s cap through to the server, up to what any tier takes', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4, height: 3, close() {} }));
    const send = vi.fn(async () => json({ image: {} }));
    vi.stubGlobal('fetch', send);
    const gallery = appLibraryHosts('livediagram', { token }).gallery!;
    await gallery.upload!(png(MAX_IMAGE_BYTES + 1));
    expect(send).toHaveBeenCalledTimes(1);
    await expect(gallery.upload!(png(25_000_001))).rejects.toThrow('Images can be up to 25 MB.');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('with Pro off keeps the app’s cap and words, and reads no storage', async () => {
    setProForTests(false);
    const send = vi.fn(async () => json({ images: [], storage: STORAGE }));
    vi.stubGlobal('fetch', send);
    const gallery = appLibraryHosts('livediagram', { token }).gallery!;
    await gallery.list();
    expect(gallery.storage!()).toBeNull();
    await expect(gallery.upload!(png(MAX_IMAGE_BYTES + 1))).rejects.toThrow(
      'Images can be up to 10 MB.',
    );
    expect(uploadRefusal(new Error('x'))).toBe('Upload failed.');
  });
});

function host(over: Partial<GalleryHost> = {}): GalleryHost {
  return {
    list: vi.fn(async () => []),
    imageBlob: vi.fn(async () => null),
    remove: vi.fn(async () => {}),
    upload: vi.fn(async () => {}),
    ...over,
  };
}

function page(gallery: GalleryHost, action: 'upgrade' | 'none' = 'upgrade') {
  const { fetcher } = serviceFetch({ owners: { [ME]: ownerView(ME, action) } });
  return render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      <Explorer
        app="livediagram"
        client={createFakeIndex({}).client}
        view={{ kind: 'gallery' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/d/${i.id}`}
        onCreate={vi.fn()}
        heroHidden
        gallery={gallery}
      />
    </SubscriptionProvider>,
  );
}

// The shared notice (the page has other live regions of its own).
const limitNotice = () =>
  waitFor(() => {
    const notice = document.querySelector<HTMLElement>('[data-callout="warning"]');
    if (!notice) throw new Error('no limit notice yet');
    return notice;
  });

describe('the Image Gallery', () => {
  it('shows what the gallery uses of its storage, as the server counted it', async () => {
    page(host({ storage: () => STORAGE }));
    const meter = await screen.findByRole('meter', { name: 'Storage' });
    expect(meter.getAttribute('aria-valuetext')).toBe('312 MB of 500 MB');
  });

  it('shows no meter with Pro off, or from a host with no storage to say', async () => {
    const { unmount } = page(host());
    expect(await screen.findByText('No images yet')).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
    unmount();
    setProForTests(false);
    page(host({ storage: () => STORAGE }));
    expect(await screen.findByText('No images yet')).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('draws a tier’s refusal as the shared notice: Choose Another, and no offer (every tier takes the same)', async () => {
    const upload = vi.fn(async () => {
      throw new UploadLimitError('That image is too large.', {
        kind: 'too_large',
        limit: 5_000_000,
        current: 7_200_000,
        owner: ME,
      });
    });
    page(host({ upload }));
    await screen.findByText('No images yet');
    const input = screen.getByLabelText('Upload an image') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [png()] } });
    const notice = await limitNotice();
    await waitFor(() => expect(notice.textContent).toContain('Free takes images up to 5 MB.'));
    expect(notice.textContent).toContain('This Image Is Over 5 MB');
    // The largest image is the same on every tier: nothing to offer.
    expect(notice.textContent).not.toContain('Pro takes');
    expect(screen.queryByRole('button', { name: /Upgrade|See Pro/ })).toBeNull();
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Another' }));
    expect(click).toHaveBeenCalled();
  });

  it('tells a full gallery to a collaborator with no offer, and no way on it does not need', async () => {
    const upload = vi.fn(async () => {
      throw new UploadLimitError('Your gallery is full.', {
        kind: 'storage_full',
        limit: 500_000_000,
        current: 500_000_000,
        owner: ME,
      });
    });
    page(host({ upload }), 'none');
    await screen.findByText('No images yet');
    fireEvent.change(screen.getByLabelText('Upload an image'), { target: { files: [png()] } });
    const notice = await limitNotice();
    expect(notice.textContent).toContain('Image Storage Is Full');
    expect(notice.textContent).toContain('Your images are all safe. Delete some to upload more.');
    expect(screen.queryByRole('button', { name: /Upgrade|See Pro|Choose Another/ })).toBeNull();
  });
});
