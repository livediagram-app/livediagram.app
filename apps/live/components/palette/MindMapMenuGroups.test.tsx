// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MindMapMenuGroups } from './MindMapMenuGroups';

// docs/specs/009-elements/mind-node.md "The Mind Map menu": Outline, Branching and Spacing, each a list of
// full-width rows.

afterEach(cleanup);

function renderMenu(over: Partial<Parameters<typeof MindMapMenuGroups>[0]> = {}) {
  const props = {
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
  render(<MindMapMenuGroups {...props} />);
  return props;
}

describe('MindMapMenuGroups', () => {
  it('shows the three groups under their headings', () => {
    renderMenu();
    for (const heading of ['Outline', 'Branching', 'Spacing'])
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
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
    expect(radios.map((r) => r.textContent?.split('Branches')[0])).toEqual([
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
