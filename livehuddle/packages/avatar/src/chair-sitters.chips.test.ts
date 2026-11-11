import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  NAME_CHIP_GAP,
  NAME_CHIP_HEIGHT,
  nameChipWidth,
  seatedChipShifts,
  spreadNameChips,
  type NameChip,
} from './chair-sitters';
import { avatarScale } from './config';
import { seatPoints } from './seats';

// docs/specs/008-canvas/avatar-mode.md "Seated neighbours' chips never cover each other" (Work Tracker #597).

// Each chip's left and right edge once spread.
function spans(chips: readonly NameChip[]) {
  const shifts = spreadNameChips(chips);
  return chips.map((c) => {
    const x = c.x + (shifts.get(c.key) ?? 0);
    return { key: c.key, left: x - c.width / 2, right: x + c.width / 2, x };
  });
}

function expectNoOverlap(chips: readonly NameChip[]) {
  const s = spans(chips).sort((a, b) => a.left - b.left);
  for (let i = 1; i < s.length; i++)
    expect(s[i]!.left - s[i - 1]!.right).toBeGreaterThanOrEqual(NAME_CHIP_GAP - 1e-9);
}

describe('nameChipWidth', () => {
  it('grows with the name, caps at 120 (180 with a status), and is the status alone for your own', () => {
    expect(nameChipWidth('Al', null)).toBeLessThan(nameChipWidth('Clever Walrus', null));
    expect(nameChipWidth('A'.repeat(80), null)).toBe(120);
    expect(nameChipWidth('A'.repeat(80), 'Busy')).toBe(180);
    expect(nameChipWidth('Calm Tiger', 'Busy')).toBeGreaterThan(nameChipWidth('Calm Tiger', null));
    expect(nameChipWidth('', 'Focusing')).toBeGreaterThan(0);
    expect(nameChipWidth(null, null)).toBe(0);
  });
});

describe('spreadNameChips', () => {
  it('moves nothing for a lone chip or chips already apart', () => {
    expect(spreadNameChips([{ key: 'a', x: 0, top: 0, width: 80 }]).size).toBe(0);
    expect(
      spreadNameChips([
        { key: 'a', x: 0, top: 0, width: 80 },
        { key: 'b', x: 100, top: 0, width: 80 },
      ]).size,
    ).toBe(0);
  });

  it('spreads two overlapping chips evenly either side of their middle, in seat order', () => {
    const chips = [
      { key: 'walrus', x: 140, top: 0, width: 90 },
      { key: 'tiger', x: 100, top: 0, width: 70 },
    ];
    expectNoOverlap(chips);
    const s = spans(chips);
    const tiger = s.find((c) => c.key === 'tiger')!;
    const walrus = s.find((c) => c.key === 'walrus')!;
    expect(tiger.right).toBeLessThan(walrus.left);
    // The least total move: the pair's moves cancel out.
    expect(tiger.x - 100 + (walrus.x - 140)).toBeCloseTo(0, 9);
  });

  it('packs three on a sofa into one row, the middle one staying over its head', () => {
    const chips = [
      { key: 'a', x: 40, top: 0, width: 80 },
      { key: 'b', x: 80, top: 0, width: 80 },
      { key: 'c', x: 120, top: 0, width: 80 },
    ];
    expectNoOverlap(chips);
    expect(spreadNameChips(chips).get('b')).toBeUndefined();
  });

  it('merges a run into the one it pushes into', () => {
    // a and b overlap; spreading them pushes b into c, which then joins the run.
    const chips = [
      { key: 'a', x: 0, top: 0, width: 100 },
      { key: 'b', x: 10, top: 0, width: 100 },
      { key: 'c', x: 120, top: 0, width: 100 },
    ];
    expectNoOverlap(chips);
    expect(spreadNameChips(chips).has('c')).toBe(true);
  });

  it('leaves chips in different rows alone: one far enough above another never covers it', () => {
    const chips = [
      { key: 'low', x: 0, top: 0, width: 100 },
      { key: 'high', x: 0, top: -NAME_CHIP_HEIGHT, width: 100 },
    ];
    expect(spreadNameChips(chips).size).toBe(0);
    // Closer than a chip's height they share a row and spread.
    expect(spreadNameChips([chips[0]!, { ...chips[1]!, top: -NAME_CHIP_HEIGHT + 1 }]).size).toBe(2);
  });

  it('spreads a long row in linear time', () => {
    const chips = Array.from({ length: 2000 }, (_, i) => ({
      key: `p${i}`,
      x: i * 20,
      top: (i % 3) * 4,
      width: 120,
    }));
    const ms = cpuMsOf(() => spreadNameChips(chips));
    expect(ms).toBeLessThan(cpuBudgetMs(50));
    expectNoOverlap(chips);
  });
});

