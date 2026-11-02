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

  it('does not play again for a drink it answered before it was drawn', () => {
    act(() => answerMachine('a'));
    render(<FurnitureView element={cooler('a')} stroke="#64748b" sitters={[]} />);
    expect(animated).toHaveLength(0);
  });
});
