import { describe, expect, it } from 'vitest';
import { pickerAccent, pickerCountText, pickerLayout } from './picker-layout';

// docs/specs/012-collaboration/picker.md "The look": the reel keeps its look from tiny to room-sized.
describe('pickerLayout', () => {
  it('fits the payline with half rows either side at the default size', () => {
    const l = pickerLayout(220, 132);
    expect(l.header).toBe(true);
    expect(l.neighbours).toBe(true);
    // Header, the two-row window and the button fit inside the card.
    expect(16 + 24 + l.rowH * 2 + 34).toBeLessThanOrEqual(132);
    expect(l.nameSize).toBeGreaterThanOrEqual(15);
  });

  it('keeps only the payline on a short card, and drops the header on a tiny one', () => {
    expect(pickerLayout(220, 100).neighbours).toBe(false);
    expect(pickerLayout(220, 100).header).toBe(true);
    expect(pickerLayout(220, 70).header).toBe(false);
    expect(pickerLayout(220, 40).rowH).toBe(20);
  });

  it('grows the name with the card, up to a limit', () => {
    const big = pickerLayout(800, 600);
    expect(big.nameSize).toBe(40);
    expect(big.rowH).toBe(84);
    expect(big.avatarSize).toBe(44);
  });

  it('sets a long option smaller, so two lines of it fit the payline', () => {
    const name = pickerLayout(320, 180, { longest: 10 });
    const question = pickerLayout(320, 180, { longest: 60 });
    expect(question.nameSize).toBeLessThan(name.nameSize);
    expect(question.rowH).toBeGreaterThan(question.nameSize * 2);
  });

  it('gives the room the buttons leave when there are none', () => {
    expect(pickerLayout(220, 132, { controls: false }).rowH).toBeGreaterThan(
      pickerLayout(220, 132).rowH,
    );
  });

  it('lists the drawn names only on a card with room, and makes room for the all-drawn line', () => {
    expect(pickerLayout(240, 260, { drawn: true }).drawnList).toBe(true);
    expect(pickerLayout(240, 132, { drawn: true }).drawnList).toBe(false);
    expect(pickerLayout(160, 260, { drawn: true }).drawnList).toBe(false);
    expect(pickerLayout(240, 260).drawnList).toBe(false);
    expect(pickerLayout(220, 160, { caption: true }).rowH).toBeLessThan(
      pickerLayout(220, 160).rowH,
    );
  });
});

describe('pickerCountText', () => {
  it('names the pool by its source, and what is left in a round', () => {
    const base = { total: 5, left: 5, removeDrawn: false };
    expect(pickerCountText({ ...base, source: 'participants' })).toBe('5 here');
    expect(pickerCountText({ ...base, source: 'options' })).toBe('5 options');
    expect(pickerCountText({ ...base, source: 'options', total: 1 })).toBe('1 option');
    expect(pickerCountText({ ...base, source: 'options', removeDrawn: true, left: 2 })).toBe(
      '2 of 5 left',
    );
    expect(pickerCountText({ ...base, source: 'options', removeDrawn: true, left: 0 })).toBe(
      'All drawn',
    );
    expect(pickerCountText({ ...base, source: 'options', total: 0 })).toBe('');
  });
});

describe('pickerAccent', () => {
  it('takes the element stroke, else the brand sky for the paper', () => {
    expect(pickerAccent('#db2777', 'dark')).toBe('#db2777');
    expect(pickerAccent(undefined, 'light')).toBe('#0ea5e9');
    expect(pickerAccent(undefined, 'dark')).toBe('#38bdf8');
  });
});
