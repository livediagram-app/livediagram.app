import { describe, expect, it } from 'vitest';
import { pickerAccent, pickerCountText, pickerLayout } from './picker-layout';

// docs/specs/012-collaboration/picker.md "The look": the reel keeps its look from tiny to room-sized.
describe('pickerLayout', () => {
  it('fits the payline with half rows either side at the default size', () => {
    const l = pickerLayout(220, 132);
    expect(l.compact).toBe(false);
    expect(l.header).toBe(true);
    expect(l.peek).toBe(Math.floor(l.rowH / 2));
    // Header, the window and the button fit inside the card.
    expect(16 + 24 + l.rowH + 2 * l.peek + 34).toBeLessThanOrEqual(132);
    expect(l.nameSize).toBeGreaterThanOrEqual(15);
    expect(l.avatarSize).toBeLessThanOrEqual(l.rowH - 6);
  });

  it('goes compact on a short card: one row, no header, the name kept whole', () => {
    for (const [w, h] of [
      [220, 100],
      [220, 70],
      [200, 50],
      [160, 36],
    ] as const) {
      const l = pickerLayout(w, h, { longest: 6, menu: true });
      expect(l.compact).toBe(true);
      expect(l.header).toBe(false);
      expect(l.peek).toBe(0);
      // The payline row fits inside the card's padding.
      expect(l.rowH).toBeLessThanOrEqual(Math.max(20, h - 16));
    }
    expect(pickerLayout(220, 40).rowH).toBe(24);
    expect(pickerLayout(220, 20).rowH).toBe(20);
  });

  it('keeps a compact name clear of the buttons and the corner menu', () => {
    const roomy = pickerLayout(160, 60, { longest: 14 });
    const crowded = pickerLayout(160, 60, { longest: 14, reset: true, menu: true });
    expect(crowded.nameSize).toBeLessThan(roomy.nameSize);
    expect(pickerLayout(160, 60, { longest: 14, controls: false }).nameSize).toBeGreaterThanOrEqual(
      roomy.nameSize,
    );
  });

  it('shows the payline alone when there is no room for a row either side', () => {
    const l = pickerLayout(220, 120);
    expect(l.compact).toBe(false);
    expect(l.peek).toBe(0);
  });

  it('grows the name with the card, and shows a whole row either side on a big one', () => {
    const big = pickerLayout(800, 600);
    expect(big.nameSize).toBe(40);
    expect(big.rowH).toBe(84);
    expect(big.peek).toBe(84);
    expect(big.avatarSize).toBe(44);
  });

  it('gives a long option the whole window, wrapped and sized to be read whole', () => {
    const name = pickerLayout(300, 200, { longest: 10 });
    const question = pickerLayout(300, 200, { longest: 76 });
    expect(name.peek).toBeGreaterThan(0);
    expect(question.peek).toBe(0);
    expect(question.nameSize).toBeLessThan(name.nameSize);
    expect(question.lines).toBeGreaterThan(1);
    // Every character has a place: lines times characters per line, with the wrap's loss.
    const perLine = Math.floor((300 - 16 - 48) / (question.nameSize * 0.58));
    expect(perLine * question.lines * 0.85).toBeGreaterThanOrEqual(76);
    expect(question.lines * question.nameSize * 1.25).toBeLessThanOrEqual(question.rowH);
    // An essay settles for the smallest size.
    expect(pickerLayout(140, 120, { longest: 900 }).nameSize).toBe(11);
  });

  it('makes room for avatars beside a name', () => {
    expect(pickerLayout(180, 132, { longest: 14, avatars: true }).nameSize).toBeLessThanOrEqual(
      pickerLayout(180, 132, { longest: 14 }).nameSize,
    );
  });

  it('gives the room the buttons leave when there are none', () => {
    expect(pickerLayout(220, 132, { controls: false }).rowH).toBeGreaterThan(
      pickerLayout(220, 132).rowH,
    );
  });

  it('lists the drawn names and the all-drawn line only on a card with room', () => {
    expect(pickerLayout(240, 260, { drawn: true }).drawnList).toBe(true);
    expect(pickerLayout(240, 132, { drawn: true }).drawnList).toBe(false);
    expect(pickerLayout(160, 260, { drawn: true }).drawnList).toBe(false);
    expect(pickerLayout(240, 260).drawnList).toBe(false);
    const captioned = pickerLayout(220, 160, { caption: true });
    expect(captioned.caption).toBe(true);
    expect(captioned.rowH).toBeLessThan(pickerLayout(220, 160).rowH);
    expect(pickerLayout(220, 120, { caption: true }).caption).toBe(false);
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
