// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityPost } from '@livediagram/api-schema';

// The post page (docs/specs/025-community/community.md "Post"): it loads the post named in the address, says when
// it is gone or failed, offers Make a Copy, Open Document, the heart and Report, and its report dialog sends a
// reason with an optional note.

const h = vi.hoisted(() => ({
  id: 'post1' as string | null,
  telemetry: {
    openedPost: vi.fn(),
    copiedPost: vi.fn(),
    reported: vi.fn(),
    likedPost: vi.fn(),
    unlikedPost: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(h.id ? { id: h.id } : {}),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/telemetry', () => ({ communityTelemetry: h.telemetry }));

import { EmbedFrame } from './EmbedFrame';
import { PostView } from './PostView';

const post: CommunityPost = {
  id: 'post1',
  title: 'Payments Platform',
  description: 'How our payment services talk.\n\nThe second paragraph.',
  category: 'architecture',
  tags: ['aws', 'event-driven'],
  likeCount: 3,
  copyCount: 1,
  publishedAt: Date.UTC(2026, 8, 1),
  updatedAt: Date.UTC(2026, 8, 1),
  shareCode: 'CODE1',
  author: { name: 'Ada', color: '#f97316', picture: null },
  anonymous: false,
  liked: false,
};

let answer: (url: string, init?: RequestInit) => Response | Promise<Response>;
const calls: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  h.id = 'post1';
  calls.length = 0;
  for (const fn of Object.values(h.telemetry)) fn.mockReset();
  answer = () =>
    Response.json({
      post,
      related: [{ ...post, id: 'post2', title: 'Related One', likeCount: 9, copyCount: 4 }],
    });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return answer(String(input), init);
    }),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the post page', () => {
  it('shows the post, its actions and More Like This, and counts one open', async () => {
    render(<PostView />);
    expect(await screen.findByRole('heading', { name: 'Payments Platform' })).toBeTruthy();
    expect(screen.getByText('The second paragraph.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '#aws' }).getAttribute('href')).toBe('/?q=%23aws');
    expect(screen.getByRole('link', { name: /Make a Copy/ }).getAttribute('href')).toBe(
      '/document/shared?s=CODE1&copy=1',
    );
    expect(screen.getByRole('link', { name: /Open Document/ }).getAttribute('href')).toBe(
      '/document/shared?s=CODE1',
    );
    expect(screen.getByRole('button', { name: 'Like (3 likes)' })).toBeTruthy();
    expect(screen.getByText('copy')).toBeTruthy();
    expect(screen.getByText('Related One')).toBeTruthy();
    expect(document.title).toBe('Payments Platform | livediagram Community');
    expect(h.telemetry.openedPost).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: /Make a Copy/ }));
    expect(h.telemetry.copiedPost).toHaveBeenCalledTimes(1);
  });

  it('says a missing, hidden or removed post is not in the Community', async () => {
    answer = () => new Response(null, { status: 404 });
    render(<PostView />);
    expect(await screen.findByText("This document isn't in the Community any more.")).toBeTruthy();
    expect(h.telemetry.openedPost).not.toHaveBeenCalled();
  });

  it('treats a page with no id as not found, without asking the api', async () => {
    h.id = null;
    render(<PostView />);
    expect(screen.getByText("This document isn't in the Community any more.")).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('offers Try Again after a failure, which loads it again', async () => {
    let fail = true;
    answer = () =>
      fail ? new Response(null, { status: 500 }) : Response.json({ post, related: [] });
    render(<PostView />);
    expect(await screen.findByText("We couldn't load this document.")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('heading', { name: 'Payments Platform' })).toBeTruthy();
  });
});

describe('reporting', () => {
  async function openReport() {
    render(<PostView />);
    await screen.findByRole('heading', { name: 'Payments Platform' });
    fireEvent.click(screen.getByRole('button', { name: /Report/ }));
    return screen.getByRole('dialog', { name: 'Report This Document' });
  }

  it('sends a reason and the trimmed note, then says what happens next', async () => {
    const dialog = await openReport();
    const send = within(dialog).getByRole('button', { name: 'Send Report' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    answer = (url) =>
      url.endsWith('/report')
        ? new Response(null, { status: 204 })
        : Response.json({ post, related: [] });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Spam' }));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '  buy now  ' } });
    fireEvent.click(send);
    expect(await within(dialog).findByText(/When enough people report a document/)).toBeTruthy();
    const sent = calls.find((c) => c.url.endsWith('/report'))!;
    expect(sent.url).toBe('/api/community/posts/post1/report');
    expect(JSON.parse(String(sent.init?.body))).toEqual({ reason: 'spam', note: 'buy now' });
    expect(h.telemetry.reported).toHaveBeenCalledWith('Spam');
  });

  it('says so when sending fails, and closes on Escape', async () => {
    const dialog = await openReport();
    answer = (url) =>
      url.endsWith('/report')
        ? new Response(null, { status: 500 })
        : Response.json({ post, related: [] });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Offensive' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send Report' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    // Focus is back inside the dialog, not lost behind it.
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(h.telemetry.reported).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('the embed frame', () => {
  it('shows the card image under the live preview, and Open Document if the preview never loads', async () => {
    vi.useFakeTimers();
    render(<EmbedFrame shareCode="CODE1" title="Payments Platform" />);
    expect(screen.getByRole('img', { name: 'Payments Platform' }).getAttribute('src')).toBe(
      '/api/share/CODE1/image.svg',
    );
    expect(screen.getByTitle('Interactive preview of Payments Platform').getAttribute('src')).toBe(
      '/embed?s=CODE1',
    );
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(screen.queryByTitle('Interactive preview of Payments Platform')).toBeNull();
    expect(screen.getByRole('link', { name: /Open Document/ }).getAttribute('href')).toBe(
      '/document/shared?s=CODE1',
    );
  });

  it('keeps the preview once it has loaded', async () => {
    vi.useFakeTimers();
    render(<EmbedFrame shareCode="CODE1" title="Payments Platform" />);
    fireEvent.load(screen.getByTitle('Interactive preview of Payments Platform'));
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(screen.getByTitle('Interactive preview of Payments Platform')).toBeTruthy();
  });
});
