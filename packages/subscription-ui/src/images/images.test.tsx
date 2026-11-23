// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOwnerView } from '../provider/hooks';
import { GARDEN, ME, ownerView, serviceFetch, setProForTests, withProvider } from '../test/fixture';
import { ImageLimitNotice } from './ImageLimitNotice';
import {
  IMAGE_UPLOAD_CEILING_BYTES,
  imageCeilingLabel,
  imageLimitRefusalOf,
  imageLimitSentence,
  imageSizeHint,
  imageStorageOf,
  imageTooLargeSentence,
  imageUploadCeiling,
  imageUploadQuery,
  type ImageLimitRefusal,
} from './image-limits';

// media.md "With Pro on": what an editor says when an upload meets a tier's limit. The owner sees the offer, a
// collaborator the limit alone, and with Pro off none of it is read or drawn.

const TOO_LARGE: ImageLimitRefusal = {
  kind: 'too_large',
  limit: 5_000_000,
  current: 7_200_000,
  owner: ME,
};
const FULL: ImageLimitRefusal = {
  kind: 'storage_full',
  limit: 500_000_000,
  current: 499_999_000,
  owner: ME,
};

function page(node: React.ReactNode, action: 'upgrade' | 'ask_admin' | 'none', scope = ME) {
  const { fetcher } = serviceFetch({ owners: { [scope]: ownerView(scope, action) } });
  return withProvider(node, fetcher);
}

describe('reading the server’s refusal', () => {
  it('reads a tier’s limit from the refusal, as an object or its JSON text', () => {
    const body = {
      error: 'file_too_large',
      limitBytes: 5_000_000,
      limit: 5_000_000,
      current: 7_200_000,
      owner: ME,
    };
    expect(imageLimitRefusalOf(body)).toEqual(TOO_LARGE);
    expect(imageLimitRefusalOf(JSON.stringify(body))).toEqual(TOO_LARGE);
    expect(
      imageLimitRefusalOf({
        error: 'gallery_full',
        reason: 'bytes',
        limit: 500_000_000,
        current: 499_999_000,
        owner: ME,
      }),
    ).toEqual(FULL);
    // A guest's refusal names nobody to offer to, and a body cut off at the limit has no size.
    expect(imageLimitRefusalOf({ error: 'file_too_large', limit: 5_000_000, owner: null })).toEqual(
      {
        kind: 'too_large',
        limit: 5_000_000,
        current: null,
        owner: null,
      },
    );
  });

  it('is nothing for a refusal from a server with Pro off, any other refusal, or text that is not JSON', () => {
    expect(imageLimitRefusalOf({ error: 'file_too_large', limitBytes: 10_485_760 })).toBeNull();
    expect(
      imageLimitRefusalOf({ error: 'gallery_full', reason: 'count', limit: 500, current: 500 }),
    ).toBeNull();
    expect(
      imageLimitRefusalOf({ error: 'gallery_full', reason: 'count', limit: 500, owner: ME }),
    ).toBeNull();
    expect(imageLimitRefusalOf({ error: 'unsupported_type', limit: 1, owner: ME })).toBeNull();
    expect(imageLimitRefusalOf('api 500: oops')).toBeNull();
    expect(imageLimitRefusalOf(null)).toBeNull();
    expect(imageLimitRefusalOf('"text"')).toBeNull();
  });

  it('reads the gallery’s storage, and nothing from an answer without one', () => {
    const storage = { used: 312_000_000, limit: 500_000_000, maxImageBytes: 5_000_000, owner: ME };
    expect(imageStorageOf(storage)).toEqual(storage);
    expect(imageStorageOf({ ...storage, owner: 'someone' })).toEqual({ ...storage, owner: null });
    expect(imageStorageOf(undefined)).toBeNull();
    expect(imageStorageOf({ used: 1 })).toBeNull();
  });

  it('with Pro off reads nothing, keeps the app’s own cap and its own hint', () => {
    setProForTests(false);
    expect(
      imageLimitRefusalOf({ error: 'file_too_large', limit: 5_000_000, owner: ME }),
    ).toBeNull();
    expect(imageStorageOf({ used: 1, limit: 2, maxImageBytes: 3, owner: ME })).toBeNull();
    expect(imageUploadCeiling(10 * 1024 * 1024)).toBe(10 * 1024 * 1024);
    expect(imageSizeHint('PNG, JPEG, WebP or GIF', 10, 5_000_000)).toBe(
      'PNG, JPEG, WebP or GIF up to 10 MB',
    );
    setProForTests(true);
  });

  it('with Pro on lets a picked file through to the ceiling, and words the size the server said', () => {
    expect(IMAGE_UPLOAD_CEILING_BYTES).toBe(25_000_000);
    expect(imageUploadCeiling(10 * 1024 * 1024)).toBe(25_000_000);
    expect(imageSizeHint('PNG, JPEG, WebP or GIF', 10, 5_000_000)).toBe(
      'PNG, JPEG, WebP or GIF up to 5 MB',
    );
    expect(imageSizeHint('PNG, JPEG, WebP or GIF', 10)).toBe('PNG, JPEG, WebP or GIF');
  });
});

