// @vitest-environment jsdom

// A logo page's Mirror popover (docs/specs/007-editor/logo-pages.md "Mirror").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MIRROR, type MirrorSettings } from '@livediagram/document';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { LogoMirrorSettings } from './LogoMirrorPopover';

afterEach(() => cleanup());

const tools = (settings: Partial<MirrorSettings> = {}, on = true) =>
  ({
    mirrorOn: () => on,
    setMirror: vi.fn(),
    mirrorSettings: () => ({ ...DEFAULT_MIRROR, ...settings }),
    setMirrorSettings: vi.fn(),
  }) as unknown as LogoToolsView;

describe('LogoMirrorSettings', () => {
  it('switches mirror for the page and picks its axis', () => {
    const t = tools({}, false);
    render(<LogoMirrorSettings pageId="p" tools={t} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Mirror While Drawing' }));
    expect(t.setMirror).toHaveBeenCalledWith('p', true);
    expect(screen.getByRole('radio', { name: 'Vertical' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    expect(t.setMirrorSettings).toHaveBeenCalledWith('p', { axis: 'both' });
  });

  it('offers copies only for Radial', () => {
    render(<LogoMirrorSettings pageId="p" tools={tools()} />);
    expect(screen.queryByRole('radiogroup', { name: 'Radial copies' })).toBeNull();
    cleanup();
    const t = tools({ axis: 'radial' });
    render(<LogoMirrorSettings pageId="p" tools={t} />);
    fireEvent.click(screen.getByRole('radio', { name: '8' }));
    expect(t.setMirrorSettings).toHaveBeenCalledWith('p', { copies: 8 });
  });

  it('switches Merge Into One, saying what it does', () => {
    const t = tools({ merge: false });
    render(<LogoMirrorSettings pageId="p" tools={t} />);
    expect(screen.getByText('Each copy is its own element.')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Merge Into One' }));
    expect(t.setMirrorSettings).toHaveBeenCalledWith('p', { merge: true });
  });
});
