// @vitest-environment jsdom

// The Estimate card face (docs/specs/012-collaboration/estimate-card.md): pick from the scale's cards, who has
// answered shows as face-down cards (never what), Reveal turns them face up with
// the spread, and New round only appears once revealed.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/document';
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
  estimateScale: 'fibonacci',
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
  it('asks a new card for its scale, and sets it with one press', () => {
    const onChooseScale = vi.fn();
    render(
      <EstimateFace
        element={card({ estimateScale: undefined })}
        label=""
        textColor="#0f172a"
        surface="#ffffff"
        selfKey="me"
        participants={[]}
        onChooseScale={onChooseScale}
      />,
    );
    expect(screen.getByText('Choose a scale')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pick 8' })).toBeNull();
    const tshirt = screen.getByRole('button', { name: 'Estimate in T-shirt' });
    fireEvent.pointerDown(tshirt);
    fireEvent.pointerUp(tshirt);
    fireEvent.click(tshirt);
    expect(onChooseScale).toHaveBeenCalledWith('tshirt');
  });

  it('invites a first pick', () => {
    show(card());
    expect(screen.getByText('No picks yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick 8' })).toBeTruthy();
  });

  it('shows who has answered but not what, with your own pick lifted', () => {
    show(card({ responses: answers }));
    // The count lives once, in the header.
    expect(screen.getByText('3/3 answered')).toBeTruthy();
    expect(screen.queryByText('3 of 3 in')).toBeNull();
    expect(screen.getByText('Reveal')).toBeTruthy();
    // The count is a badge beside it (docs/specs/004-interface-design/counts.md), not '(3)' in the label.
    expect(screen.queryByText(/Reveal \(/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Withdraw 5' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByText(/Spread/)).toBeNull();
    expect(screen.queryByText('New round')).toBeNull();
  });

  it('counts the room once per person who can pick', () => {
    const who = (id: string, key: string, role?: 'view') => ({
      id,
      key,
      name: id,
      color: '#000',
      status: 'online' as const,
      ...(role ? { role } : {}),
    });
    render(
      <EstimateFace
        element={card({ responses: [answers[0]!] })}
        label="Login page"
        textColor="#0f172a"
        surface="#ffffff"
        selfKey="me"
        participants={[
          who('me', 'me'),
          who('me-tab-2', 'me'),
          who('ada', 'a'),
          who('v', 'v', 'view'),
        ]}
      />,
    );
    expect(screen.getByText('1/2 answered')).toBeTruthy();
  });

  it('turns the cards face up with the spread once revealed', () => {
    show(card({ responses: answers, responsesRevealed: true }));
    expect(screen.getByText('Spread 3 → 13')).toBeTruthy();
    expect(screen.getByText('New round')).toBeTruthy();
    expect(screen.queryByText(/Reveal \(/)).toBeNull();
  });
});
