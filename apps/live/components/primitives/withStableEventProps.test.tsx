// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { withStableEventProps } from './withStableEventProps';

// docs/specs/008-canvas/blueprints/selection-store.md "The canvas boundary": an editor render with
// the same data and freshly built handlers re-renders nothing below the boundary.

describe('withStableEventProps', () => {
  const setup = () => {
    const renders = vi.fn();
    const Inner = ({ label, onPress }: { label: string; onPress: () => void }) => {
      renders();
      return <button onClick={onPress}>{label}</button>;
    };
    return { renders, Boundary: withStableEventProps(Inner) };
  };

  it('skips a re-render that only rebuilt the handlers', () => {
    const { renders, Boundary } = setup();
    const { rerender } = render(<Boundary label="Go" onPress={() => {}} />);

    rerender(<Boundary label="Go" onPress={() => {}} />);

    expect(renders).toHaveBeenCalledTimes(1);
  });

  it('re-renders when the data changes', () => {
    const { renders, Boundary } = setup();
    const { rerender } = render(<Boundary label="Go" onPress={() => {}} />);

    rerender(<Boundary label="Stop" onPress={() => {}} />);

    expect(renders).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button').textContent).toBe('Stop');
  });

  it('runs the newest handler though the inner view did not re-render', () => {
    const { Boundary } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Boundary label="Go" onPress={first} />);
    rerender(<Boundary label="Go" onPress={second} />);

    fireEvent.click(screen.getByRole('button'));

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
