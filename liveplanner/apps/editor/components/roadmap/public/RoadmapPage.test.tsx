// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublicRoadmap } from '@liveplanner/api-schema';
import { formLook } from '@liveplanner/project';
import { RoadmapPage } from './RoadmapPage';
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

type Reply = { status: number; body?: unknown };
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
