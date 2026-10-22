// @vitest-environment jsdom

// A logo page's Guides popover (docs/specs/007-editor/logo-pages.md "Beside the cog").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MIRROR } from '@livediagram/document';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { LogoGuidesButton, LogoGuidesSettings } from './LogoGuidesPopover';

afterEach(() => cleanup());

const tools = (over: Partial<LogoToolsView> = {}): LogoToolsView => ({
  guidesOn: (id) => id === 'p',
  setGuides: vi.fn(),
  guideParts: new Set(['centre', 'diagonals', 'safe', 'circles', 'square', 'grid']),
  setGuidePart: vi.fn(),
  guideStrength: 'medium',
  setGuideStrength: vi.fn(),
  mirrorOn: () => false,
  setMirror: vi.fn(),
  mirrorPages: new Map(),
  mirrorSettings: () => DEFAULT_MIRROR,
  setMirrorSettings: vi.fn(),
  canMirrorCopy: () => false,
  mirrorCopy: vi.fn(),
  ...over,
});

describe('LogoGuidesSettings', () => {
  it("switches this page's guides at the top, then the parts", () => {
    const t = tools();
    render(<LogoGuidesSettings pageId="p" tools={t} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Show Guides' }));
    expect(t.setGuides).toHaveBeenCalledWith('p', false);
    fireEvent.click(screen.getByRole('button', { name: /Diagonals/ }));
    expect(t.setGuidePart).toHaveBeenCalledWith('diagonals', false);
    fireEvent.click(screen.getByRole('radio', { name: 'Strong' }));
    expect(t.setGuideStrength).toHaveBeenCalledWith('strong');
  });
});

describe('LogoGuidesButton', () => {
  it('shows pressed while the page shows its guides, and opens the popover', () => {
    render(
      <LogoGuidesButton pageId="p" tools={tools()} labelled className={() => ''}>
        <span />
      </LogoGuidesButton>,
    );
    const button = screen.getByRole('button', { name: 'Guides' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Show Guides' })).toBeTruthy();
  });
});
