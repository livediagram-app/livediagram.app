// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livediagram/document';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { StartModeSwitch } from './StartModeSwitch';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const transition = vi.hoisted(() => vi.fn((_type: string, change: () => void) => change()));
vi.mock('@/lib/view-transition', () => ({ startTypedTransition: transition }));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => async () => true }));
afterEach(cleanup);

// docs/specs/007-editor/start-diagramming.md "Changing mode"
const mount = (mode: EditorMode, canEdit = true) => {
  const setMode = vi.fn();
  render(
    <EditorModeProvider value={{ mode, setMode, canSwitch: true, canEdit }}>
      <StartModeSwitch />
    </EditorModeProvider>,
  );
  return setMode;
};

describe('StartModeSwitch', () => {
  it('names the mode and opens its menu, switching the tab', () => {
    const setMode = mount('diagram');
    const chip = screen.getByRole('button', { name: /^Tab mode: Diagram/ });
    expect(chip.textContent).toContain('Diagram');
    // Not the tours' anchor: that is the top chrome's chip.
    expect(chip.getAttribute('data-tour-id')).toBeNull();
    fireEvent.click(chip);
    expect(screen.getByRole('menu').className).toMatch(/top-full/);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Pages/ }));
    expect(setMode).toHaveBeenCalledWith('pages');
  });

  it('switches inside a start-mode transition, so the start cross-fades', () => {
    const setMode = mount('diagram');
    fireEvent.click(screen.getByRole('button', { name: /^Tab mode: Diagram/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Pages/ }));
    expect(transition).toHaveBeenCalledWith('start-mode', expect.any(Function));
    expect(setMode).toHaveBeenCalledOnce();
  });

  it('shows nothing to someone who cannot edit', () => {
    mount('diagram', false);
    expect(screen.queryByRole('button', { name: /^Tab mode:/ })).toBeNull();
  });
});
