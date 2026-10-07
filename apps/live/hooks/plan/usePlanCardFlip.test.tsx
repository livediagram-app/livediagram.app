// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FLIP_CARDS_MAX, usePlanCardFlip } from './usePlanCardFlip';

// docs/specs/026-plan/plan-board.md "Cards move visibly".
afterEach(cleanup);

// jsdom lays nothing out: each card's place is set by hand, as offsets within the body.
const places = new Map<string, { x: number; y: number }>();
function Board({
  ids,
  signature,
  skip = null,
}: {
  ids: string[];
  signature: string;
  skip?: string | null;
}) {
  const body = useRef<HTMLDivElement>(null);
  usePlanCardFlip(body, signature, skip);
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
