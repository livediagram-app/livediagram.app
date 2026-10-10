import { describe, expect, it } from 'vitest';
import { emptyCopy } from './CardFinderPanel';

// docs/specs/026-plan/items.md "Find a card": the list's empty states, a title and a line each.
describe('the Cards panel when it shows no cards', () => {
  it('names why, most telling reason first', () => {
    expect(emptyCopy(0, 'anything', 2).title).toBe('No cards yet');
    expect(emptyCopy(0, '', 0, false).description).toBe(
      'Cards added to this document will show here.',
    );
    expect(emptyCopy(5, ' launch ', 2).title).toBe('No cards match');
    expect(emptyCopy(5, '  ', 2).title).toBe('No cards match these filters');
    expect(emptyCopy(5, '', 0)).toEqual({
      title: 'Every card is on a board',
      description: 'None of them sits off a board here.',
    });
  });
});
