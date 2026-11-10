// @vitest-environment jsdom

// A connected tab (connected-tabs.md "How it looks"): the target app's logo before the name, the arrow for another
// app, the amber dot when it opens nothing, never renamed by hand.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectedTab, type ConnectedTabProps } from './ConnectedTab';
import {
  resetConnectedTabStoreForTests,
  setConnectedTabBroken,
} from '../connect/connected-tab-store';

afterEach(cleanup);

const props = (over: Partial<ConnectedTabProps> = {}): ConnectedTabProps => ({
  id: 't1',
  name: 'Launch plan',
  active: true,
  readOnly: false,
  onSelect: vi.fn(),
  connection: { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'plan1' },
  hostApp: 'livediagram',
  ...over,
});

describe('ConnectedTab', () => {
  it('leads with the target app logo and says what it is', () => {
    const { container } = render(<ConnectedTab {...props()} />);
    const tab = screen.getByRole('button', {
      name: 'Launch plan, connected liveplanner file',
    });
    expect(tab.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-connected-away]')).not.toBeNull();
    expect(container.querySelector('[data-connected-broken]')).toBeNull();
  });

  it('carries no arrow for a file in the same app', () => {
    const { container } = render(
      <ConnectedTab
        {...props({
          connection: { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'livediagram', itemId: 'd2' },
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Launch plan, connected livediagram file' }),
    ).toBeTruthy();
    expect(container.querySelector('[data-connected-away]')).toBeNull();
  });

  it('shows the amber dot in place of the arrow when it opens nothing', () => {
    const { container } = render(<ConnectedTab {...props({ broken: true })} />);
    expect(container.querySelector('[data-connected-broken]')).not.toBeNull();
    expect(container.querySelector('[data-connected-away]')).toBeNull();
    expect(screen.getByRole('button', { name: /needs attention/ })).toBeTruthy();
  });

  it('selects on a press and is never renamed by a double-click', () => {
    const onSelect = vi.fn();
    render(<ConnectedTab {...props({ onSelect })} />);
    const tab = screen.getByRole('button', { name: /Launch plan/ });
    fireEvent.click(tab);
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(tab);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps the menu slot like any tab', () => {
    render(<ConnectedTab {...props({ menu: <button type="button">Tab menu</button> })} />);
    expect(screen.getByRole('button', { name: 'Tab menu' })).toBeTruthy();
  });

  it('shows the dot the last open found', () => {
    resetConnectedTabStoreForTests();
    const { container } = render(<ConnectedTab {...props()} />);
    expect(container.querySelector('[data-connected-broken]')).toBeNull();
    act(() => setConnectedTabBroken('cn_abcdefghijklmnopqrstuvwx', true));
    expect(container.querySelector('[data-connected-broken]')).not.toBeNull();
    resetConnectedTabStoreForTests();
  });
});
