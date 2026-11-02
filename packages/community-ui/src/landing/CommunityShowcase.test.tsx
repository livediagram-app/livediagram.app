import { communityPostFixture } from '@liveworkspace/community/testing';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMUNITY_APP_WORDS } from '../share/words';
import { CommunityShowcase } from './CommunityShowcase';

// The landing page's Community section, as every app binds it (liveworkspace/docs/specs/007-community/community.md
// "Every app's Community"): the app's own featured six, its words, its card images and its help link.

let featured: () => Response | Promise<Response>;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => featured()),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const showcase = (communityApi?: string) => (
  <CommunityShowcase
    app="livedocuments.app"
    words={COMMUNITY_APP_WORDS['livedocuments.app']}
    imageUrl={(code) => `/api/share/${code}/image.svg`}
    communityApi={communityApi}
    helpLink={<a href="/help/community/">How the Community Works</a>}
  />
);

// A full showcase: the first is the Quarterly Report the tests look for.
const six = () =>
  Array.from({ length: 6 }, (_, i) =>
    i === 0
      ? communityPostFixture({ id: 'p1', title: 'Quarterly Report', shareCode: 'C1' })
      : communityPostFixture({ id: `p${i + 1}`, title: `Post ${i + 1}`, shareCode: `C${i + 1}` }),
  );

describe('CommunityShowcase', () => {
  it("asks the service for the app's featured posts and shows them in its words", async () => {
    featured = () => Response.json({ posts: six() });
    render(showcase('http://localhost:8791/api/community'));
    expect(screen.getByText(/^Documents people are proud of/)).toBeTruthy();
    expect(await screen.findByText('Quarterly Report')).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      'http://localhost:8791/api/community/featured?app=livedocuments.app',
    );
    expect(screen.getByRole('link', { name: 'Quarterly Report' }).getAttribute('href')).toBe(
      '/community/post/?id=p1',
    );
    expect(screen.getByRole('img', { name: 'Quarterly Report' }).getAttribute('src')).toBe(
      '/api/share/C1/image.svg',
    );
    expect(screen.getByRole('link', { name: 'How the Community Works' })).toBeTruthy();
  });

  it('holds six placeholder cards while the featured posts load', () => {
    featured = () => new Promise<Response>(() => {});
    const { container } = render(showcase());
    expect(screen.getByText('From the Community')).toBeTruthy();
    expect(container.querySelectorAll('li')).toHaveLength(6);
  });

  it('is not there while the Community has fewer than six to feature', async () => {
    featured = () => Response.json({ posts: six().slice(0, 5) });
    const { container } = render(showcase());
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('is not there when nothing is featured', async () => {
    featured = () => Response.json({ posts: [] });
    const { container } = render(showcase());
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('is not there when the service cannot be reached', async () => {
    featured = () => Promise.reject(new TypeError('offline'));
    const { container } = render(showcase());
    await waitFor(() => expect(container.firstChild).toBeNull());
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      'https://www.liveworkspace.app/api/community/featured?app=livedocuments.app',
    );
  });

  it('takes an unreadable answer as nothing to show', async () => {
    featured = () => new Response('nope', { status: 500 });
    const { container } = render(showcase());
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('is not there at all while the Community is switched off', async () => {
    featured = () => new Response(null, { status: 404 });
    const { container } = render(showcase());
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