describe('seatedChipShifts', () => {
  // Two and three people on a sofa, bench and pod, at the seats the walk puts them on.
  const sofa = { x: 0, y: 0, width: 160, height: 88, shape: 'sofa' as const };
  const bench = { x: 0, y: 0, width: 140, height: 64, shape: 'bench' as const };
  const pod = { x: 0, y: 0, width: 160, height: 140, shape: 'office-pod' as const };
  const names = ['Calm Tiger', 'Clever Walrus', 'Brave Otter'];

  for (const el of [sofa, bench, pod]) {
    it(`gives every sitter on a ${el.shape} a fully readable chip`, () => {
      const seats = seatPoints(el);
      expect(seats.length).toBeGreaterThanOrEqual(2);
      const bearers = seats.slice(0, 3).map((seat, i) => ({
        key: names[i]!,
        x: seat.x,
        y: seat.y,
        seated: true,
        name: names[i]!,
      }));
      const shifts = seatedChipShifts(bearers);
      const chips = bearers.map((b) => ({
        key: b.key,
        x: b.x,
        top: b.y - 56 * avatarScale('regular'),
        width: nameChipWidth(b.name, null),
      }));
      // The shifts seatedChipShifts gives leave the chips apart.
      const placed = chips.map((c) => ({ ...c, x: c.x + (shifts.get(c.key) ?? 0) }));
      const rows = new Map<number, typeof placed>();
      for (const c of placed)
        rows.set(Math.round(c.top), [...(rows.get(Math.round(c.top)) ?? []), c]);
      for (const row of rows.values()) {
        const sorted = [...row].sort((a, b) => a.x - b.x);
        for (let i = 1; i < sorted.length; i++)
          expect(
            sorted[i]!.x - sorted[i]!.width / 2 - (sorted[i - 1]!.x + sorted[i - 1]!.width / 2),
          ).toBeGreaterThanOrEqual(NAME_CHIP_GAP - 1e-9);
      }
    });
  }

  it('leaves walking characters and a character with no chip out', () => {
    const shifts = seatedChipShifts([
      { key: 'a', x: 0, y: 100, seated: true, name: 'Calm Tiger' },
      { key: 'b', x: 10, y: 100, seated: false, name: 'Clever Walrus' },
      { key: 'self', x: 20, y: 100, seated: true, name: '', status: null },
    ]);
    expect(shifts.size).toBe(0);
  });

  it('takes your own status chip into the row, and a sitter’s size into its chip’s height', () => {
    const shifts = seatedChipShifts([
      { key: 'a', x: 0, y: 100, seated: true, name: 'Calm Tiger' },
      { key: '', x: 30, y: 100, seated: true, name: '', status: 'Focusing' },
    ]);
    expect(shifts.size).toBe(2);
    // A Tall sitter's head (and chip) stands higher than a Small one's beside it: rows apart.
    const sized = seatedChipShifts([
      { key: 'a', x: 0, y: 100, scale: avatarScale('small'), seated: true, name: 'Calm Tiger' },
      { key: 'b', x: 30, y: 100, scale: avatarScale('tall'), seated: true, name: 'Clever Walrus' },
    ]);
    expect(sized.size).toBe(0);
  });
});
