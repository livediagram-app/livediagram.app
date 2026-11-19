import { describe, expect, it } from 'vitest';
import type { CollabCard, InboxThread } from '@liveworkspace/index-client';
import { entryPlace } from './InboxReader';
import { entryFacts } from './InboxRows';
import { inboxEntries, type InboxSections } from './sections';

// A Plan card's comment threads in the Inbox (one-explorer-contracts.md "What an item pushes", "Inbox"): each thread
// its own row, titled by the thread and placed on its card, opening the card on that thread; a thread shared between
// two plans is one row.

const card: CollabCard = {
  id: 'card-7',
  key: 12,
  type: 'bug',
  typeLabel: 'Bug',
  title: 'Login fails',
  board: { tabId: 'tab-b', elementId: 'board-1', title: 'Sprint', tabName: 'Board' },
};

const thread = (patch: Partial<InboxThread> = {}): InboxThread => ({
  app: 'liveplanner',
  itemId: 'plan-1',
  itemTitle: 'Launch',
  itemTeamId: null,
  tabId: '~cards',
  tabName: '',
  elementId: 'th-1',
  elementLabel: 'Ada: The basket empties',
  resolved: false,
  commentCount: 2,
  latestText: 'Still happening',
  latestAuthorName: 'Ada King',
  latestAuthorColor: '#f97316',
  card,
  mentionsYou: false,
  youCommented: true,
  onYourItem: false,
  firstAt: 1,
  latestAt: 100,
  ...patch,
});

const sections = (threads: InboxThread[]): InboxSections => ({
  forMe: [],
  byMe: [],
  forms: [],
  threads,
  requests: [],
});

describe('a card thread in the Inbox', () => {
  it('is titled by the thread and placed on its card, its board first', () => {
    const [entry] = inboxEntries(sections([thread()]));
    expect(entry!.kind).toBe('CardThread');
    const facts = entryFacts(entry!, 'user_me');
    expect(facts.title).toBe('Ada: The basket empties');
    expect(facts.cardNumber).toBeNull();
    expect(facts.where).toEqual(['Board', 'Sprint', '#12 Login fails']);
  });

  it('opens the card on the thread', () => {
    const [entry] = inboxEntries(sections([thread()]));
    expect(entryPlace(entry!)).toEqual({
      tabId: 'tab-b',
      elementId: 'board-1',
      cardId: 'card-7',
      threadId: 'th-1',
    });
  });

  it('keeps a row from before threads as its card’s one conversation', () => {
    const { id: _id, ...old } = card;
    const [entry] = inboxEntries(sections([thread({ elementId: 'card-7', card: old })]));
    expect(entryFacts(entry!, null).title).toBe('Login fails');
    expect(entryFacts(entry!, null).cardNumber).toBe('#12');
    expect(entryPlace(entry!)).toEqual({ tabId: 'tab-b', elementId: 'board-1', cardId: 'card-7' });
  });

  // Card prefixes across plans (liveplanner/docs/specs/026-plan/item-types.md "Card number prefixes" "Across plans").
  it('names a card by the prefixed ref its plan pushed, #N for a push from before', () => {
    const [entry] = inboxEntries(sections([thread({ card: { ...card, ref: 'BUG-12' } })]));
    expect(entryFacts(entry!, null).where).toEqual(['Board', 'Sprint', 'BUG-12 Login fails']);
    const { id: _id, ...old } = card;
    const [whole] = inboxEntries(
      sections([thread({ elementId: 'card-7', card: { ...old, ref: 'BUG-12' } })]),
    );
    expect(entryFacts(whole!, null).cardNumber).toBe('BUG-12');
  });

  it('names a card with no number or board by its title alone', () => {
    const bare = { ...card, key: null, board: null };
    const [entry] = inboxEntries(sections([thread({ card: bare, elementLabel: '' })]));
    expect(entryFacts(entry!, null).where).toEqual(['Login fails']);
    expect(entryFacts(entry!, null).title).toBe('Comment thread');
  });

  it('lists a thread shared into two plans once, the newer copy', () => {
    const entries = inboxEntries(
      sections([
        thread({ itemId: 'plan-1', latestAt: 100 }),
        thread({ itemId: 'plan-2', itemTitle: 'Sprint 12', latestAt: 200 }),
        thread({ itemId: 'plan-3', latestAt: 50 }),
        thread({ elementId: 'th-2', latestAt: 10 }),
      ]),
    );
    expect(entries.map((e) => [e.row.itemId, (e.row as InboxThread).elementId])).toEqual([
      ['plan-2', 'th-1'],
      ['plan-1', 'th-2'],
    ]);
    expect(new Set(entries.map((e) => e.key)).size).toBe(2);
  });
});
