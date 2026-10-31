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

describe('CommunityShowcase', () => {
  it("asks the service for the app's featured posts and shows them in its words", async () => {
    featured = () =>
      Response.json({
        posts: [communityPostFixture({ id: 'p1', title: 'Quarterly Report', shareCode: 'C1' })],
      });
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

  it('invites the first share in its words when the service cannot be reached', async () => {
    featured = () => Promise.reject(new TypeError('offline'));
    render(showcase());
    expect(
      await screen.findByText(/Be one of the first to share a document\./),
    ).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      'https://www.liveworkspace.app/api/community/featured?app=livedocuments.app',
    );
  });

  it('takes an unreadable answer as nothing to show', async () => {
    featured = () => new Response('nope', { status: 500 });
    render(showcase());
    expect(await screen.findByText(/The Community is just getting started/)).toBeTruthy();
  });

  it('is not there at all while the Community is switched off', async () => {
    featured = () => new Response(null, { status: 404 });
    const { container } = render(showcase());
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
