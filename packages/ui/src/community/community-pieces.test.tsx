// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CommunityPost } from '@livediagram/api-schema';
import { clerkPublishableKeyOrNull } from '../clerk-key';
import { CommunityAuthorBadge, communityAuthorInitial } from './CommunityAuthorBadge';
import { CommunityCopyCount, CommunityLikeCount } from './CommunityCounts';
import { CommunityPostTile } from './CommunityPostTile';
import { CommunityPostTileSkeleton } from './CommunityPostTileSkeleton';
import { formatCommunityCount } from './format-count';

// The Community's shared pieces (docs/specs/025-community/community.md "Gallery"), as the Community app, the landing
// page and the editor's publish preview all draw them.

afterEach(cleanup);

const NOW = Date.UTC(2026, 9, 5, 12);
const post: CommunityPost = {
  id: 'post1',
  title: 'Payments Platform',
  description: 'How payments flow.',
  category: 'architecture',
  tags: ['aws', 'event-driven', 'payments', 'fourth'],
  likeCount: 1200,
  copyCount: 1,
  publishedAt: NOW - 2 * 24 * 60 * 60 * 1000,
  updatedAt: NOW,
  shareCode: 'CODE1',
  author: { name: 'ada lovelace', color: '#f97316', picture: null },
  anonymous: false,
  liked: false,
};

describe('CommunityPostTile', () => {
  it('opens its post from the whole card, with the image, category, three tags, author and when', () => {
    render(<CommunityPostTile post={post} href="/post/?id=post1" imageUrl="/img.svg" now={NOW} />);
    expect(screen.getByRole('link', { name: 'Payments Platform' }).getAttribute('href')).toBe(
      '/post/?id=post1',
    );
    expect(screen.getByRole('img', { name: 'Payments Platform' }).getAttribute('src')).toBe(
      '/img.svg',
    );
    expect(screen.getByText('Architecture')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '#aws',
      '#event-driven',
      '#payments',
    ]);
    expect(screen.getByText('ada lovelace')).toBeTruthy();
    expect(screen.getByText('2 days ago')).toBeTruthy();
    expect(screen.getByRole('article').className).toContain('hover:-translate-y-[3px]');
  });

  it('is a still preview without a link: its own image, no lift, an override label', () => {
    render(
      <CommunityPostTile
        post={post}
        now={NOW}
        image={<span>Snapshot</span>}
        categoryLabel="Choose a Category"
        badge={<span>Hidden</span>}
        stats={<span>Stats</span>}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Snapshot')).toBeTruthy();
    expect(screen.getByText('Choose a Category')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(screen.getByText('Stats')).toBeTruthy();
    expect(screen.getByRole('article').className).not.toContain('hover:-translate-y-[3px]');
  });
});

describe('CommunityAuthorBadge', () => {
  it("shows the author's initial in their colour, or their picture, falling back when it fails", () => {
    expect(communityAuthorInitial(' ada')).toBe('A');
    expect(communityAuthorInitial('  ')).toBe('?');
    const { container, rerender } = render(<CommunityAuthorBadge author={post.author} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('ada lovelace')).toBeTruthy();

    rerender(
      <CommunityAuthorBadge
        author={{ ...post.author, picture: 'https://img.clerk.com/a.png' }}
        showName={false}
      />,
    );
    const img = container.querySelector('img')!;
    // Asked for at the disc's size, as every profile picture is; the initial holds the box meanwhile.
    expect(img.getAttribute('src')).toBe('https://img.clerk.com/a.png?width=96&height=96');
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByText('ada lovelace')).toBeNull();
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeTruthy();
  });
});

describe('counts', () => {
  it('shorten big numbers, and say what they count to a screen reader', () => {
    expect(formatCommunityCount(999)).toBe('999');
    expect(formatCommunityCount(1200).toUpperCase()).toBe('1.2K');
    render(
      <>
        <CommunityLikeCount count={1} />
        <CommunityCopyCount count={3} />
      </>,
    );
    expect(screen.getByText('1 like')).toBeTruthy();
    expect(screen.getByText('3 copies')).toBeTruthy();
  });

  it('hold a placeholder card hidden from screen readers', () => {
    const { container } = render(<CommunityPostTileSkeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('clerkPublishableKeyOrNull', () => {
  it('turns sign-in on only for a real publishable key', () => {
    expect(clerkPublishableKeyOrNull('pk_test_abc')).toBe('pk_test_abc');
    expect(clerkPublishableKeyOrNull('pk_live_abc')).toBe('pk_live_abc');
    expect(clerkPublishableKeyOrNull('sk_test_abc')).toBeNull();
    expect(clerkPublishableKeyOrNull('')).toBeNull();
    expect(clerkPublishableKeyOrNull(undefined)).toBeNull();
  });
});
