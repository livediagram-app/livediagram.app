// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityOwnPost } from '@liveworkspace/community';
import { testHost } from '../test/host';

// The Share dialog's Community tab (liveworkspace/docs/specs/007-community/community.md "The Share dialog's Community
// tab"): offered only where a post can exist, the password lock only while listed, the publish dialog in place of the
// Share dialog, and nothing at all while the Community is switched off.

const h = vi.hoisted(() => ({
  post: null as CommunityOwnPost | null,
  useCommunityPost: vi.fn(),
}));

vi.mock('./useCommunityPost', () => ({
  useCommunityPost: (opts: unknown) => {
    h.useCommunityPost(opts);
    return { post: h.post, loading: false, error: null, publish: vi.fn(), remove: vi.fn() };
  },
}));
vi.mock('./CommunityGuide', () => ({ CommunityGuide: () => <p>Guide</p> }));
vi.mock('./CommunitySection', () => ({
  CommunityPublicBadge: () => <span>Public</span>,
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

import { useCommunityShareTab, type CommunityShareTabInput } from './useCommunityShareTab';

const host = testHost();

// The Share dialog as a host renders it: the tab's props spread over it, or the publish dialog in its place.
function Share(over: Partial<CommunityShareTabInput>) {
  const tab = useCommunityShareTab({
    host,
    ownerId: 'user_a',
    documentId: 'd1',
    documentName: 'Doc',
    signedIn: true,
    teamDocument: false,
    communityOn: true,
    signInHref: '/sign-in/',
    author: { name: 'Ada', color: '#f97316' },
    ...over,
  });
  if (tab.kind === 'publish') return <>{tab.dialog}</>;
  const p = tab.kind === 'share' ? tab.props : null;
  return (
    <div
      data-testid="share"
      data-locked={p?.passwordLockedReason ?? ''}
      data-public={p?.publicNote ?? ''}
      data-tab={p?.appTab.label ?? ''}
      data-view={p?.initialView ?? ''}
    >
      <span data-testid="badge">{p?.appTab.badge}</span>
      {p?.appTab.panel}
    </div>
  );
}

const post = (state: CommunityOwnPost['state']) => ({ state }) as CommunityOwnPost;

beforeEach(() => {
  h.post = null;
  h.useCommunityPost.mockReset();
});
afterEach(cleanup);

describe('useCommunityShareTab', () => {
  it('reads the post only for a signed-in owner of a personal document', () => {
    render(<Share />);
    expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: true }));
    cleanup();
    for (const over of [{ signedIn: false }, { teamDocument: true }]) {
      render(<Share {...over} />);
      expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }));
      expect(screen.getByTestId('share').dataset.tab).toBe('');
      cleanup();
    }
  });

  it('locks the share password only while the post is listed', () => {
    h.post = post('listed');
    render(<Share />);
    expect(screen.getByTestId('share').dataset.locked).toBe(
      'Remove it from the Community to set a password.',
    );
    cleanup();
    h.post = post('hidden');
    render(<Share />);
    expect(screen.getByTestId('share').dataset.locked).toBe('');
  });

  it('says the document is public on the status line only while the post is listed', () => {
    h.post = post('listed');
    render(<Share />);
    expect(screen.getByTestId('share').dataset.public).toBe(
      'in the Community, where anyone can find it, view it and make a copy.',
    );
    cleanup();
    for (const state of ['hidden', null] as const) {
      h.post = state ? post(state) : null;
      render(<Share />);
      expect(screen.getByTestId('share').dataset.public).toBe('');
      cleanup();
    }
  });

  it('gives the Share dialog a Community tab: the guide, then the section, Public while listed', () => {
    h.post = post('listed');
    render(<Share />);
    expect(screen.getByTestId('share').dataset.tab).toBe('Community');
    expect(screen.getByText('Guide')).toBeTruthy();
    expect(screen.getByTestId('badge').textContent).toBe('Public');
    cleanup();
    h.post = post('hidden');
    render(<Share />);
    expect(screen.getByTestId('badge').textContent).toBe('');
  });

  it('swaps in the publish dialog, and comes back to the Share dialog on its Community tab after', () => {
    render(<Share />);
    expect(screen.getByTestId('share').dataset.view).toBe('passes');
    fireEvent.click(screen.getByRole('button', { name: 'Share to Community' }));
    expect(screen.queryByTestId('share')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publish dialog' }));
    expect(screen.getByTestId('share').dataset.view).toBe('app');
  });

  it('hands the section an empty first tab, which holds Share to Community', () => {
    render(<Share firstTabEmpty />);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Share to Community' }).disabled,
    ).toBe(true);
    cleanup();
    render(<Share />);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Share to Community' }).disabled,
    ).toBe(false);
  });

  it('offers nothing while the Community is switched off', () => {
    h.post = post('listed');
    render(<Share communityOn={false} />);
    expect(screen.getByTestId('share').dataset.locked).toBe('');
    expect(screen.queryByRole('button', { name: 'Share to Community' })).toBeNull();
    expect(h.useCommunityPost).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }));
  });
});
