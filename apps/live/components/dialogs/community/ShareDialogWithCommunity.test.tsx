// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityOwnPost } from '@livediagram/api-schema';

// The Share dialog's Community wiring (docs/specs/025-community/community.md "Publishing", "Turning the Community
// off"): the section only where a post can exist, the password lock only while listed, the publish dialog in place
// of the Share dialog, and nothing at all while the Community is switched off.

const h = vi.hoisted(() => ({
  enabled: true,
  post: null as CommunityOwnPost | null,
  useCommunityPost: vi.fn(),
}));

vi.mock('@livediagram/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livediagram/ui')>()),
  useCommunityEnabled: () => h.enabled,
}));
vi.mock('@/hooks/persistence/useCommunityPost', () => ({
  useCommunityPost: (opts: unknown) => {
    h.useCommunityPost(opts);
    return { post: h.post, loading: false, error: null, publish: vi.fn(), remove: vi.fn() };
  },
}));
vi.mock('@/hooks/persistence/usePublishedPicture', () => ({ usePublishedPicture: () => null }));
vi.mock('@/components/dialogs/ShareDialog', () => ({
  ShareDialog: (p: {
    passwordLockedReason?: string | null;
    communityListed?: boolean;
    community?: ReactNode;
  }) => (
    <div
      data-testid="share"
      data-locked={p.passwordLockedReason ?? ''}
      data-listed={String(!!p.communityListed)}
    >
      {p.community}
    </div>
  ),
}));
vi.mock('./CommunitySection', () => ({
  CommunitySection: (p: { onPublish: () => void }) => (
    <button type="button" onClick={p.onPublish}>
      Share to Community
    </button>
  ),
}));
vi.mock('./CommunityPublishDialog', () => ({
  CommunityPublishDialog: (p: { onClose: () => void }) => (
    <button type="button" onClick={p.onClose}>
      Publish dialog
    </button>
  ),
}));

import { ShareDialogWithCommunity } from './ShareDialogWithCommunity';

const post = (state: CommunityOwnPost['state']) => ({ state }) as CommunityOwnPost;

function renderDialog(
  over: { signedIn?: boolean; teamDocument?: boolean; offline?: boolean } = {},
) {
  const props = {
    participant: { id: 'user_a', name: 'Ada', color: '#f97316' },
    offline: over.offline ?? false,
    sharePasswordSet: false,
    lockedName: null,
  } as unknown as Parameters<typeof ShareDialogWithCommunity>[0];
  render(
    <ShareDialogWithCommunity
      {...props}
      documentId="d1"
      documentName="Doc"
      signedIn={over.signedIn ?? true}
      teamDocument={over.teamDocument ?? false}
    />,
  );
}

beforeEach(() => {
  h.enabled = true;
  h.post = null;
  h.useCommunityPost.mockReset();
});
afterEach(cleanup);

describe('ShareDialogWithCommunity', () => {
  it('reads the post only for a signed-in owner of a personal, cloud document', () => {
    renderDialog();
    expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: true }));
    cleanup();
    for (const over of [{ signedIn: false }, { teamDocument: true }, { offline: true }]) {
      renderDialog(over);
      expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }));
      cleanup();
    }
  });

  it('locks the share password, and says Public, only while the post is listed', () => {
    h.post = post('listed');
    renderDialog();
    expect(screen.getByTestId('share').dataset.locked).toBe(
      'Remove it from the Community to set a password.',
    );
    expect(screen.getByTestId('share').dataset.listed).toBe('true');
    cleanup();
    h.post = post('hidden');
    renderDialog();
    expect(screen.getByTestId('share').dataset.locked).toBe('');
    expect(screen.getByTestId('share').dataset.listed).toBe('false');
  });

  it('swaps in the publish dialog, and comes back to the Share dialog after', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Share to Community' }));
    expect(screen.queryByTestId('share')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publish dialog' }));
    expect(screen.getByTestId('share')).toBeTruthy();
  });

  it('is the plain Share dialog while the Community is switched off', () => {
    h.enabled = false;
    h.post = post('listed');
    renderDialog();
    expect(screen.getByTestId('share').dataset.locked).toBe('');
    expect(screen.queryByRole('button', { name: 'Share to Community' })).toBeNull();
    expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }));
  });
});
