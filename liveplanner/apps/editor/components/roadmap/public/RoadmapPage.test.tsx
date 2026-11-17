// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublicRoadmap } from '@liveplanner/api-schema';
import { formLook } from '@liveplanner/project';
import { RoadmapPage, waitPhrase } from './RoadmapPage';
import { retryAfterMs } from '@/lib/api/roadmaps-public';
import { roadmapDay } from './RoadmapCard';

// A public roadmap's page (docs/specs/026-plan/public-roadmap.md "What a visitor sees", "Upvotes", "States"): its four
// states, the chosen columns with only what the api sends, an upvote shown at once and settled by the api, each
// refusal said, Show More, and Suggest an Idea.

const CODE = 'lpr_AbCdEfGhIjKlMnOpQrStUv';
const ROADMAP: PublicRoadmap = {
  title: 'Acme Roadmap',
  voting: true,
  suggestPath: '/form/AbCdEfGhIjKlMnOpQrStU1',
  look: formLook({ theme: 'forest', finish: 'sketch', font: 'caveat' }),
  columns: [
    {
      name: 'Planned',
      count: 2,
      cards: [
        {
          id: 'c1',
          title: 'Dark mode',
          votes: 4,
          voted: false,
          number: 12,
          type: 'Feature',
          labels: ['UI'],
          description: 'x'.repeat(400),
          start: '2027-03-03',
          due: '2027-04-14',
        },
        { id: 'c2', title: 'Offline', votes: 1, voted: true },
      ],
    },
    { name: 'Shipped', count: 0, cards: [] },
  ],
};

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };
let replies: Reply[];
let calls: { url: string; init?: RequestInit }[];

beforeEach(() => {
  window.history.replaceState(null, '', `/roadmap/plan-1/${CODE}`);
  localStorage.clear();
  replies = [];
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, ...(init ? { init } : {}) });
      const r = replies.shift() ?? { status: 500 };
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status,
        ...(r.headers ? { headers: r.headers } : {}),
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stateOf = () =>
  document.querySelector('[data-roadmap-state]')!.getAttribute('data-roadmap-state');
