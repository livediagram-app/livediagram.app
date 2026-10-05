// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityPost } from '@livediagram/api-schema';
import { resetCommunityEnabledForTests } from '@livediagram/ui';
import { CommunityShowcase } from './CommunityShowcase';

// The landing page's Community section (docs/specs/025-community/community.md "Featured on the home page").

const post = (n: number): CommunityPost => ({
  id: `post${n}`,
  title: `Featured ${n}`,
  description: 'A document worth sharing.',
  category: 'architecture',
  tags: [],
  likeCount: n,
  copyCount: 1,
  publishedAt: Date.now() - 60_000,
  updatedAt: Date.now() - 60_000,
  shareCode: `CODE${n}`,
  author: { name: 'Anonymous', color: '#64748b', picture: null },
  anonymous: true,
  liked: false,
});

let featured: () => Response;
let capabilities: () => Response;

beforeEach(() => {
  resetCommunityEnabledForTests();
  capabilities = () => Response.json({ communityEnabled: true });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).endsWith('/capabilities') ? capabilities() : featured(),
    ),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CommunityShowcase', () => {
  it('holds six placeholders, then shows the six with their counts and links', async () => {
    featured = () => Response.json({ posts: [1, 2, 3, 4, 5, 6].map(post) });
    const { container } = render(<CommunityShowcase />);
    expect(container.querySelectorAll('li [aria-hidden="true"]').length).toBeGreaterThanOrEqual(6);
    expect(await screen.findByText('Featured 6')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Featured 1' }).getAttribute('href')).toBe(
      '/community/post/?id=post1',
    );
    expect(screen.getByRole('img', { name: 'Featured 1' }).getAttribute('src')).toBe(
      '/api/share/CODE1/image.svg',
    );
    expect(screen.getByText('1 like')).toBeTruthy();
    expect(screen.getAllByText('1 copy')).toHaveLength(6);
    expect(screen.getByRole('link', { name: 'Explore the Community' }).getAttribute('href')).toBe(
      '/community/',
    );
  });

  it('invites the first share when there is nothing to show', async () => {
    featured = () => Response.json({ posts: [] });
    render(<CommunityShowcase />);
    expect(await screen.findByText(/The Community is just getting started/)).toBeTruthy();
  });

  it('is not there at all while the Community is switched off', async () => {
    featured = () => new Response(null, { status: 404 });
    const { container } = render(<CommunityShowcase />);
    await waitFor(() => expect(container.firstChild).toBeNull());

    cleanup();
    resetCommunityEnabledForTests();
    capabilities = () => Response.json({ communityEnabled: false });
    featured = () => Response.json({ posts: [post(1)] });
    const second = render(<CommunityShowcase />);
    await waitFor(() => expect(second.container.firstChild).toBeNull());
  });
});
