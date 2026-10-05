// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLike } from '@/lib/useLike';
import { LikeButton } from './LikeButton';

// The heart (blueprint §5, §10): flips at once (aria-pressed and the count), settles to the server's
// answer, and rolls back when the request fails.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fetchMock = vi.fn<typeof fetch>();

function Harness() {
  const like = useLike({ id: 'post123456', liked: false, likeCount: 4 });
  return <LikeButton like={like} />;
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const button = () => host.querySelector('button')!;

async function click() {
  await act(async () => {
    button().click();
  });
}

describe('LikeButton', () => {
  it('likes optimistically and settles to the server count', async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    await act(async () => root.render(<Harness />));
    expect(button().getAttribute('aria-pressed')).toBe('false');

    await click();
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().textContent).toBe('5');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/community/posts/post123456/like');
    expect(init?.method).toBe('PUT');
    expect((init?.headers as Record<string, string>)['X-Community-Key']).toMatch(/^[0-9a-f-]{36}$/);

    await act(async () => resolve(Response.json({ likeCount: 9, liked: true })));
    expect(button().textContent).toBe('9');
    expect(button().getAttribute('aria-label')).toBe('Like (9 likes)');
  });

  it('rolls back when the request fails', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'rate_limited' }, { status: 429 }));
    await act(async () => root.render(<Harness />));
    await click();
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().textContent).toBe('4');
    expect(button().disabled).toBe(false);
  });

  it('disables itself when the post is gone', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'not_found' }, { status: 404 }));
    await act(async () => root.render(<Harness />));
    await click();
    expect(button().disabled).toBe(true);
  });
});
