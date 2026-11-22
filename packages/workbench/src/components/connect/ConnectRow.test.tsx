// @vitest-environment jsdom
// A row of the Connect picker: a blocked row says why, and one a step in another app may not pick (an item only
// viewed) carries its lock pill.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { ConnectRow } from './ConnectRow';

afterEach(cleanup);

const ITEM = {
  id: 'p2',
  app: 'liveplanner',
  title: 'Finance Plan',
  access: 'view',
  updatedAt: Date.UTC(2026, 10, 20),
  lastOpenedAt: null,
} as unknown as Item;

const row = (state: Parameters<typeof ConnectRow>[0]['state'], onPress = vi.fn()) =>
  render(
    <ul>
      <ConnectRow
        item={ITEM}
        state={state}
        error={null}
        now={Date.UTC(2026, 10, 22)}
        onPress={onPress}
      />
    </ul>,
  );

describe('a blocked row', () => {
  it('shows its lock pill and why, and presses nothing', () => {
    const onPress = vi.fn();
    row(
      { kind: 'blocked', reason: 'You can open it, but not edit it', lock: 'View Only' },
      onPress,
    );
    expect(screen.getByText('View Only')).toBeTruthy();
    expect(screen.getByText('You can open it, but not edit it')).toBeTruthy();
    fireEvent.click(screen.getByText('Finance Plan'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows no pill without a lock', () => {
    row({ kind: 'blocked', reason: 'Already connected' });
    expect(screen.queryByText('View Only')).toBeNull();
    expect(screen.getByText('Already connected')).toBeTruthy();
  });
});
