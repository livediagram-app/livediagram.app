// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabModeMenuRows } from './TabModeMenuRows';

afterEach(() => {
  cleanup();
});

function setup(over: Partial<Parameters<typeof TabModeMenuRows>[0]['choice']> = {}) {
  const onChange = vi.fn();
  render(
    // As the Tab control menu holds it (docs/specs/004-interface-design/menus.md).
    <div role="dialog" aria-label="Tab menu">
      <TabModeMenuRows choice={{ mode: 'draw', onChange, ...over }} />
    </div>,
  );
  return { onChange };
}

const choices = () => within(screen.getByRole('group', { name: 'Mode' })).getAllByRole('button');

// docs/specs/007-editor/editor-modes.md "Where the mode lives" (the tab menu's Mode): every editor mode as a one-of-a-set choice, a
// toggle button in the Tab control menu (docs/specs/004-interface-design/menus.md, D55).
describe('TabModeMenuRows', () => {
  it("lists every editor mode from the catalogue, the tab's one checked", () => {
    setup();
    const group = screen.getByRole('group', { name: 'Mode' });
    expect(group).toBeTruthy();
    const items = choices();
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Diagram'),
      expect.stringContaining('Draw'),
      expect.stringContaining('Illustrate'),
      expect.stringContaining('Plan'),
      expect.stringContaining('Facilitate'),
    ]);
    expect(items.map((i) => i.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('switches the tab on a choice', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Diagram/ }));
    expect(onChange).toHaveBeenCalledWith('diagram');
  });

  it('does nothing for the mode already chosen', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Draw/ }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
