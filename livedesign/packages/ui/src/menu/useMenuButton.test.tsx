// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMenuButton } from './useMenuButton';

function Probe() {
  const button = useMenuButton();
  return (
    <>
      <button {...button.triggerProps}>Views</button>
      <output>{button.open ? `open:${button.initialFocus}` : 'closed'}</output>
      <button onClick={button.close}>Close</button>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Views' });
const state = () => screen.getByRole('status').textContent;

describe('useMenuButton', () => {
  it('announces a menu and its state', () => {
    render(<Probe />);
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(state()).toBe('open:checked');
  });

  it('toggles on click and closes on request', () => {
    render(<Probe />);
    fireEvent.click(trigger());
    fireEvent.click(trigger());
    expect(state()).toBe('closed');
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(state()).toBe('closed');
  });

  it('opens on Down Arrow at the first or checked item, and on Up Arrow at the last', () => {
    render(<Probe />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(state()).toBe('open:checked');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    expect(state()).toBe('open:last');
  });

  it('leaves other keys alone', () => {
    render(<Probe />);
    fireEvent.keyDown(trigger(), { key: 'a' });
    expect(state()).toBe('closed');
  });
});
