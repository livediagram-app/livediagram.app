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
vi.mock('@liveworkspace/explorer', () => ({
  ShareDialog: (p: {
    passwordLockedReason?: string | null;
    publicNote?: string | null;
    appSection?: ReactNode;
  }) => (
    <div
      data-testid="share"
      data-locked={p.passwordLockedReason ?? ''}
      data-public={p.publicNote ?? ''}
    >
      {p.appSection}
    </div>
  ),
}));
vi.mock('@/lib/index-client', () => ({
  indexClient: { listShareLinks: async () => ({ links: [], passwordSet: false }) },
}));
vi.mock('./CommunitySection', () => ({
  CommunitySection: (p: { onPublish: () => void; firstTabEmpty?: boolean }) => (
    <button type="button" onClick={p.onPublish} disabled={!!p.firstTabEmpty}>
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
  over: {
    signedIn?: boolean;
    teamDocument?: boolean;
    firstTabEmpty?: boolean;
  } = {},
) {
  const share = {
    client: {},
    item: {
      id: 'd1',
      app: 'livediagram',
      kind: 'canvas',
      sharedVia: null,
      title: 'Doc',
      teamId: over.teamDocument ? 't1' : null,
    },
    shareUrl: () => '',
    onClose: () => {},
  } as unknown as Parameters<typeof ShareDialogWithCommunity>[0];
  render(
    <ShareDialogWithCommunity
      {...share}
      ownerId="user_a"
      documentName="Doc"
      author={{ name: 'Ada', color: '#f97316' }}
      signedIn={over.signedIn ?? true}
      firstTabEmpty={over.firstTabEmpty}
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
  it('reads the post only for a signed-in owner of a personal canvas', () => {
    renderDialog();
    expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: true }));
    cleanup();
    for (const over of [{ signedIn: false }, { teamDocument: true }]) {
      renderDialog(over);
      expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }));
      cleanup();
    }
  });

  it('locks the share password only while the post is listed', () => {
    h.post = post('listed');
    renderDialog();
    expect(screen.getByTestId('share').dataset.locked).toBe(
      'Remove it from the Community to set a password.',
    );
    cleanup();
    h.post = post('hidden');
    renderDialog();
    expect(screen.getByTestId('share').dataset.locked).toBe('');
  });

  it('says the canvas is public on the status line only while the post is listed', () => {
    h.post = post('listed');
    renderDialog();
    expect(screen.getByTestId('share').dataset.public).toBe(
      'in the Community, where anyone can find it, view it and make a copy.',
    );
    cleanup();
    for (const state of ['hidden', null] as const) {
      h.post = state ? post(state) : null;
      renderDialog();
      expect(screen.getByTestId('share').dataset.public).toBe('');
      cleanup();
    }
  });

  it('swaps in the publish dialog, and comes back to the Share dialog after', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Share to Community' }));
    expect(screen.queryByTestId('share')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publish dialog' }));
    expect(screen.getByTestId('share')).toBeTruthy();
  });

  it('hands the Community section an empty first tab, which holds Share to Community', () => {
    renderDialog({ firstTabEmpty: true });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Share to Community' }).disabled,
    ).toBe(true);
    cleanup();
    renderDialog();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Share to Community' }).disabled,
    ).toBe(false);
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
