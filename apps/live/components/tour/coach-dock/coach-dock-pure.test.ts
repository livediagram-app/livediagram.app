// The coach dock's pure parts (blueprints/coach-dock.md "Testing"): the offer's length and the step announcement.
import { describe, expect, it } from 'vitest';
import { stepAnnouncement, tourLength } from './coach-dock-copy';

describe('tourLength', () => {
  it.each([
    [1, '1 stop, under a minute'],
    [4, '4 stops, about a minute'],
    [6, '6 stops, about a minute'],
    [7, '7 stops, about two minutes'],
  ])('%i stops reads "%s"', (n, words) => expect(tourLength(n)).toBe(words));
});

describe('stepAnnouncement', () => {
  it('names the tour, the step and its title', () =>
    expect(stepAnnouncement('Slides tour', 2, 4, 'Change the Background')).toBe(
      'Slides tour, step 2 of 4: Change the Background',
    ));
});