const voteButton = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^(Vote for|Remove your vote for) ${title},`) });

async function ready(data: PublicRoadmap = ROADMAP) {
  replies.push({ status: 200, body: data });
  render(<RoadmapPage />);
  await screen.findByRole('heading', { name: data.title });
}

describe('the read', () => {
  it('shows the chosen columns and only the fields the api sends, asking with this browser', async () => {
    await ready();
    const browser = localStorage.getItem('liveplanner:form-browser');
    expect(browser).toBeTruthy();
    expect(calls[0]!.url).toContain(`/roadmaps/plan-1/${CODE}?browser=${browser}`);
    expect(screen.getByRole('heading', { name: 'Planned' })).toBeTruthy();
    expect(screen.getByText('2 cards')).toBeTruthy();
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    expect(screen.getByText('#12')).toBeTruthy();
    expect(screen.getByText('Feature')).toBeTruthy();
    expect(screen.getByText('UI')).toBeTruthy();
    expect(screen.getByText(`Starts ${roadmapDay('2027-03-03')}`)).toBeTruthy();
    expect(screen.getByText(`Target ${roadmapDay('2027-04-14')}`)).toBeTruthy();
    expect(voteButton('Offline').getAttribute('aria-pressed')).toBe('true');
    const suggest = screen.getByRole('link', { name: 'Suggest an Idea' });
    expect(suggest.getAttribute('href')).toBe('/form/AbCdEfGhIjKlMnOpQrStU1');
    expect(suggest.getAttribute('target')).toBe('_blank');
    // The tab title is set in an effect (useBrowserTabTitle), which a slow runner commits after the heading shows.
    await waitFor(() => expect(document.title).toBe('Acme Roadmap | liveplanner'));
  });

  it('folds a long description to three lines with Show More', async () => {
    await ready();
    const more = screen.getByRole('button', { name: 'Show More' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(screen.getByRole('button', { name: 'Show Less' })).toBeTruthy();
  });

  it('draws no vote button and no Suggest an Idea when the roadmap has neither', async () => {
    await ready({ ...ROADMAP, voting: false, suggestPath: null });
    expect(screen.queryByRole('button', { name: /Vote for/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Suggest an Idea' })).toBeNull();
  });

  it('says a roadmap is not available, for an unknown one and a malformed address', async () => {
    replies.push({ status: 404, body: { error: 'roadmap_not_found' } });
    render(<RoadmapPage />);
    expect(await screen.findByText('This roadmap isn’t available')).toBeTruthy();
    cleanup();
    window.history.replaceState(null, '', '/roadmap/plan-1/nope');
    render(<RoadmapPage />);
    expect(await screen.findByText('This roadmap isn’t available')).toBeTruthy();
    expect(calls).toHaveLength(1);
  });

  it('offers Try Again when the read fails', async () => {
    replies.push({ status: 500 });
    render(<RoadmapPage />);
    const again = await screen.findByRole('button', { name: 'Try Again' });
    replies.push({ status: 200, body: ROADMAP });
    fireEvent.click(again);
    expect(stateOf()).toBe('loading');
    expect(screen.getByLabelText('Loading the roadmap')).toBeTruthy();
    await screen.findByRole('heading', { name: 'Acme Roadmap' });
  });
});

// The per-network read limit's 429 is not the connection: the page says it is busy and reads again once the
// limit's window is over (public-roadmap.md "States").
describe('busy', () => {
  afterEach(() => vi.useRealTimers());

  it('says the roadmap is busy, never the connection, and reads again after the window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push({
      status: 429,
      body: { error: 'rate_limited' },
      headers: { 'Retry-After': '60' },
    });
    render(<RoadmapPage />);
    await screen.findByRole('heading', { name: 'This roadmap is busy' });
    expect(stateOf()).toBe('busy');
    expect(screen.getByText(/It tries again in a minute\./)).toBeTruthy();
    expect(screen.queryByText(/connection/)).toBeNull();
    replies.push({ status: 200, body: ROADMAP });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await screen.findByRole('heading', { name: 'Acme Roadmap' });
    expect(calls).toHaveLength(2);
  });

  it('keeps waiting a window at a time while it stays busy, and Try Again reads at once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push({ status: 429, headers: { 'Retry-After': '10' } });
    render(<RoadmapPage />);
    await screen.findByText(/It tries again in 10 seconds\./);
    replies.push({ status: 429, headers: { 'Retry-After': '10' } });
    await vi.advanceTimersByTimeAsync(10_000);
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(stateOf()).toBe('busy');
    replies.push({ status: 200, body: ROADMAP });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByRole('heading', { name: 'Acme Roadmap' });
    expect(calls).toHaveLength(3);
    // The page is ready: no read of its own is left waiting.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(calls).toHaveLength(3);
  });

  it('holds Retry-After to 5 seconds..5 minutes, and takes the window when it is missing or odd', () => {
    expect(retryAfterMs('60')).toBe(60_000);
    expect(retryAfterMs('0')).toBe(5_000);
    expect(retryAfterMs('99999')).toBe(300_000);
    expect(retryAfterMs(null)).toBe(60_000);
    expect(retryAfterMs('Wed, 21 Oct 2026 07:28:00 GMT')).toBe(60_000);
    expect(retryAfterMs(' 30 ')).toBe(30_000);
  });

  it('says the wait in words', () => {
    expect(waitPhrase(5_000)).toBe('5 seconds');
    expect(waitPhrase(60_000)).toBe('a minute');
    expect(waitPhrase(300_000)).toBe('5 minutes');
  });
});

describe('upvotes', () => {
  it('counts a vote at once, settles on the answer and sends the hidden field empty', async () => {
    await ready();
    replies.push({ status: 200, body: { votes: 9, voted: true } });
    fireEvent.click(voteButton('Dark mode'));
    expect(voteButton('Dark mode').textContent).toContain('5');
    await waitFor(() => expect(voteButton('Dark mode').textContent).toContain('9'));
    expect(voteButton('Dark mode').getAttribute('aria-pressed')).toBe('true');
    const sent = calls[1]!;
    expect(sent.url).toContain(`/roadmaps/plan-1/${CODE}/votes`);
    expect(JSON.parse(sent.init!.body as string)).toEqual({
      card: 'c1',
      browser: localStorage.getItem('liveplanner:form-browser'),
      up: true,
      website: '',
    });
  });

  it('takes a vote back', async () => {
    await ready();
    replies.push({ status: 200, body: { votes: 0, voted: false } });
    fireEvent.click(voteButton('Offline'));
    await waitFor(() => expect(voteButton('Offline').getAttribute('aria-pressed')).toBe('false'));
    expect((JSON.parse(calls[1]!.init!.body as string) as { up: boolean }).up).toBe(false);
  });

  it.each([
    [409, 'This idea has all the votes it can take.'],
    [429, 'Voting is busy. Try again in a few minutes.'],
    [500, 'We couldn’t save your vote. Check your connection and try again.'],
  ])('goes back and says why when the api answers %i', async (status, message) => {
    await ready();
    replies.push({ status, body: { error: 'x' } });
    fireEvent.click(voteButton('Dark mode'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(voteButton('Dark mode').textContent).toContain('4');
    expect(voteButton('Dark mode').getAttribute('aria-pressed')).toBe('false');
  });

  it('reads the roadmap again when the card has gone', async () => {
    await ready();
    replies.push({ status: 404, body: { error: 'card_not_found' } });
    replies.push({
      status: 200,
      body: { ...ROADMAP, columns: [{ name: 'Planned', count: 0, cards: [] }] },
    });
    fireEvent.click(voteButton('Dark mode'));
    expect(await screen.findByText('That idea isn’t on the roadmap any more.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Dark mode')).toBeNull());
  });

  it('says a failed send when the network is down', async () => {
    await ready();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(voteButton('Dark mode'));
    expect(
      await screen.findByText('We couldn’t save your vote. Check your connection and try again.'),
    ).toBeTruthy();
  });
});
