// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockNamesProvider } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { WalkClusterButton } from './WalkClusterButton';

afterEach(cleanup);

// docs/specs/008-canvas/avatar-mode.md "The Walk button": a Viewer's way in to Avatar mode and back out.
describe('WalkClusterButton', () => {
  const walk = (walking: boolean, onToggle = vi.fn()) => {
    render(<WalkClusterButton walking={walking} onToggle={onToggle} icon={<svg />} />);
    return { onToggle, button: screen.getByRole('button', { name: 'Walk' }) };
  };

  it('is a toggle named Walk, not pressed while you are not walking', () => {
    const { button, onToggle } = walk(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows pressed while you walk, and a press then toggles you back out', () => {
    const { button, onToggle } = walk(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.className).toContain('bg-brand-100');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('keeps its press off the canvas and its context menu shut', () => {
    const outside = vi.fn();
    render(
      <div onPointerDown={outside} onContextMenu={outside}>
        <WalkClusterButton walking={false} onToggle={() => {}} icon={<svg />} />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Walk' });
    fireEvent.pointerDown(button);
    fireEvent.contextMenu(button);
    expect(outside).not.toHaveBeenCalled();
  });

  it('is named Walk beside its icon on a wide desktop', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    try {
      render(<WalkClusterButton walking={false} onToggle={() => {}} icon={<svg />} />);
      expect(screen.getByText('Walk')).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is its icon alone on a narrow screen, with no visible name', () => {
    render(
      <DockNamesProvider value={false}>
        <WalkClusterButton walking={false} onToggle={() => {}} icon={<svg />} />
      </DockNamesProvider>,
    );
    expect(screen.queryByText('Walk')).toBeNull();
  });
});
