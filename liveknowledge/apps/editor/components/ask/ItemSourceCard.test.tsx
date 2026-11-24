// @vitest-environment jsdom

// A cited item of another app (docs/specs/030-knowledgebase/search-and-ask.md "Sources", "What an answer shows"): its
// card, its chip's words, the address that opens it at the cited place, its "as of" line, and the answer's pill.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AskSource } from '@liveknowledge/api-schema';
import { askCitationOf } from '@liveworkspace/index-client';
import { answerTrust } from '@/lib/knowledge-ask/ask-trust';
import { citationTitle, sourceAsOf, sourceHref } from '@/lib/knowledge-ask/source-item';
import { ItemSourceCard } from './ItemSourceCard';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 23, 12);

const item = (over: Partial<AskSource> = {}): AskSource => ({
  number: 2,
  passageId: 's1',
  tab: 'd1',
  title: 'Checkout Flow',
  headings: ['Payments'],
  text: 'Checkout pays through Stripe.',
  trust: 'never-verified',
  firstBlock: '',
  lastBlock: '',
  source: {
    app: 'livediagram',
    itemId: 'd1',
    itemName: 'Checkout Flow',
    place: { tabId: 't1', elementIds: ['e1'] },
    readAt: NOW - DAY,
  },
  ...over,
});
const page = (tab: string, trust: AskSource['trust'] = 'verified'): AskSource => ({
  ...item({ tab, title: tab, trust }),
  source: undefined,
});

afterEach(cleanup);

describe('ItemSourceCard', () => {
  it("names the item, its app and place, says it isn't verified here, and opens it", () => {
    const onOpen = vi.fn();
    const source = item();
    render(
      <ul>
        <ItemSourceCard
          source={source}
          passage={<span>Stripe</span>}
          now={NOW}
          lit={false}
          stale={false}
          card=""
          onOpen={onOpen}
        />
      </ul>,
    );
    const button = screen.getByRole('button', {
      name: 'Source 2: Checkout Flow in livediagram, Payments. Opens in livediagram in a new tab.',
    });
    expect(button.textContent).toContain('Not Verified Here');
    expect(button.textContent).toContain('As of 22 Nov');
    expect(button.textContent).toContain('Open in livediagram');
    expect(button.querySelector('[data-source-as-of="fresh"]')).toBeTruthy();
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith(source);
  });

  it('marks an old read amber and focuses a lit card', () => {
    const source = item({ source: { ...item().source!, readAt: NOW - 9 * DAY, itemName: '' } });
    render(
      <ul>
        <ItemSourceCard
          source={source}
          passage={null}
          now={NOW}
          lit
          stale
          card=""
          onOpen={() => {}}
        />
      </ul>,
    );
    const button = screen.getByRole('button');
    expect(button.querySelector('[data-source-as-of="stale"]')).toBeTruthy();
    expect(button.textContent).toContain('Untitled');
    expect(document.activeElement).toBe(button);
  });
});

describe('a cited item', () => {
  it("is titled with its app, and opens at its place with the question for the app's bar", () => {
    expect(citationTitle(item())).toBe('Checkout Flow (livediagram)');
    expect(citationTitle(page('Deploys'))).toBe('Deploys');
    const href = sourceHref(
      item().source!,
      'How does checkout pay?',
      'kb_1',
      'https://diagram.test',
    );
    expect(href.startsWith('https://diagram.test/document/d1#t=t1&el=e1')).toBe(true);
    expect(askCitationOf(new URL(href).hash)).toEqual({
      question: 'How does checkout pay?',
      from: 'kb_1',
      elementIds: ['e1'],
    });
    expect(
      sourceHref(
        { app: 'liveplanner', itemId: 'p1', place: { cardId: 'c1' } },
        'q',
        'kb',
        'https://plan.test',
      ),
    ).toMatch(/^https:\/\/plan\.test\/project\/p1#item=c1/);
  });

  it('says how old its read is', () => {
    expect(sourceAsOf(0, NOW)).toEqual({ words: 'Not read yet', stale: true });
    expect(sourceAsOf(NOW - 8 * DAY, NOW).stale).toBe(true);
  });

  it("is counted apart from the pages in the answer's pill, once an item", () => {
    expect(answerTrust([page('a'), item(), item({ number: 3 })])).toMatchObject({
      pill: expect.stringMatching(/ and 1 Connected Item$/),
      items: 1,
      solid: false,
    });
    expect(
      answerTrust([item(), item({ tab: 'p1', source: { ...item().source!, itemId: 'p1' } })]),
    ).toMatchObject({
      pill: 'Answered From 2 Connected Items',
      rest: 'Nobody has verified them here.',
    });
    expect(answerTrust([page('a')])?.items).toBeUndefined();
  });
});
