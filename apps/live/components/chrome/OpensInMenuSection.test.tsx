// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpensInMenuSection } from './OpensInMenuSection';
import { setIllustrateModeEnabled, setPlanModeEnabled } from '@/lib/offered-editor-modes';

afterEach(() => {
  cleanup();
  setIllustrateModeEnabled(false);
  setPlanModeEnabled(false);
});

function setup(over: Partial<Parameters<typeof OpensInMenuSection>[0]['choice']> = {}) {
  const onChange = vi.fn();
  const onToggle = vi.fn();
  render(
    // As the Tab control menu holds it (docs/specs/004-interface-design/menus.md).
    <div role="dialog" aria-label="Tab menu">
      <OpensInMenuSection
        choice={{ mode: 'draw', onChange, disabled: false, ...over }}
        open
        onToggle={onToggle}
      />
    </div>,
  );
  return { onChange, onToggle };
}

const choices = () =>
  within(screen.getByRole('group', { name: 'Opens in' })).getAllByRole('button');

// docs/specs/007-editor/editor-modes.md "Opens in": every editor mode as a one-of-a-set choice, a
// toggle button in the Tab control menu (docs/specs/004-interface-design/menus.md, D55).
describe('OpensInMenuSection', () => {
  it('lists every offered editor mode from the catalogue, the opening one checked', () => {
    setIllustrateModeEnabled(true);
    setPlanModeEnabled(true);
    setup();
    const group = screen.getByRole('group', { name: 'Opens in' });
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

  it('leaves out Illustrate and Plan while they are switched off in Settings', () => {
    setup();
    expect(choices().map((i) => i.textContent)).toEqual([
      expect.stringContaining('Diagram'),
      expect.stringContaining('Draw'),
    ]);
  });

  it('sets the opening mode on a choice', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Diagram/ }));
    expect(onChange).toHaveBeenCalledWith('diagram');
  });

  it('passes the mode already chosen through, so it can switch the chooser back to it', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Draw/ }));
    expect(onChange).toHaveBeenCalledWith('draw');
  });

  it('greys every choice out on a locked tab', () => {
    const { onChange } = setup({ disabled: true });
    const diagram = screen.getByRole('button', { name: /Diagram/ });
    expect(diagram.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(diagram);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens and closes as one of the menu’s categories', () => {
    const { onToggle } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Opens in/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
