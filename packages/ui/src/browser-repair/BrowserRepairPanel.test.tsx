// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRepairPanel } from './BrowserRepairPanel';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function setClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

describe('BrowserRepairPanel', () => {
  it('copies the report and confirms', async () => {
    const writeText = vi.fn(async () => {});
    setClipboard(writeText);
    const onCopied = vi.fn();
    render(
      <BrowserRepairPanel
        buildReport={async () => 'REPORT'}
        onCopied={onCopied}
        onRepaired={() => {}}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy diagnostics/i }));
    });
    expect(writeText).toHaveBeenCalledWith('REPORT');
    expect(onCopied).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /copied/i })).toBeTruthy();
  });

  it('shows the report to copy by hand when the clipboard is refused', async () => {
    setClipboard(async () => {
      throw new Error('denied');
    });
    document.execCommand = vi.fn(() => false);
    render(<BrowserRepairPanel buildReport={async () => 'REPORT'} onRepaired={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy diagnostics/i }));
    });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('REPORT');
  });

  it('asks before repairing, then clears and reports the count', () => {
    window.localStorage.setItem('livediagram:v2:self-id', 'guest');
    window.localStorage.setItem('livediagram:v2:ui-mode', 'x');
    const order: string[] = [];
    const onRepairStart = vi.fn(() => order.push('start'));
    const onRepaired = vi.fn(() => order.push('done'));
    render(
      <BrowserRepairPanel
        buildReport={async () => ''}
        onRepairStart={onRepairStart}
        onRepaired={onRepaired}
      />,
    );
    const toggle = screen.getByRole('button', { name: /repair this browser/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/guest identity, Offline Mode documents/)).toBeTruthy();
    // Nothing cleared until the confirm.
    expect(window.localStorage.getItem('livediagram:v2:ui-mode')).toBe('x');

    fireEvent.click(screen.getByRole('button', { name: 'Repair and Reload' }));
    expect(order).toEqual(['start', 'done']);
    expect(onRepaired).toHaveBeenCalledWith(1);
    expect(window.localStorage.getItem('livediagram:v2:ui-mode')).toBeNull();
    expect(window.localStorage.getItem('livediagram:v2:self-id')).toBe('guest');
  });

  it('cancels without clearing', () => {
    window.localStorage.setItem('livediagram:v2:ui-mode', 'x');
    render(<BrowserRepairPanel buildReport={async () => ''} onRepaired={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /repair this browser/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(window.localStorage.getItem('livediagram:v2:ui-mode')).toBe('x');
  });
});
