// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasThemeDialog } from './CanvasThemeDialog';

// docs/specs/011-theme/canvas-and-theme-dialog.md: a popover flying out of the paintbrush, else the centred dialog.
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const props: ComponentProps<typeof CanvasThemeDialog> = {
  tab: 'canvas',
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
  onApplyLook: vi.fn(),
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
  it('is a Fine-tune row on the home that opens its panel', () => {
    const onTabChange = vi.fn();
    render(<CanvasThemeDialog {...props} tab="looks" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish: Flexible' }));
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

  it('previews the chosen finish on a sample diagram', () => {
    const { rerender } = render(<CanvasThemeDialog {...props} tab="finish" />);
    const preview = screen.getByRole('img', { name: /Flexible finish/ });
    expect(preview.getAttribute('data-finish-preview')).toBe('flexible');
    expect(preview.querySelector('svg')).not.toBeNull();
    rerender(<CanvasThemeDialog {...props} tab="finish" finish="sketch" />);
    expect(screen.getByRole('img', { name: /Sketch finish/ }).innerHTML).toContain(
      'data-finish="sketch"',
    );
  });

  it('Apply to All Elements clears the elements’ own finishes', () => {
    const onApplyFinishToAll = vi.fn();
    render(<CanvasThemeDialog {...props} tab="finish" onApplyFinishToAll={onApplyFinishToAll} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to All Elements' }));
    expect(onApplyFinishToAll).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/011-theme/canvas-and-theme-dialog.md "Looks", "Fine-tune": the home, its looks and its panels.
describe('CanvasThemeDialog home', () => {
  const home = (over: Partial<ComponentProps<typeof CanvasThemeDialog>> = {}) =>
    render(<CanvasThemeDialog {...props} tab="looks" {...over} />);
  const lookNames = ['Everyday', 'Whiteboard', 'Graph Paper', 'Boardroom', 'Notebook', 'Midnight'];

  it('offers the six looks, each drawn as a preview', () => {
    home();
    for (const name of lookNames) {
      const card = screen.getByRole('button', { name: new RegExp(`^${name}`) });
      expect(card.querySelector('svg'), name).not.toBeNull();
    }
  });

  it('applies a look on click', () => {
    const onApplyLook = vi.fn();
    home({ onApplyLook });
    fireEvent.click(screen.getByRole('button', { name: /^Whiteboard/ }));
    expect(onApplyLook).toHaveBeenCalledWith('whiteboard');
  });

  it('marks the look the tab matches, and none for its own mix', () => {
    const { unmount } = home({ themeId: 'brand', finish: undefined, font: null });
    expect(screen.getByRole('button', { name: /^Everyday/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    unmount();
    home({ themeId: 'brand', finish: 'sketch', font: null });
    for (const name of lookNames)
      expect(
        screen.getByRole('button', { name: new RegExp(`^${name}`) }).getAttribute('aria-pressed'),
      ).toBe('false');
  });

  it('shows each setting’s current value on its Fine-tune row and opens its panel', () => {
    const onTabChange = vi.fn();
    home({
      onTabChange,
      finish: 'professional',
      font: 'inter',
      defaultTextSize: 'lg',
      backgroundPattern: 'lines',
    });
    expect(screen.getByRole('button', { name: /^Colours: / })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish: Professional' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Text: Inter, large/ }));
    expect(onTabChange).toHaveBeenLastCalledWith('font');
    fireEvent.click(screen.getByRole('button', { name: /^Canvas: / }));
    expect(onTabChange).toHaveBeenLastCalledWith('canvas');
    fireEvent.click(screen.getByRole('button', { name: /^Colours: / }));
    expect(onTabChange).toHaveBeenLastCalledWith('theme');
  });

  it('has no Back on the home; a panel goes Back to it', () => {
    const { unmount } = home();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    unmount();
    const onTabChange = vi.fn();
    render(<CanvasThemeDialog {...props} tab="font" onTabChange={onTabChange} />);
    expect(screen.getByRole('heading', { name: 'Text' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onTabChange).toHaveBeenCalledWith('looks');
  });
});
