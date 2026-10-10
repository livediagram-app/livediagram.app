// @vitest-environment jsdom

// The Temperature check face (docs/specs/012-collaboration/temperature-check.md "The face"): five faces with
// their words, your own pick pressed, the room's average with its word, and an
// empty card that says so instead of averaging zero.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/document';
import { TemperatureFace } from './TemperatureFace';

afterEach(cleanup);

const card = (values: [string, string][]): ShapeElement => ({
  id: 't',
  type: 'shape',
  shape: 'temperature',
  x: 0,
  y: 0,
  width: 320,
  height: 300,
  responses: values.map(([participantId, value], at) => ({ participantId, value, at })),
});

describe('TemperatureFace', () => {
  it('offers five faces with their words and answers with the value', () => {
    const onRespond = vi.fn();
    render(
      <TemperatureFace
        element={card([])}
        label=""
        textColor="#0f172a"
        selfKey="me"
        onRespond={onRespond}
      />,
    );
    // The words live in the accessible names, not on the buttons.
    for (const name of ['1, Blocked', '2, Doubtful', '3, Okay', '4, Keen', '5, All in'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByText('Blocked')).toBeNull();
    fireEvent.pointerDown(screen.getByRole('button', { name: '4, Keen' }));
    fireEvent.pointerUp(screen.getByRole('button', { name: '4, Keen' }));
    fireEvent.click(screen.getByRole('button', { name: '4, Keen' }));
    expect(onRespond).toHaveBeenCalledWith('4');
    expect(screen.getByText('No readings yet')).toBeTruthy();
  });

  it('presses your own pick and reads the room', () => {
    render(
      <TemperatureFace
        element={card([
          ['me', '4'],
          ['a', '4'],
          ['b', '3'],
          ['c', '5'],
        ])}
        label=""
        textColor="#0f172a"
        selfKey="me"
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '4, Keen' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByText('4.0')).toBeTruthy();
    expect(screen.getByText('from 4 people')).toBeTruthy();
  });

  it('resets everyone from its own menu once there are answers', () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <TemperatureFace
        element={card([])}
        label=""
        textColor="#0f172a"
        selfKey="me"
        onRespond={vi.fn()}
        onClear={onClear}
      />,
    );
    // Nothing to reset: no menu of its own.
    expect(screen.queryByRole('button', { name: 'Temperature check options' })).toBeNull();
    rerender(
      <TemperatureFace
        element={card([['a', '4']])}
        label=""
        textColor="#0f172a"
        selfKey="me"
        onRespond={vi.fn()}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Temperature check options' }));
    fireEvent.click(screen.getByText('Reset Answers'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
