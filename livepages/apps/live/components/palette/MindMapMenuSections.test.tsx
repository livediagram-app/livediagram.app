// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MindMapMenuSections } from './MindMapMenuSections';

// docs/specs/009-elements/mind-node.md "The Mind Map menu": a Mind Map flyout row holding Outline, Branching and
// Spacing, each a closed category around a list of full-width rows.

// The flyout panel tracks its own size, which jsdom cannot.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function renderMenu(
  over: Partial<Parameters<typeof MindMapMenuSections>[0]> = {},
  // Every category open by default, so a case can reach its rows; the first case closes them.
  open = true,
) {
  const props = {
    sectionProps: () => ({ open, onToggle: vi.fn() }),
    flyoutProps: {},
    flow: 'tree' as const,
    spacing: 'comfortable' as const,
    onSetFlow: vi.fn(),
    onSetSpacing: vi.fn(),
    onTidy: vi.fn(),
    onEditOutline: vi.fn(),
    onSelectBranch: vi.fn(),
    onSelectMap: vi.fn(),
    ...over,
  };
  render(<MindMapMenuSections {...props} />);
  // The Mind Map row opens its flyout of categories.
  fireEvent.click(screen.getByRole('button', { name: /Mind Map/ }));
  return props;
}

describe('MindMapMenuSections', () => {
  it('opens a flyout of three closed categories', () => {
    renderMenu({}, false);
    for (const title of ['Outline', 'Branching', 'Spacing'])
      expect(screen.getByRole('button', { name: title }).getAttribute('aria-expanded')).toBe(
        'false',
      );
  });

  it('opens each category on its own', () => {
    const sectionProps = vi.fn((id: string) => ({
      open: id === 'mind-branching',
      onToggle: vi.fn(),
    }));
    renderMenu({ sectionProps });
    expect(sectionProps.mock.calls.map(([id]) => id)).toEqual(
      expect.arrayContaining(['mind-outline', 'mind-branching', 'mind-spacing']),
    );
    expect(screen.getByRole('button', { name: 'Branching' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Spacing' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('runs each Outline action', () => {
    const p = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Outline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tidy Map' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Branch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Whole Map' }));
    expect(p.onEditOutline).toHaveBeenCalledOnce();
    expect(p.onTidy).toHaveBeenCalledOnce();
    expect(p.onSelectBranch).toHaveBeenCalledOnce();
    expect(p.onSelectMap).toHaveBeenCalledOnce();
  });

  it('leaves Edit Outline out when it cannot be edited', () => {
    renderMenu({ onEditOutline: undefined });
    expect(screen.queryByRole('button', { name: 'Edit Outline' })).toBeNull();
  });

  it('lists the six flows with the current one checked, and picks one', () => {
    const p = renderMenu({ flow: 'upward' });
    const group = screen.getByRole('radiogroup', { name: 'Branching' });
    const radios = [...group.querySelectorAll('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual([
      'Tree',
      'Leftward',
      'Balanced',
      'Downward',
      'Upward',
      'Bubble',
    ]);
    expect(group.querySelector('[aria-checked="true"]')?.getAttribute('data-option')).toBe(
      'upward',
    );
    fireEvent.click(group.querySelector('[data-option="leftward"]')!);
    expect(p.onSetFlow).toHaveBeenCalledWith('leftward');
  });

  it('lists the four spacings and picks one', () => {
    const p = renderMenu({ spacing: 'tight' });
    const group = screen.getByRole('radiogroup', { name: 'Spacing' });
    expect(
      [...group.querySelectorAll('[role="radio"]')].map((r) => r.getAttribute('data-option')),
    ).toEqual(['tight', 'compact', 'comfortable', 'wide']);
    expect(group.querySelector('[aria-checked="true"]')?.getAttribute('data-option')).toBe('tight');
    fireEvent.click(group.querySelector('[data-option="wide"]')!);
    expect(p.onSetSpacing).toHaveBeenCalledWith('wide');
  });
});
