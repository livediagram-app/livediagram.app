import { describe, expect, it } from 'vitest';
import { parseCard } from './collab-push';

// A card as an app pushes it (one-explorer-contracts.md "What an item pushes"): its `id` names the card when the
// row's element is not the card itself (one of its comment threads).
describe('parseCard', () => {
  const base = { key: 12, type: 'bug', typeLabel: 'Bug', title: 'Login fails', board: null };

  it('keeps a card’s id when given, and leaves it out when not', () => {
    expect(parseCard({ ...base, id: 'card-7' })).toEqual({ ...base, id: 'card-7' });
    expect(parseCard(base)).toEqual(base);
  });

  it('refuses an id that is not one', () => {
    expect(parseCard({ ...base, id: '' })).toBeUndefined();
    expect(parseCard({ ...base, id: 7 })).toBeUndefined();
  });
});
