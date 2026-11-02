// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, resetWorkbenchForTests } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { CursorsDrawnContext } from '../../hooks/collab/useHideCursors';
import { HideCursorsFooter, HideCursorsSwitch } from './HideCursorsSwitch';

afterEach(() => {
  resetWorkbenchForTests();
  window.localStorage.clear();
});

describe('HideCursorsSwitch', () => {
  it('is one switch, named and described, that flips the stored choice', () => {
    const track = vi.fn();
    configureWorkbench(testBindings({ hideCursorsKey: 'test:switch-a', track }));
    render(<HideCursorsSwitch />);
    const row = screen.getByRole('switch', { name: /Hide Participant Cursors/ });
    expect(row.textContent).toContain('Saved on this device only.');
    expect(row.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-checked')).toBe('true');
    expect(window.localStorage.getItem('test:switch-a')).toBe('true');
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'HideCursorsOn');
    fireEvent.click(row);
    expect(row.getAttribute('aria-checked')).toBe('false');
  });
});

describe('HideCursorsFooter', () => {
  it('holds the switch where the tab draws cursors (no provider says otherwise)', () => {
    configureWorkbench(testBindings({ hideCursorsKey: 'test:footer-a' }));
    render(<HideCursorsFooter />);
    expect(screen.getByRole('switch', { name: /Hide Participant Cursors/ })).toBeTruthy();
  });

  it('is nothing at all where the tab draws none, its stored choice kept', () => {
    configureWorkbench(testBindings({ hideCursorsKey: 'test:footer-b' }));
    window.localStorage.setItem('test:footer-b', 'true');
    const { container } = render(
      <CursorsDrawnContext.Provider value={false}>
        <HideCursorsFooter />
      </CursorsDrawnContext.Provider>,
    );
    expect(container.innerHTML).toBe('');
    expect(window.localStorage.getItem('test:footer-b')).toBe('true');
  });
});
