// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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
