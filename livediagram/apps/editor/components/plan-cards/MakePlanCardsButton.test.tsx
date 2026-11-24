// @vitest-environment jsdom
// Make Plan Cards on the selection toolbar (make-plan-cards.md "Where"): shown for two or more shapes with words while
// this session may send, asking the host to read only the selection.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const may = vi.hoisted(() => ({ value: true }));
vi.mock('@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry', () => ({
  canSendHere: () => may.value,
}));

import { MakePlanCardsButton } from './MakePlanCardsButton';
import { onMakePlanCards } from '@/lib/plan-cards/make-entry';
import { box } from '@/lib/plan-cards/test-elements';

const two = [box('a', 'A'), box('b', 'B')];
afterEach(() => {
  cleanup();
  may.value = true;
});

describe('MakePlanCardsButton', () => {
  it('asks for the selection when two shapes with words are picked', () => {
    const asked = vi.fn();
    const off = onMakePlanCards(asked);
    render(<MakePlanCardsButton elements={two} className="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Make plan cards from the selection' }));
    expect(asked).toHaveBeenCalledWith({ only: ['a', 'b'] });
    off();
  });

  it('hides for one shape, without a host, or in a session that may not send', () => {
    const off = onMakePlanCards(() => {});
    const { container, rerender } = render(
      <MakePlanCardsButton elements={[box('a', 'A'), box('b', '')]} className="" />,
    );
    expect(container.innerHTML).toBe('');
    may.value = false;
    rerender(<MakePlanCardsButton elements={two} className="" />);
    expect(container.innerHTML).toBe('');
    off();
    may.value = true;
    rerender(<MakePlanCardsButton elements={[...two]} className="" />);
    expect(container.innerHTML).toBe('');
  });
});
