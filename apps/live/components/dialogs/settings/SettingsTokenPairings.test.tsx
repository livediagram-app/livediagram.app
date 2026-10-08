// @vitest-environment jsdom
// A token card's paired workbenches (docs/specs/013-workspace/blueprints/workbench-embeds.md "Settings > API
// tokens", WB35, WB36): nothing when none; a row each with name, origin, when paired and Unpair, which asks first.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { WorkbenchPairing } from '@livediagram/api-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsTokenPairings } from './SettingsTokenPairings';

const NOW = Date.UTC(2026, 9, 7, 12);
const DAY = 86_400_000;
const ACME: WorkbenchPairing = {
  id: 'p1',
  tokenId: 'tok1',
  origin: 'https://127.0.0.1:5175',
  name: 'Acme Editor',
  pairedAt: NOW - 2 * DAY,
};
const UNNAMED: WorkbenchPairing = {
  id: 'p2',
  tokenId: 'tok1',
  origin: 'http://localhost:4000',
  name: null,
  pairedAt: NOW - 30_000,
};

function rows(list: HTMLElement): { first: HTMLElement; second: HTMLElement } {
  const [first, second] = within(list).getAllByRole('listitem');
  if (!first || !second) throw new Error('expected two rows');
  return { first, second };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SettingsTokenPairings', () => {
  it('renders nothing for a token with no pairings', () => {
    const { container } = render(
      <SettingsTokenPairings pairings={[]} now={NOW} onUnpair={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('lists each workbench with its name, origin in monospace and when it was paired', () => {
    render(<SettingsTokenPairings pairings={[ACME, UNNAMED]} now={NOW} onUnpair={vi.fn()} />);
    const list = screen.getByRole('list', { name: 'Paired workbenches' });
    expect(screen.getByText('Paired workbenches')).toBeTruthy();
    const { first, second } = rows(list);

    expect(within(first).getByText('Acme Editor')).toBeTruthy();
    const origin = within(first).getByText('https://127.0.0.1:5175');
    expect(origin.tagName).toBe('CODE');
    expect(origin.className).toContain('font-mono');
    expect(within(first).getByText('Paired 2 days ago')).toBeTruthy();

    expect(within(second).getByText('Unnamed workbench')).toBeTruthy();
    expect(within(second).getByText('Paired just now')).toBeTruthy();
  });

  it('names each Unpair by the workbench and its origin', () => {
    render(<SettingsTokenPairings pairings={[ACME, UNNAMED]} now={NOW} onUnpair={vi.fn()} />);
    const unpair = screen.getByRole('button', { name: 'Unpair Acme Editor at https://127.0.0.1:5175' });
    expect(unpair.textContent).toBe('Unpair');
    expect(
      screen.getByRole('button', { name: 'Unpair Unnamed workbench at http://localhost:4000' }),
    ).toBeTruthy();
  });

  it('asks before unpairing, then unpairs that pairing', () => {
    const onUnpair = vi.fn();
    render(<SettingsTokenPairings pairings={[ACME]} now={NOW} onUnpair={onUnpair} />);
    fireEvent.click(screen.getByRole('button', { name: /^Unpair Acme Editor at/ }));
    expect(onUnpair).not.toHaveBeenCalled();
    expect(
      screen.getByText('Unpair Acme Editor? Its open diagrams stop editing until you allow it again.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Unpair' }));
    expect(onUnpair).toHaveBeenCalledWith('p1');
    expect(screen.queryByText(/Its open diagrams stop editing/)).toBeNull();
  });

  it('asks about an unnamed workbench by its display name', () => {
    render(<SettingsTokenPairings pairings={[UNNAMED]} now={NOW} onUnpair={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Unpair Unnamed workbench at/ }));
    expect(
      screen.getByText(
        'Unpair Unnamed workbench? Its open diagrams stop editing until you allow it again.',
      ),
    ).toBeTruthy();
  });

  it('cancels without unpairing', () => {
    const onUnpair = vi.fn();
    render(<SettingsTokenPairings pairings={[ACME]} now={NOW} onUnpair={onUnpair} />);
    fireEvent.click(screen.getByRole('button', { name: /^Unpair Acme Editor at/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onUnpair).not.toHaveBeenCalled();
    expect(screen.queryByText(/Its open diagrams stop editing/)).toBeNull();
  });
});
