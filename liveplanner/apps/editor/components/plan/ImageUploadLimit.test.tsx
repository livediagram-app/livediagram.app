// @vitest-environment jsdom
// docs/specs/026-plan/item-types.md "Image fields", "With Pro on": an upload the server refuses for a tier's limit
// draws the kit's notice under the control, in the server's numbers, with the offer for whoever may take it; with Pro
// off the control says its plain line and its 10 MB hint, as it always did.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';

const api = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api/images', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/images')>('@/lib/api/images');
  return { ...actual, apiUploadImage: api.upload, apiImageUrl: async () => null };
});
vi.mock('./PlanContext', () => ({
  usePlan: () => ({ itemsScope: { ownerId: 'user_ada', projectId: 'p1', shareCode: null } }),
}));

import { ImageUploadError } from '@/lib/api/images';
import { ImageFieldControl } from './ImageField';

proOnForTests();
beforeEach(() => {
  api.upload.mockReset();
});
afterEach(cleanup);

// Thrown as the upload is asked for, as the client throws.
const refuses = (failure: () => Error) =>
  api.upload.mockImplementation(async () => {
    throw failure();
  });

const FREE = 5_000_000;
const refusal = (who: Who, kind: 'too_large' | 'storage_full') =>
  new ImageUploadError(
    kind === 'too_large' ? 'file_too_large' : 'gallery_full',
    'the plain sentence',
    {
      kind,
      limit: kind === 'too_large' ? FREE : 500_000_000,
      current: 7_000_000,
      owner: ownerOf(who),
    },
  );

function field(who: Who | null) {
  const control = (
    <ImageFieldControl id="f" label="Design" value={undefined} disabled={false} onSave={vi.fn()} />
  );
  const view = render(who ? withPro(control, proService(who).fetcher) : control);
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const pick = async () => {
    await act(async () => {
      fireEvent.change(input, {
        target: { files: [new File([new Uint8Array(4)], 'big.png', { type: 'image/png' })] },
      });
    });
  };
  return { view, input, pick };
}

describe('an upload over the tier’s limit, Pro on', () => {
  it('shows the owner the notice with the server’s limit, and Choose Another', async () => {
    refuses(() => refusal('owner', 'too_large'));
    const { input, pick } = field('owner');
    // The hint names no size: the limit is the server's to say.
    expect(screen.getByText('PNG, JPEG, WebP or GIF')).toBeTruthy();
    await pick();
    expect(await screen.findByText('This Image Is Over 5 MB')).toBeTruthy();
    expect(await screen.findByText('Free takes images up to 5 MB.')).toBeTruthy();
    // The largest image is the same on every tier: nothing to offer.
    expect(screen.queryByText(/Pro takes/)).toBeNull();
    // The plain sentence is not said twice.
    expect(screen.queryByText('the plain sentence')).toBeNull();
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Another' }));
    expect(click).toHaveBeenCalled();
  });

  it('tells a collaborator the limit and offers them nothing', async () => {
    refuses(() => refusal('collaborator', 'too_large'));
    const { pick } = field('collaborator');
    await pick();
    expect(await screen.findByText('This Image Is Over 5 MB')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Images here can be up to 5 MB\./)).toBeTruthy());
    expect(screen.queryByText(/Pro takes/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose Another' })).toBeTruthy();
  });

  it('says storage is full, with no Choose Another', async () => {
    refuses(() => refusal('owner', 'storage_full'));
    const { pick } = field('owner');
    await pick();
    expect(await screen.findByText('Image Storage Is Full')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose Another' })).toBeNull();
  });

  it('clears the notice when another file is picked', async () => {
    api.upload.mockRejectedValueOnce(refusal('owner', 'too_large'));
    api.upload.mockResolvedValueOnce({ image: { id: 'img-1' }, deduped: false });
    const { pick } = field('owner');
    await pick();
    expect(await screen.findByText('This Image Is Over 5 MB')).toBeTruthy();
    await pick();
    expect(screen.queryByText('This Image Is Over 5 MB')).toBeNull();
  });
});

describe('with Pro off', () => {
  it('keeps the 10 MB hint and the plain line, and draws no notice', async () => {
    setProForTests(false);
    refuses(() => new ImageUploadError('file_too_large'));
    const { pick } = field(null);
    expect(screen.getByText('PNG, JPEG, WebP or GIF, up to 10 MB')).toBeTruthy();
    await pick();
    expect(screen.getByRole('alert').textContent).toBe('That image is over 10 MB.');
    expect(screen.queryByText(/This Image Is Over/)).toBeNull();
  });
});
