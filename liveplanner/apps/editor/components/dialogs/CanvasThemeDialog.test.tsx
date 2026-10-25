// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasThemeDialog } from './CanvasThemeDialog';

// jsdom has no ResizeObserver; the dialog's animated height measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

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
  font: null,
  onSetFont: vi.fn(),
  defaultTextSize: undefined,
  onSetDefaultTextSize: vi.fn(),
  finish: undefined,
  onSetFinish: vi.fn(),
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
    const panel = screen.getByRole('dialog', { name: 'Tab style' });
    expect(panel.style.right).toBe('36px');
    expect(panel.style.bottom).toBe('68px');
  });

  it('is the centred dialog without a brush', () => {
    Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
    render(<CanvasThemeDialog {...props} />);
    expect(screen.getByRole('dialog', { name: 'Tab style' }).style.right).toBe('');
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
    expect(screen.getByRole('radio', { name: 'Flexible' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Sketch' }));
    expect(onSetFinish).toHaveBeenCalledWith('sketch');
  });

  it("presses the tab's finish", () => {
    render(<CanvasThemeDialog {...props} tab="finish" finish="professional" />);
    expect(screen.getByRole('radio', { name: 'Professional' }).getAttribute('aria-checked')).toBe(
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
});

// docs/specs/011-theme/canvas-and-theme-dialog.md "Looks", "Fine-tune": the home, its looks and its panels.
describe('CanvasThemeDialog home', () => {
  const home = (over: Partial<ComponentProps<typeof CanvasThemeDialog>> = {}) =>
    render(<CanvasThemeDialog {...props} tab="looks" {...over} />);
  const lookNames = [
    'Everyday',
    'Textbook',
    'Whiteboard',
    'Spectrum',
    'Boardroom',
    'Notebook',
    'Seaside',
    'Doodle',
    'Editorial',
    'Midnight',
    'Workshop',
    'Poster',
    'Graph Paper',
    'Daydream',
    'Engineer',
    'Lagoon',
    'Studio',
    'Garden',
  ];

  it('offers the eighteen looks, each drawn as a preview', () => {
    home();
    for (const name of lookNames) {
      const card = screen.getByRole('button', { name: new RegExp(`^${name}`) });
      expect(card.querySelector('svg'), name).not.toBeNull();
    }
  });

  it('pages the Mashup card and the looks in a carousel of five pages, opening on the current look’s page', () => {
    const { unmount } = home({ themeId: 'brand', finish: undefined, font: null });
    const next = screen.getByRole('button', { name: 'Next looks' });
    const prev = screen.getByRole('button', { name: 'Previous looks' });
    expect(prev.hasAttribute('disabled')).toBe(true);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(next.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Looks page 5 of 5' }).getAttribute('aria-current'),
    ).toBe('true');
    unmount();
    // A tab on a page-three look opens there (the Mashup card leads page one).
    home({
      themeId: 'lavender',
      finish: 'professional',
      font: 'roboto-slab',
      backgroundPattern: 'crosshatch',
    });
    expect(
      screen.getByRole('button', { name: 'Looks page 3 of 5' }).getAttribute('aria-current'),
    ).toBe('true');
  });

  it('shows only the looks, with no Current card for the tab’s own mix', () => {
    home({ themeId: 'rose', finish: 'sketch', font: 'lora', backgroundPattern: 'lines' });
    expect(screen.queryByRole('button', { name: /^Current/ })).toBeNull();
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

  it('has no breadcrumb on the home; a panel’s shared breadcrumb names it and goes back', () => {
    const { unmount } = home();
    expect(screen.queryByRole('button', { name: /^Tab Style/ })).toBeNull();
    unmount();
    const onTabChange = vi.fn();
    render(<CanvasThemeDialog {...props} tab="font" onTabChange={onTabChange} />);
    const crumb = screen.getByRole('button', { name: /^Tab Style/ });
    expect(crumb.textContent).toContain('Text');
    fireEvent.click(crumb);
    expect(onTabChange).toHaveBeenCalledWith('looks');
  });
});
