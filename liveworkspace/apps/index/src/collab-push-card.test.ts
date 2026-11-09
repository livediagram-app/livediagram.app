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

// The card's column (its status chip in the Inbox): kept when well formed, dropped (never the push refused) when not.
describe('parseCard column', () => {
  const base = { key: 12, type: 'bug', typeLabel: 'Bug', title: 'Login fails', board: null };

  it('keeps a column’s name, colour and done, the name trimmed and cut', () => {
    expect(
      parseCard({ ...base, column: { name: ' In Progress ', color: '#f97316', done: false } }),
    ).toEqual({ ...base, column: { name: 'In Progress', color: '#f97316', done: false } });
    expect(parseCard({ ...base, column: { name: 'x'.repeat(300), done: true } })?.column).toEqual({
      name: 'x'.repeat(200),
      done: true,
    });
  });

  it('drops a colour that is not #rrggbb, and a column with no name or done', () => {
    expect(
      parseCard({ ...base, column: { name: 'Done', color: 'red', done: true } })?.column,
    ).toEqual({ name: 'Done', done: true });
    for (const column of [
      null,
      'Done',
      [],
      { name: '', done: true },
      { name: 'Done' },
      { done: true },
    ]) {
      const card = parseCard({ ...base, column });
      expect(card).toEqual(base);
    }
  });
});
