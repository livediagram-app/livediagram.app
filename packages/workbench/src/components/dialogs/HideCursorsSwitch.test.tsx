// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, resetWorkbenchForTests } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { HideCursorsSwitch } from './HideCursorsSwitch';

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
