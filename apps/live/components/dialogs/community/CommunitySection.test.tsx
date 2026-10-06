// @vitest-environment jsdom
import { communityPostFixture } from '@livediagram/api-schema/testing';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommunityOwnPost } from '@livediagram/api-schema';
import { CommunitySection } from './CommunitySection';

afterEach(cleanup);

const post = (state: CommunityOwnPost['state']): CommunityOwnPost => ({
  ...communityPostFixture({ id: 'p1', title: 'Payments platform', likeCount: 3, copyCount: 1 }),
  state,
});

function renderSection(state: CommunityOwnPost['state']) {
  render(
    <CommunitySection
      signedIn
      signInHref="/sign-in/"
      teamDocument={false}
      sharePasswordSet={false}
      post={post(state)}
      loading={false}
      error={null}
      onPublish={vi.fn()}
      onEdit={vi.fn()}
      onRemove={vi.fn(async () => {})}
    />,
  );
}

// docs/specs/025-community/community.md "Reports and moderation": a post hidden by reports is final.
describe('CommunitySection', () => {
  it('offers Edit Listing and Remove for a listed post', () => {
    renderSection('listed');
    expect(screen.getByRole('button', { name: 'Edit Listing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove From Community' })).toBeTruthy();
  });

  it('says a hidden post is hidden for good, and offers nothing to change it', () => {
    renderSection('hidden');
    expect(screen.getByText(/Hidden after reports\./)).toBeTruthy();
    expect(screen.getByText(/can no longer be changed or removed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Listing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove From Community' })).toBeNull();
  });
});

describe('CommunitySection, every face', () => {
  type Over = Partial<Parameters<typeof CommunitySection>[0]>;
  const base = (over: Over = {}) => ({
    signedIn: true,
    signInHref: '/sign-in/?redirect_url=%2Fdocument%2Fd1',
    teamDocument: false,
    sharePasswordSet: false,
    post: null,
    loading: false,
    error: null,
    onPublish: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(async () => {}),
    ...over,
  });

  it('asks a guest to sign in, and tells a team document it cannot be shared', () => {
    render(<CommunitySection {...base({ signedIn: false })} />);
    // Named by its heading word alone, not the help link beside it.
    expect(screen.getByRole('region', { name: 'Community' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In to Share' }).getAttribute('href')).toBe(
      '/sign-in/?redirect_url=%2Fdocument%2Fd1',
    );
    cleanup();
    render(<CommunitySection {...base({ teamDocument: true })} />);
    expect(
      screen.getByText(/Team library documents can.t be shared to the Community\./),
    ).toBeTruthy();
  });

  it('shows loading, then a failed read in words', () => {
    render(<CommunitySection {...base({ loading: true })} />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    cleanup();
    render(
      <CommunitySection {...base({ error: "We couldn't reach the Community. Try again." })} />,
    );
    expect(screen.getByText("We couldn't reach the Community. Try again.")).toBeTruthy();
  });

  it('says the Community is public, and holds Share to Community while a password is set', () => {
    const onPublish = vi.fn();
    render(<CommunitySection {...base({ onPublish })} />);
    expect(screen.getByText('public')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Share to Community' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    cleanup();
    render(<CommunitySection {...base({ sharePasswordSet: true })} />);
    expect(
      (screen.getByRole('button', { name: 'Share to Community' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      screen.getByText('Remove the share password to share it to the Community.'),
    ).toBeTruthy();
  });

  it('asks once before removing a listed post, and Keep It changes nothing', async () => {
    const onRemove = vi.fn(async () => {});
    const onEdit = vi.fn();
    render(<CommunitySection {...base({ post: post('listed'), onRemove, onEdit })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Listing' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove From Community' }));
    // Focus follows the swap: into the question, and back to Remove From Community on Keep It.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep It' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep It' }));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Remove From Community' }),
    );
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove From Community' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
  });
});
