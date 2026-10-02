// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpensInMenuSection } from './OpensInMenuSection';

afterEach(cleanup);

function setup(over: Partial<Parameters<typeof OpensInMenuSection>[0]['choice']> = {}) {
  const onChange = vi.fn();
  const onToggle = vi.fn();
  render(
    <div role="menu">
      <OpensInMenuSection
        choice={{ mode: 'draw', onChange, disabled: false, ...over }}
        open
        onToggle={onToggle}
      />
    </div>,
  );
  return { onChange, onToggle };
}

// docs/specs/007-editor/editor-modes.md "Opens in": every editor mode as a radio choice.
describe('OpensInMenuSection', () => {
  it('lists every editor mode from the catalogue, the opening one checked', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Opens in' });
    expect(group).toBeTruthy();
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Diagram'),
      expect.stringContaining('Draw'),
    ]);
    expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });

  it('sets the opening mode on a choice', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Diagram/ }));
    expect(onChange).toHaveBeenCalledWith('diagram');
  });

  it('does nothing for the mode already chosen', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Draw/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('greys every choice out on a locked tab', () => {
    const { onChange } = setup({ disabled: true });
    const diagram = screen.getByRole('menuitemradio', { name: /Diagram/ });
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
