// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasThemeDialog } from './CanvasThemeDialog';

// docs/specs/011-theme/canvas-and-theme-dialog.md: a popover flying out of the paintbrush, else the centred dialog.
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const props = {
  tab: 'canvas' as const,
  onTabChange: vi.fn(),
  backgroundPattern: 'grid' as const,
  backgroundColor: '#ffffff',
  patternColor: '#cccccc',
  backgroundOpacity: 1,
  backgroundPatternScale: 1,
  backgroundAnimationSpeed: 1,
  onSetBackgroundPattern: vi.fn(),
  onSetBackgroundColor: vi.fn(),
  onSetPatternColor: vi.fn(),
  onSetBackgroundOpacity: vi.fn(),
  onSetBackgroundPatternScale: vi.fn(),
  onSetBackgroundAnimationSpeed: vi.fn(),
  themeId: 'default',
  onSetTheme: vi.fn(),
  onResetElementsToTheme: vi.fn(),
  font: null,
  onSetFont: vi.fn(),
  defaultTextSize: undefined,
  onSetDefaultTextSize: vi.fn(),
  onApplyFontToAll: vi.fn(),
  finish: undefined,
  onSetFinish: vi.fn(),
  onApplyFinishToAll: vi.fn(),
  onClose: vi.fn(),
};

describe('CanvasThemeDialog placement', () => {
  it('sits just above the paintbrush, right edges aligned', () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    const brush = document.createElement('button');
    brush.setAttribute('data-tour-id', 'canvas-theme');
    brush.getBoundingClientRect = () =>
      ({ left: 1360, right: 1404, top: 840, bottom: 884, width: 44, height: 44 }) as DOMRect;
    document.body.appendChild(brush);
    render(<CanvasThemeDialog {...props} />);
    const panel = screen.getByRole('dialog', { name: 'Tab look and feel' });
    expect(panel.style.right).toBe('36px');
    expect(panel.style.bottom).toBe('68px');
  });

  it('is the centred dialog without a brush', () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    render(<CanvasThemeDialog {...props} />);
    expect(screen.getByRole('dialog', { name: 'Tab look and feel' }).style.right).toBe('');
  });
});

// docs/specs/008-canvas/finish.md "Where it is set": the Finish tab sets the tab's finish and clears every
// element's own.
describe('CanvasThemeDialog Finish tab', () => {
  it('is in the tab strip and opens on request', () => {
    const onTabChange = vi.fn();
    render(<CanvasThemeDialog {...props} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onTabChange).toHaveBeenCalledWith('finish');
  });

  it('presses Flexible for a tab without a finish, and sets the one clicked', () => {
    const onSetFinish = vi.fn();
    render(<CanvasThemeDialog {...props} tab="finish" onSetFinish={onSetFinish} />);
    expect(screen.getByRole('button', { name: 'Flexible' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sketch' }));
    expect(onSetFinish).toHaveBeenCalledWith('sketch');
  });

  it("presses the tab's finish", () => {
    render(<CanvasThemeDialog {...props} tab="finish" finish="professional" />);
    expect(screen.getByRole('button', { name: 'Professional' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('Apply to All Elements clears the elements’ own finishes', () => {
    const onApplyFinishToAll = vi.fn();
    render(<CanvasThemeDialog {...props} tab="finish" onApplyFinishToAll={onApplyFinishToAll} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to All Elements' }));
    expect(onApplyFinishToAll).toHaveBeenCalledTimes(1);
  });
});
