import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './core';
import {
  apiCommunityPopularTags,
  apiGetCommunityPost,
  apiPublishCommunityPost,
  apiRemoveCommunityPost,
} from './community';
import { readCommunityShareInfo } from './share';
import { communityCodeMessage, communityErrorMessage } from '../community-errors';

// The editor's Community calls (docs/specs/025-community/blueprints/community.md §4) and how their
// refusals are worded.

type Seen = { method: string; url: string; headers: Headers; body: string | null };

function stubFetch(answer: (url: string, method: string) => Response): Seen[] {
  const seen: Seen[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      seen.push({
        method,
        url: String(url),
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return answer(String(url), method);
    }),
  );
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const INPUT = {
  title: 'Cloud map',
  description: 'How our services talk to each other.',
  category: 'architecture' as const,
  tags: ['aws'],
  anonymous: true,
};

describe('community api client', () => {
  it('reads the owner post, null when unpublished', async () => {
    const seen = stubFetch(() => Response.json({ post: null }));
    expect(await apiGetCommunityPost('guest-1', 'doc 1')).toBeNull();
    expect(seen[0]!.url).toBe('/api/documents/doc%201/community');
    expect(seen[0]!.headers.get('X-Owner-Id')).toBe('guest-1');
  });

  it('publishes with a PUT carrying the input', async () => {
    const seen = stubFetch(() => Response.json({ post: { id: 'p1' } }, { status: 201 }));
    const post = await apiPublishCommunityPost('guest-1', 'd1', INPUT);
    expect(post).toEqual({ id: 'p1' });
    expect(seen[0]!.method).toBe('PUT');
    expect(JSON.parse(seen[0]!.body!)).toEqual(INPUT);
  });

  it('surfaces the worker code on a refusal', async () => {
    stubFetch(() => Response.json({ error: 'share_password_set' }, { status: 409 }));
    const err = await apiPublishCommunityPost('guest-1', 'd1', INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('share_password_set');
    expect(communityErrorMessage(err)).toBe(
      'This document has a share password. Remove the password to share it to the Community.',
    );
  });

  it('removes with a DELETE and tolerates one already gone', async () => {
    const seen = stubFetch(() => new Response(null, { status: 404 }));
    await apiRemoveCommunityPost('guest-1', 'd1');
    expect(seen[0]!.method).toBe('DELETE');
  });

  it('asks for popular tags without any identity, and shrugs off a failure', async () => {
    const seen = stubFetch(() =>
      Response.json({ tags: [{ tag: 'aws', count: 3 }], anonymous: true }),
    );
    expect(await apiCommunityPopularTags()).toEqual(['aws']);
    expect(seen[0]!.headers.get('X-Owner-Id')).toBeNull();
    stubFetch(() => new Response('nope', { status: 500 }));
    expect(await apiCommunityPopularTags()).toEqual([]);
  });
});

describe('community error wording', () => {
  it('words every known code and falls back for the rest', () => {
    expect(communityCodeMessage('empty_document')).toBe(
      'Add something to your document before sharing it.',
    );
    expect(communityCodeMessage('invalid_title')).toBe('The title needs 3 to 80 characters.');
    expect(communityCodeMessage('something_new')).toBe(
      "We couldn't reach the Community. Try again.",
    );
  });

  it('says a rate limit is one, and a network failure is the fallback', () => {
    expect(communityErrorMessage(new ApiError('publish', 429, null))).toBe(
      'That was a lot at once. Try again in a minute.',
    );
    expect(communityErrorMessage(new TypeError('Failed to fetch'))).toBe(
      "We couldn't reach the Community. Try again.",
    );
  });
});

describe('readCommunityShareInfo', () => {
  it('reads a community link and fills a missing author', () => {
    expect(readCommunityShareInfo({ postId: 'p1', author: { name: '', color: '' } })).toEqual({
      postId: 'p1',
      author: { name: 'Someone', color: '#64748b', picture: null },
    });
  });

  it('is null for an ordinary link or a malformed field', () => {
    expect(readCommunityShareInfo(undefined)).toBeNull();
    expect(readCommunityShareInfo({ postId: 'p1' })).toBeNull();
    expect(readCommunityShareInfo('p1')).toBeNull();
  });
});
