// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { isBoardHoverWrite } from './board-hover';
import { SPOTLIGHT_X, SPOTLIGHT_Y } from './useCardSpotlight';
import { COLUMN_HOVER_ATTR } from './useColumnHover';

// docs/specs/026-plan/plan-board.md "Card hover", "Column hover": the pointer's own feedback is never a change to the
// face (docs/specs/008-canvas/finish.md "Marker").

afterEach(() => {
  document.body.innerHTML = '';
});

/** The records a change makes, as an observer asking for old values sees them. */
async function recordsOf(change: () => void): Promise<MutationRecord[]> {
  const seen: MutationRecord[] = [];
  const observer = new MutationObserver((records) => seen.push(...records));
  observer.observe(document.body, { subtree: true, attributes: true, attributeOldValue: true });
  change();
  await Promise.resolve();
  observer.disconnect();
  return seen;
}

function card(style = '--card-bg: #fff; --card-line: #e2e8f0;'): HTMLElement {
  document.body.innerHTML = `<div class="plan-card-hover" style="${style}"></div>`;
  return document.body.firstElementChild as HTMLElement;
}

describe('isBoardHoverWrite', () => {
  it('is a column’s hover mark going on and off', async () => {
    const col = card();
    const on = await recordsOf(() => col.setAttribute(COLUMN_HOVER_ATTR, ''));
    const off = await recordsOf(() => col.removeAttribute(COLUMN_HOVER_ATTR));
    expect([...on, ...off].every(isBoardHoverWrite)).toBe(true);
  });

  it('is the light moving across a card, its first write and every one after', async () => {
    const el = card();
    const move = (x: number, y: number) => () => {
      el.style.setProperty(SPOTLIGHT_X, `${x}px`);
      el.style.setProperty(SPOTLIGHT_Y, `${y}px`);
    };
    const first = await recordsOf(move(10, 4));
    const next = await recordsOf(move(120, 60));
    expect(first).toHaveLength(2);
    expect([...first, ...next].every(isBoardHoverWrite)).toBe(true);
  });

  it('is the light on a card with no other inline style', async () => {
    const el = card('');
    el.removeAttribute('style');
    const records = await recordsOf(() => el.style.setProperty(SPOTLIGHT_X, '3px'));
    expect(records.every(isBoardHoverWrite)).toBe(true);
  });

  it('is not a change to the card’s own look, even beside the light', async () => {
    const el = card();
    const records = await recordsOf(() => {
      el.style.setProperty(SPOTLIGHT_X, '8px');
      el.style.setProperty('--card-line', '#0ea5e9');
    });
    expect(records.some((r) => !isBoardHoverWrite(r))).toBe(true);
  });

  it('is not any other attribute, nor a child going in', async () => {
    const el = card();
    const records = await recordsOf(() => el.setAttribute('data-plan-card', 'a'));
    expect(records.map(isBoardHoverWrite)).toEqual([false]);
    const added = new MutationObserver(() => {});
    added.observe(el, { childList: true });
    el.append(document.createElement('span'));
    const [child] = added.takeRecords();
    added.disconnect();
    expect(isBoardHoverWrite(child!)).toBe(false);
  });
});