describe('what an editor says and sends', () => {
  it('names the item an upload is for, and the ceiling, only with Pro on', () => {
    expect(imageUploadQuery('doc 1')).toBe('?d=doc%201');
    expect(imageUploadQuery(null)).toBe('');
    expect(imageCeilingLabel(10)).toBe('25 MB');
    setProForTests(false);
    expect(imageUploadQuery('doc-1')).toBe('');
    expect(imageCeilingLabel(10)).toBe('10 MB');
    setProForTests(true);
  });

  it('says a file over the ceiling is over what any tier takes, and keeps the old words with Pro off', () => {
    expect(imageTooLargeSentence(10)).toBe(
      'That image is over 25 MB, the largest that can be uploaded.',
    );
    setProForTests(false);
    expect(imageTooLargeSentence(10)).toBe('Too large. Limit is 10 MB.');
    setProForTests(true);
  });

  it('says a tier’s refusal in one plain sentence, with the server’s number and no offer', () => {
    expect(imageLimitSentence(TOO_LARGE)).toBe(
      'This image is over 5 MB, the largest that can be uploaded here.',
    );
    expect(imageLimitSentence(FULL)).toBe(
      'Image storage is full. Delete some images to upload more.',
    );
  });
});

describe('ImageLimitNotice: an image over the largest', () => {
  it('the owner: the limit, what Pro takes, Choose Another and See Pro', async () => {
    const again = vi.fn();
    render(page(<ImageLimitNotice refusal={TOO_LARGE} onChooseAnother={again} />, 'upgrade'));
    const notice = screen.getByRole('status');
    await waitFor(() => expect(notice.textContent).toContain('Pro takes 25 MB.'));
    expect(notice.textContent).toContain('This Image Is Over 5 MB');
    expect(notice.textContent).toContain('Free takes images up to 5 MB.');
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Choose Another',
      'See Pro',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Another' }));
    expect(again).toHaveBeenCalled();
  });

  it('a collaborator: the limit and Choose Another, with no offer', async () => {
    render(page(<ImageLimitNotice refusal={TOO_LARGE} onChooseAnother={() => {}} />, 'none'));
    const notice = screen.getByRole('status');
    await waitFor(() => expect(notice.textContent).toContain('Free takes images up to 5 MB.'));
    expect(notice.textContent).not.toContain('Pro takes');
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Choose Another']);
  });

  it('while the owner is not known, a guest, and someone already on the top limit: the limit alone', () => {
    const { rerender } = render(<ImageLimitNotice refusal={{ ...TOO_LARGE, owner: null }} />);
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('This Image Is Over 5 MB');
    expect(notice.textContent).toContain('Images here can be up to 5 MB.');
    expect(screen.queryByRole('button')).toBeNull();
    function OnPro() {
      const owner = useOwnerView(ME);
      void owner;
      return <ImageLimitNotice refusal={{ ...TOO_LARGE, limit: 25_000_000, current: null }} />;
    }
    rerender(
      withProvider(
        <OnPro />,
        serviceFetch({ owners: { [ME]: ownerView(ME, 'upgrade', 'pro') } }).fetcher,
      ),
    );
    expect(screen.getByRole('status').textContent).not.toContain('Pro takes');
  });
});

describe('ImageLimitNotice: storage full', () => {
  it('the owner: what Pro stores, Upgrade to Pro and Manage Images', async () => {
    const manage = vi.fn();
    render(page(<ImageLimitNotice refusal={FULL} onManageImages={manage} />, 'upgrade'));
    const notice = screen.getByRole('status');
    await waitFor(() =>
      expect(notice.textContent).toContain(
        'Your images are all safe. Delete some to upload more, or get 50 GB with Pro.',
      ),
    );
    expect(notice.textContent).toContain('Image Storage Is Full');
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Upgrade to Pro',
      'Manage Images',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Manage Images' }));
    expect(manage).toHaveBeenCalled();
  });

  it('a team’s admin is offered what Pro for Teams stores', async () => {
    render(page(<ImageLimitNotice refusal={{ ...FULL, owner: GARDEN }} />, 'upgrade', GARDEN));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('or get 250 GB with Pro for Teams.'),
    );
    expect(screen.getByRole('button', { name: 'Upgrade Team' })).toBeTruthy();
  });

  it('a collaborator and a team’s member: the limit, Manage Images, and no offer of their own', async () => {
    const { unmount } = render(
      page(<ImageLimitNotice refusal={FULL} onManageImages={() => {}} />, 'none'),
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Your images are all safe. Delete some to upload more.');
    expect(notice.textContent).not.toContain('with Pro');
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Manage Images']);
    unmount();
    render(page(<ImageLimitNotice refusal={{ ...FULL, owner: GARDEN }} />, 'ask_admin', GARDEN));
    expect(await screen.findByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).not.toContain('or get');
  });

  it('is nothing with Pro off', () => {
    setProForTests(false);
    const { container } = render(<ImageLimitNotice refusal={FULL} />);
    expect(container.innerHTML).toBe('');
    setProForTests(true);
  });
});
