// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabModeMenuSection } from './TabModeMenuSection';

afterEach(() => {
  cleanup();
});

function setup(over: Partial<Parameters<typeof TabModeMenuSection>[0]['choice']> = {}) {
  const onChange = vi.fn();
  const onToggle = vi.fn();
  render(
    // As the Tab control menu holds it (docs/specs/004-interface-design/menus.md).
    <div role="dialog" aria-label="Tab menu">
      <TabModeMenuSection choice={{ mode: 'draw', onChange, ...over }} open onToggle={onToggle} />
    </div>,
  );
  return { onChange, onToggle };
}

const choices = () => within(screen.getByRole('group', { name: 'Mode' })).getAllByRole('button');

// docs/specs/007-editor/editor-modes.md "Where the mode lives" (the tab menu's Mode): every editor mode as a one-of-a-set choice, a
// toggle button in the Tab control menu (docs/specs/004-interface-design/menus.md, D55).
describe('TabModeMenuSection', () => {
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
    ]);
    expect(items.map((i) => i.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
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

  it('opens and closes as one of the menu’s categories', () => {
    const { onToggle } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Mode/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
