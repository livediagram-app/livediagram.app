// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { UseAsDefaultMenu } from './UseAsDefaultMenu';

// The submenu (docs/specs/013-workspace/default-folders.md "Use as default for"): the six entries
// as checkable items under "New documents that open as".

beforeAll(() => {
  // jsdom has no ResizeObserver; the flyout's measuring is not under test here.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

function open(menu: Parameters<typeof UseAsDefaultMenu>[0]['menu']) {
  render(<UseAsDefaultMenu menu={menu} />);
  const trigger = screen.getByRole('button', { name: /use as default for/i });
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  fireEvent.click(trigger);
}

describe('UseAsDefaultMenu', () => {
  it('lists the entries as checkable items, checked where the folder holds them', () => {
    open({
      isChecked: (key) => key === 'mode:draw',
      isDisabled: () => false,
      toggle: () => {},
    });
    expect(screen.getByText('New documents that open as')).toBeTruthy();
    const items = screen.getAllByRole('menuitemcheckbox');
    expect(items.map((i) => i.textContent)).toEqual([
      'Diagrams',
      'Whiteboards',
      'Infographics',
      'Event Storming boards',
      'Retrospectives',
      'Kanban boards',
    ]);
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it('toggles an entry, and stays open', () => {
    const toggle = vi.fn<(key: PlacementDefaultKey) => void>();
    open({ isChecked: () => false, isDisabled: () => false, toggle });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Retrospectives' }));
    expect(toggle).toHaveBeenCalledWith('template:retrospective');
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(6);
  });

  it('keeps a disabled entry in place and inert', () => {
    const toggle = vi.fn();
    open({ isChecked: () => true, isDisabled: (key) => key === 'mode:diagram', toggle });
    const diagrams = screen.getByRole('menuitemcheckbox', { name: 'Diagrams' });
    expect(diagrams.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(diagrams);
    expect(toggle).not.toHaveBeenCalled();
  });
});
