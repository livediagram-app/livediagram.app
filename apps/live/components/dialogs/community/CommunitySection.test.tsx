// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommunityOwnPost } from '@livediagram/api-schema';
import { CommunitySection } from './CommunitySection';

afterEach(cleanup);

const post = (state: CommunityOwnPost['state']): CommunityOwnPost => ({
  id: 'p1',
  title: 'Payments platform',
  description: 'How our payment services talk to each other.',
  category: 'architecture',
  tags: [],
  likeCount: 3,
  copyCount: 1,
  publishedAt: 1,
  updatedAt: 1,
  shareCode: 'CODE1',
  author: { name: 'Ada', color: '#f97316', picture: null },
  anonymous: false,
  liked: false,
  state,
});

function renderSection(state: CommunityOwnPost['state']) {
  render(
    <CommunitySection
      signedIn
      signInHref="/sign-in/"
      teamDocument={false}
      sharePassword={null}
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
