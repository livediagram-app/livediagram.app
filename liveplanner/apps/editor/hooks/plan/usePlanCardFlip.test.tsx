// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FLIP_CARDS_MAX, cardsToMeasure, usePlanCardFlip } from './usePlanCardFlip';

// docs/specs/026-plan/plan-board.md "Cards move visibly".
afterEach(cleanup);

// jsdom lays nothing out: each card's place is set by hand, as offsets within the body.
const places = new Map<string, { x: number; y: number }>();
const remembered: { current: ((run: HTMLElement) => void) | null } = { current: null };
function Board({
  ids,
  signature,
  skip = null,
  hold,
}: {
  ids: string[];
  signature: string;
  skip?: string | null;
  hold?: () => boolean;
}) {
  const body = useRef<HTMLDivElement>(null);
  const remember = usePlanCardFlip(body, signature, skip, hold);
  useLayoutEffect(() => {
    remembered.current = remember;
  });
  return (
    <div ref={body} data-testid="body">
      {ids.map((id) => (
        <div
          key={id}
          data-plan-card={id}
          ref={(node) => {
            if (!node) return;
            Object.defineProperty(node, 'offsetParent', {
              configurable: true,
              get: () => node.parentElement,
            });
            Object.defineProperty(node, 'offsetLeft', {
              configurable: true,
              get: () => places.get(id)!.x,
            });
            Object.defineProperty(node, 'offsetTop', {
              configurable: true,
              get: () => places.get(id)!.y,
            });
          }}
        />
      ))}
    </div>
  );
}
const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-card="${id}"]`)!;

describe('cards moving on a board', () => {
  it('holds still while a column glides, its cards riding in their cells', () => {
    places.set('a', { x: 0, y: 0 });
    const hold = () => true;
    const { rerender } = render(<Board ids={['a']} signature="1" hold={hold} />);
    places.set('a', { x: 240, y: 0 });
    rerender(<Board ids={['a']} signature="2" hold={hold} />);
    expect(card('a').classList.contains('plan-card-flip')).toBe(false);
    expect(card('a').style.transform).toBe('');
  });

  // A busy board's run built after the last change (PlanCardRun): its cards' places are learnt as they are built.
  it('glides a card built after the last change once its place was remembered', () => {
    places.set('a', { x: 0, y: 0 }).set('b', { x: 0, y: 100 });
    const { rerender } = render(<Board ids={['a']} signature="1" />);
    rerender(<Board ids={['a', 'b']} signature="1" />);
    remembered.current!(document.querySelector<HTMLElement>('[data-testid="body"]')!);
    places.set('b', { x: 240, y: 100 });
    rerender(<Board ids={['a', 'b']} signature="2" />);
    expect(card('b').classList.contains('plan-card-flip')).toBe(true);
    expect(card('a').classList.contains('plan-card-flip')).toBe(false);
  });

  it('glides a card that moved, and only that card', () => {
    places.set('a', { x: 0, y: 0 }).set('b', { x: 0, y: 100 });
    const { rerender } = render(<Board ids={['a', 'b']} signature="1" />);
    places.set('a', { x: 240, y: 0 });
    rerender(<Board ids={['a', 'b']} signature="2" />);
    expect(card('a').classList.contains('plan-card-flip')).toBe(true);
    expect(card('a').style.transform).toBe('');
    expect(card('b').classList.contains('plan-card-flip')).toBe(false);
  });

  it('leaves the dragged card, and a big reshuffle, to snap', () => {
    places.set('a', { x: 0, y: 0 });
    const { rerender } = render(<Board ids={['a']} signature="1" />);
    places.set('a', { x: 240, y: 0 });
    rerender(<Board ids={['a']} signature="2" skip="a" />);
    expect(card('a').classList.contains('plan-card-flip')).toBe(false);
    cleanup();
    const many = Array.from({ length: FLIP_CARDS_MAX + 1 }, (_, i) => `c${i}`);
    for (const id of many) places.set(id, { x: 0, y: 0 });
    const second = render(<Board ids={many} signature="1" />);
    for (const id of many) places.set(id, { x: 240, y: 0 });
    second.rerender(<Board ids={many} signature="2" />);
    expect(card('c0').classList.contains('plan-card-flip')).toBe(false);
  });
});

describe('the cards a busy board measures', () => {
  const rect = (top: number, height: number) =>
    ({ top, bottom: top + height, left: 0, right: 300, width: 300, height }) as DOMRect;
  function board(runTops: number[]) {
    const body = document.createElement('div');
    body.getBoundingClientRect = () => rect(0, 800);
    runTops.forEach((top, r) => {
      const run = document.createElement('div');
      run.setAttribute('data-plan-run', '');
      run.getBoundingClientRect = () => rect(top, 500);
      for (let i = 0; i < 3; i++) {
        const card = document.createElement('div');
        card.setAttribute('data-plan-card', `r${r}c${i}`);
        run.appendChild(card);
      }
      body.appendChild(run);
    });
    return body;
  }
  const ids = (cards: HTMLElement[]) => cards.map((c) => c.dataset.planCard);

  it('reads only the runs within a view of the view, never one skipped far off', () => {
    // In view, just below it, a view and more below, and far above.
    const body = board([100, 900, 2200, -3000]);
    expect(ids(cardsToMeasure(body))).toEqual(['r0c0', 'r0c1', 'r0c2', 'r1c0', 'r1c1', 'r1c2']);
  });

  it('reads every card on a board drawn without runs', () => {
    const body = document.createElement('div');
    for (const id of ['a', 'b']) {
      const card = document.createElement('div');
      card.setAttribute('data-plan-card', id);
      body.appendChild(card);
    }
    expect(ids(cardsToMeasure(body))).toEqual(['a', 'b']);
  });
});
