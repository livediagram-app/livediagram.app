// @vitest-environment jsdom

// The Estimate card face (docs/specs/012-collaboration/estimate-card.md): pick from the scale's cards, who has
// answered shows as face-down cards (never what), Reveal turns them face up with
// the spread, and New round only appears once revealed.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/diagram';
import { EstimateFace } from './EstimateFace';

afterEach(cleanup);

const card = (o: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'e',
  type: 'shape',
  shape: 'estimate',
  x: 0,
  y: 0,
  width: 360,
  height: 310,
  ...o,
});
const answers = [
  { participantId: 'me', value: '5', at: 1 },
  { participantId: 'a', value: '13', at: 2 },
  { participantId: 'b', value: '3', at: 3 },
];
const show = (el: ShapeElement) =>
  render(
    <EstimateFace
      element={el}
      label="Login page"
      textColor="#0f172a"
      surface="#ffffff"
      selfKey="me"
      participants={[]}
      onRespond={vi.fn()}
      onSetRevealed={vi.fn()}
      onClear={vi.fn()}
    />,
  );

describe('EstimateFace', () => {
  it('invites a first pick', () => {
    show(card());
    expect(screen.getByText('No picks yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick 8' })).toBeTruthy();
  });

  it('shows who has answered but not what, with your own pick lifted', () => {
    show(card({ responses: answers }));
    expect(screen.getByText('3 of 3 in')).toBeTruthy();
    expect(screen.getByText('Reveal (3)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Withdraw 5' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByText(/Spread/)).toBeNull();
    expect(screen.queryByText('New round')).toBeNull();
  });

  it('turns the cards face up with the spread once revealed', () => {
    show(card({ responses: answers, responsesRevealed: true }));
    expect(screen.getByText('Spread 3 → 13')).toBeTruthy();
    expect(screen.getByText('New round')).toBeTruthy();
    expect(screen.queryByText(/Reveal \(/)).toBeNull();
  });
});
