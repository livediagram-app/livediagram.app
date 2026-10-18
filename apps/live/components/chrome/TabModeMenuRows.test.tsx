// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { confirm } = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => confirm }));

import { TabModeMenuRows } from './TabModeMenuRows';

afterEach(() => {
  cleanup();
  confirm.mockReset();
});

function setup(over: Partial<Parameters<typeof TabModeMenuRows>[0]['choice']> = {}) {
  const onChange = vi.fn();
  render(
    // As the Tab control menu holds it (docs/specs/004-interface-design/menus.md).
    <div role="dialog" aria-label="Tab menu">
      <TabModeMenuRows choice={{ mode: 'draw', onChange, ...over }} />
    </div>,
  );
  fireEvent.click(screen.getByRole('button', { name: /^Mode/ }));
  return { onChange };
}

const choices = () => within(screen.getByRole('group', { name: 'Mode' })).getAllByRole('button');

// docs/specs/007-editor/editor-modes.md "Mode in the tab menu": one Mode section, closed until opened, holding every
// editor mode as a one-of-a-set choice, a toggle button in the Tab control menu (docs/specs/004-interface-design/menus.md,
// D55); a mode across Plan's line asks for a new tab.
describe('TabModeMenuRows', () => {
  it('is one Mode section, closed until opened', () => {
    render(
      <div role="dialog" aria-label="Tab menu">
        <TabModeMenuRows choice={{ mode: 'draw', onChange: vi.fn() }} />
      </div>,
    );
    expect(screen.getByRole('button', { name: /^Mode/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it("lists every editor mode, Plan too, the tab's one checked", () => {
    setup();
    const items = choices();
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Diagram'),
      expect.stringContaining('Draw'),
      expect.stringContaining('Facilitate'),
      expect.stringContaining('Pages'),
      expect.stringContaining('Plan'),
    ]);
    expect(items.map((i) => i.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('switches the tab on a choice beside its own', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Diagram/ }));
    expect(onChange).toHaveBeenCalledWith('diagram');
  });

  it('does nothing for the mode already chosen', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Draw/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('asks for a new tab across Plan’s line, and opens one when confirmed', async () => {
    confirm.mockResolvedValue(true);
    const newTabIn = vi.fn();
    const { onChange } = setup({ newTabIn });
    fireEvent.click(screen.getByRole('button', { name: /^Plan/ }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Open a New Plan Tab?' }),
    );
    await waitFor(() => expect(newTabIn).toHaveBeenCalledWith('plan'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows Plan inert where no new tab can be added', () => {
    setup();
    const plan = screen.getByRole('button', { name: /^Plan/ });
    expect(plan.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(plan);
    expect(confirm).not.toHaveBeenCalled();
  });
});
