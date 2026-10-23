// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PlacementDefaultKey } from '@livedocuments/api-schema';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import { UseAsDefaultMenu } from './UseAsDefaultMenu';

// The submenu (docs/specs/013-workspace/default-folders.md "Use as Default for"): the entries as
// checkable items under "New documents that open as".

beforeAll(() => {
  // jsdom has no ResizeObserver; the flyout's measuring is not under test here.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// Inside the folder menu, a command menu, as every host renders it.
function open(menu: Parameters<typeof UseAsDefaultMenu>[0]['menu']) {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  render(
    <PortalMenu anchor={anchor} onClose={() => {}}>
      <UseAsDefaultMenu menu={menu} />
    </PortalMenu>,
  );
  const trigger = screen.getByRole('menuitem', { name: /use as default for/i });
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
}

describe('UseAsDefaultMenu', () => {
  it('is a submenu named by its header, reached and left by the arrow keys', () => {
    open({ isChecked: () => false, isDisabled: () => false, toggle: () => {} });
    const sub = screen.getByRole('menu', { name: 'New documents that open as' });
    const trigger = screen.getByRole('menuitem', { name: /use as default for/i });
    expect(trigger.getAttribute('aria-controls')).toBe(sub.id);
    expect(document.activeElement?.textContent).toBe('Documents');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.queryByRole('menu', { name: 'New documents that open as' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('lists the entries as checkable items, checked where the folder holds them', () => {
    open({
      isChecked: (key) => key === 'mode:pages',
      isDisabled: () => false,
      toggle: () => {},
    });
    expect(screen.getByText('New documents that open as')).toBeTruthy();
    const items = screen.getAllByRole('menuitemcheckbox');
    expect(items.map((i) => i.textContent)).toEqual(['Documents']);
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true']);
  });

  it('toggles an entry, and stays open', () => {
    const toggle = vi.fn<(key: PlacementDefaultKey) => void>();
    open({ isChecked: () => false, isDisabled: () => false, toggle });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Documents' }));
    expect(toggle).toHaveBeenCalledWith('mode:pages');
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(1);
  });

  it('keeps a disabled entry in place and inert', () => {
    const toggle = vi.fn();
    open({ isChecked: () => true, isDisabled: (key) => key === 'mode:pages', toggle });
    const documents = screen.getByRole('menuitemcheckbox', { name: 'Documents' });
    expect(documents.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(documents);
    expect(toggle).not.toHaveBeenCalled();
  });
});
