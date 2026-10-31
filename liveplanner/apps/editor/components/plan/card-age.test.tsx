// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';
import { LATE_COLOUR, SOON_COLOUR } from './plan-card-parts';

// A card's Age on the board (docs/specs/026-plan/item-types.md "Card display"): days in its column, quiet under a
// week, amber from 7 and red from 14, never on a done card, rolling over at local midnight with no reload.

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const PERSON = { id: 'p', name: 'Sam Reed', color: '#2563eb' };
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const aged = (size: 'minimal' | 'detailed'): ItemTypeDef => ({
  ...task,
  display: size === 'minimal' ? { minimal: { trail: ['age'] } } : { detailed: { foot: ['age'] } },
});
const NOW = new Date(2026, 9, 20, 15);
const daysAgo = (n: number) => new Date(2026, 9, 20 - n, 10).getTime();
const card = (since: number, status: string | null = 'doing'): Item => ({
  id: 'item-a',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: { title: 'A card', ...(status ? { status } : {}), statusSince: since },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function face(item: Item, opts: { size?: 'minimal' | 'detailed'; muted?: boolean } = {}) {
  const size = opts.size ?? 'detailed';
  render(
    <PlanCardFace
      item={item}
      palette={planPalette('light', {})}
      fields={['age']}
      size={size}
      typeOverride={aged(size)}
      {...(opts.muted ? { muted: true } : {})}
    />,
  );
}

const pillOf = (text: string) => screen.getByText(text).closest('span.inline-flex') as HTMLElement;

describe('the Age pill', () => {
  it('reads its days, quiet under a week, and is spoken with its column', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    face(card(daysAgo(4)));
    expect(screen.getByText('4d')).toBeTruthy();
    expect(screen.getByText('In doing for 4 days')).toBeTruthy();
    expect(pillOf('4d').style.color).not.toBe('rgb(217, 119, 6)');
  });

  it.each([
    [6, undefined, undefined],
    [7, SOON_COLOUR, 'font-semibold'],
    [13, SOON_COLOUR, 'font-semibold'],
    [14, LATE_COLOUR, 'font-bold'],
    [40, LATE_COLOUR, 'font-bold'],
  ])('at %i days takes %s', (days, colour, weight) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    face(card(daysAgo(days)));
    const text = screen.getByText(`${days}d`);
    const pill = pillOf(`${days}d`);
    if (colour) {
      const hex = colour.replace('#', '');
      const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
      expect(pill.style.color).toBe(`rgb(${rgb})`);
      expect(text.className).toContain(weight);
    } else {
      expect(pill.style.color).not.toBe('rgb(217, 119, 6)');
      expect(text.className).not.toContain('font-');
    }
  });

  it('shows on a Minimal card too', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    face(card(daysAgo(2)), { size: 'minimal' });
    expect(screen.getByText('2d')).toBeTruthy();
  });

  it('is never drawn on a done card or one with no status', () => {
    face(card(daysAgo(20)), { muted: true });
    expect(screen.queryByText(/^\d+d$/)).toBeNull();
    cleanup();
    face(card(daysAgo(20), null));
    expect(screen.queryByText(/^\d+d$/)).toBeNull();
  });

  it('rolls over at local midnight with no reload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59));
    face(card(daysAgo(6)));
    expect(screen.getByText('6d')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(screen.getByText('7d')).toBeTruthy();
    expect(pillOf('7d').style.color).toBe('rgb(217, 119, 6)');
  });
});
