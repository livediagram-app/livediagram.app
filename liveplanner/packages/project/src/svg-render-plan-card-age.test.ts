import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item, type ItemTypeDef } from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { planCardFace } from './svg-render-plan-card';
import { svgBoxed } from './svg-render';
import { createShape } from './shape-factory';
import type { BoxedElement } from './index';

// A card's Age in exports and thumbnails (docs/specs/026-plan/item-types.md "Card display"): drawn as the board
// draws it, quiet, amber from 7 days and red from 14, never on a done card.

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 31, 12).getTime();
const palette = planPalette('light');
const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const aged: ItemTypeDef = { ...task, display: { detailed: { foot: ['age'] } } };
const types = ITEM_TYPES.map((t) => (t.id === 'task' ? aged : t));

const card = (days: number, status = 'doing'): Item => ({
  id: `c${days}${status}`,
  type: 'task',
  key: 3,
  rank: 'i',
  fields: { title: 'Stuck', status, statusSince: NOW - days * DAY },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'Sam', color: '#2563eb' },
  updatedBy: { id: 'p', name: 'Sam', color: '#2563eb' },
});
// Noon of a local day some days back, so the count never depends on the hour the test runs.
const noonDaysAgo = (days: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - days, 12).getTime();
};
const isDone = (s: string | undefined) => s === 'done';
const face = (c: Item, extra: Partial<Parameters<typeof planCardFace>[4]> = {}) =>
  planCardFace(c, 0, 0, 260, { palette, types, isDone, now: NOW, ...extra }).svg;

describe('Age on an exported card', () => {
  it('reads its days in its column, quiet under a week', () => {
    const svg = face(card(4));
    expect(svg).toContain('>4d<');
    expect(svg).not.toContain('#d97706');
    expect(svg).not.toContain('#dc2626');
  });

  it('turns amber at 7 days and red at 14', () => {
    expect(face(card(6))).not.toContain('#d97706');
    expect(face(card(7))).toContain('#d97706');
    expect(face(card(13))).toContain('#d97706');
    const red = face(card(14));
    expect(red).toContain('#dc2626');
    expect(red).toContain('>14d<');
  });

  it('is never drawn on a done card, a card with no status, or without the board’s done columns', () => {
    expect(face(card(20, 'done'))).not.toMatch(/>\d+d</);
    const loose = card(3);
    delete loose.fields['status'];
    expect(face(loose)).not.toMatch(/>\d+d</);
    expect(face(card(3), { isDone: undefined })).not.toMatch(/>\d+d</);
  });

  it('follows the type’s Display alone, whatever the board’s old field list says', () => {
    expect(face(card(2), { boardFields: ['key'] })).toContain('>2d<');
    // A type that does not place it draws none.
    expect(planCardFace(card(2), 0, 0, 260, { palette, isDone, now: NOW }).svg).not.toMatch(
      />\d+d</,
    );
  });

  it('is read now when no moment is given', () => {
    const fresh = {
      ...card(0),
      fields: { title: 'New', status: 'doing', statusSince: noonDaysAgo(0) },
    };
    expect(planCardFace(fresh, 0, 0, 260, { palette, types, isDone }).svg).toContain('>0d<');
  });

  it('shows on a board’s export, in its open columns only', () => {
    const board = {
      ...createShape('plan-board', 0, 0),
      width: 1600,
      height: 900,
      planBoard: presetSetup('kanban'),
    } as BoxedElement;
    const items = new Map(
      [
        { ...card(9), fields: { ...card(9).fields, statusSince: noonDaysAgo(9) } },
        { ...card(30, 'done'), id: 'gone' },
      ].map((c) => [c.id, c]),
    );
    const svg = svgBoxed(board, { items, itemTypes: types });
    expect(svg).toContain('>9d<');
    expect(svg).not.toContain('>30d<');
  });
});
