// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { answerMachine, resetMachineAnswers } from '@/lib/machine-answer';
import { FurnitureView } from './FurnitureView';

// docs/specs/009-elements/office.md "Using it": the machine that gave a drink answers, and only it.
const cooler = (id: string) => ({ ...createShape('water-cooler', 0, 0), id }) as ShapeElement;
let animated: Element[];

beforeEach(() => {
  resetMachineAnswers();
  animated = [];
  // jsdom has no Web Animations: record what is asked to move.
  (Element.prototype as unknown as { animate: unknown }).animate = function (this: Element) {
    animated.push(this);
    return { cancel: () => {} };
  };
});
afterEach(cleanup);

describe('a machine answering', () => {
  it('plays on the machine that gave the drink, and no other', () => {
    const { container: a } = render(
      <FurnitureView element={cooler('a')} stroke="#64748b" sitters={[]} />,
    );
    const { container: b } = render(
      <FurnitureView element={cooler('b')} stroke="#64748b" sitters={[]} />,
    );
    act(() => answerMachine('a'));
    expect(animated.length).toBeGreaterThan(0);
    expect(animated.every((el) => a.contains(el))).toBe(true);
    expect(animated.some((el) => b.contains(el))).toBe(false);
  });

  // docs/specs/009-elements/furniture-facing.md "Live faces": on the drawing its facing shows, hidden from behind.
  it('plays on a turned machine where its bottle or carafe shows, and not behind the coffee machine', () => {
    const at = (kind: 'water-cooler' | 'coffee-machine', chairFacing: 'n' | 'e' | 's' | 'w') => {
      const el = {
        ...createShape(kind, 0, 0),
        id: `${kind}-${chairFacing}`,
        chairFacing,
      } as ShapeElement;
      const { container, unmount } = render(
        <FurnitureView element={el} stroke="#64748b" sitters={[]} />,
      );
      const spots = [...container.querySelectorAll('circle, ellipse[rx="1.4"]')];
      const mirrored = spots.every((s) => !!s.closest('g[transform]'));
      const xs = spots.map((s) => Number(s.getAttribute('cx')));
      unmount();
      return { xs, mirrored };
    };
    expect(at('water-cooler', 'n').xs).toEqual([20, 28, 35]);
    expect(at('water-cooler', 's').xs).toEqual([20, 28, 35]);
    expect(at('water-cooler', 'e')).toEqual({ xs: [22, 30, 37], mirrored: false });
    expect(at('water-cooler', 'w')).toEqual({ xs: [22, 30, 37], mirrored: true });
    expect(at('coffee-machine', 'n').xs).toEqual([36, 36, 36]);
    expect(at('coffee-machine', 'e').xs).toEqual([8.5, 8.5, 8.5]);
    expect(at('coffee-machine', 's').xs).toEqual([]);
  });

  it('does not play again for a drink it answered before it was drawn', () => {
    act(() => answerMachine('a'));
    render(<FurnitureView element={cooler('a')} stroke="#64748b" sitters={[]} />);
    expect(animated).toHaveLength(0);
  });
});
