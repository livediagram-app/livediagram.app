// @vitest-environment jsdom

// A connected tab with a name of its own (connected-tabs.md "A tab's own name"): its rename field and double-click pass
// through, its tooltip names the file ("Connected to <file>", the full name first when it is cut short) and a screen
// reader hears the file after the phrase.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectedTab, type ConnectedTabProps } from './ConnectedTab';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const props = (over: Partial<ConnectedTabProps> = {}): ConnectedTabProps => ({
  id: 't1',
  name: 'Plan',
  active: true,
  readOnly: false,
  onSelect: vi.fn(),
  connection: { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'plan1' },
  hostApp: 'livediagram',
  ...over,
});

// The Tooltip opens after its hover delay.
const hoverTooltip = (el: HTMLElement) => {
  vi.useFakeTimers();
  fireEvent.pointerEnter(el);
  fireEvent.mouseEnter(el);
  fireEvent.focus(el);
  act(() => {
    vi.advanceTimersByTime(2000);
  });
};

describe('ConnectedTab with a name of its own', () => {
  it('names the file for a screen reader and in its tooltip', () => {
    render(<ConnectedTab {...props({ targetName: 'Launch plan' })} />);
    const tab = screen.getByRole('button', {
      name: 'Plan, connected to Launch plan, a liveplanner file',
    });
    hoverTooltip(tab);
    expect(screen.getAllByText('Connected to Launch plan').length).toBeGreaterThan(0);
  });

  it('leads its tooltip with the full name when the name is cut short', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(50);
    render(<ConnectedTab {...props({ targetName: 'Launch plan', broken: true })} />);
    const tab = screen.getByRole('button', {
      name: 'Plan, connected to Launch plan, a liveplanner file, needs attention',
    });
    hoverTooltip(tab);
    expect(screen.getAllByText('Plan, connected to Launch plan').length).toBeGreaterThan(0);
  });

  it('opens its rename field on a double-click and shows it in place of the name', () => {
    const onRequestRename = vi.fn();
    const { rerender } = render(<ConnectedTab {...props({ onRequestRename })} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: /^Plan/ }));
    expect(onRequestRename).toHaveBeenCalled();
    rerender(<ConnectedTab {...props({ renameField: <input aria-label="Tab name" /> })} />);
    expect(screen.getByRole('textbox', { name: 'Tab name' })).toBeTruthy();
  });
});
