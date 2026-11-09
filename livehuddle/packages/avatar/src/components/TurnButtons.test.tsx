// @vitest-environment jsdom

// The Rotate Left and Rotate Right pair of the selection toolbars (livehuddle's
// docs/specs/009-elements/furniture-facing.md "Turning a placed piece").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TurnButtons } from './TurnButtons';

afterEach(cleanup);

describe('TurnButtons', () => {
  it('turns a quarter anticlockwise and clockwise', () => {
    const onTurn = vi.fn();
    render(<TurnButtons onTurn={onTurn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rotate Left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate Right' }));
    expect(onTurn.mock.calls).toEqual([[-1], [1]]);
  });

  it('shows disabled on a locked piece, in the same place, and turns nothing', () => {
    const onTurn = vi.fn();
    render(<TurnButtons onTurn={onTurn} locked plural size="compact" />);
    const left = screen.getByRole('button', { name: 'Rotate Left' });
    expect((left as HTMLButtonElement).disabled).toBe(true);
    expect(left.className).toContain('h-7');
    fireEvent.click(left);
    expect(onTurn).not.toHaveBeenCalled();
  });
});
