// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import type { Participant } from '@/lib/identity';
import type { SaveLocationId } from '@/lib/save-locations';
import { TemplatePicker } from './TemplatePicker';

// docs/specs/006-document/save-locations.md "The default depends on who is creating": the wizard selects
// the caller's default until the reader picks a tile, re-reading it as auth settles.

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
Element.prototype.scrollTo ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
afterEach(cleanup);

const participant: Participant = { id: 'p1', name: 'Ada', color: '#0ea5e9', status: 'online' };

function wizard(defaultSaveLocation: SaveLocationId | undefined, onPick = vi.fn()) {
  return (
    <TemplatePicker
      mode="welcome"
      participant={participant}
      currentThemeId="brand"
      onPick={onPick}
      onSkip={vi.fn()}
      onBackOut={vi.fn()}
      defaultSaveLocation={defaultSaveLocation}
    />
  );
}
const checked = (name: RegExp) => screen.getByRole('radio', { name }).getAttribute('aria-checked');
const sentLocation = (onPick: ReturnType<typeof vi.fn>) =>
  (onPick.mock.calls[0]![3] as { saveLocation: SaveLocationId }).saveLocation;

describe('the Save location default', () => {
  it('selects livediagram when the caller names none', () => {
    const onPick = vi.fn();
    render(wizard(undefined, onPick));
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(checked(/^livediagram/)).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(sentLocation(onPick)).toBe('livediagram');
  });

  it("selects a guest's Local Browser and creates there", () => {
    const onPick = vi.fn();
    render(wizard('browser', onPick));
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(checked(/Local Browser/)).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(sentLocation(onPick)).toBe('browser');
  });

  it('follows the default until the reader picks, then keeps the pick', () => {
    const onPick = vi.fn();
    const { rerender } = render(wizard('browser', onPick));
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    // Auth settles signed in.
    rerender(wizard('livediagram', onPick));
    expect(checked(/^livediagram/)).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /Local Browser/ }));
    rerender(wizard('livediagram', onPick));
    expect(checked(/Local Browser/)).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(sentLocation(onPick)).toBe('browser');
  });
});
