// @vitest-environment jsdom

// A logo page's controls beside its cog (docs/specs/007-editor/logo-pages.md "Beside the cog").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { SelectionStoreProvider } from '@/hooks/canvas/useSelectionStore';
import { DEFAULT_MIRROR } from '@livediagram/document';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { createSelectionStore } from '@/lib/selection-store';
import { LogoTitleBar, logoTitleBarRoom } from './LogoTitleBar';

afterEach(() => cleanup());

const tools = (over: Partial<LogoToolsView> = {}) =>
  ({
    guidesOn: () => true,
    guideParts: new Set(),
    setGuidePart: vi.fn(),
    guideStrength: 'medium',
    setGuideStrength: vi.fn(),
    setGuides: vi.fn(),
    mirrorOn: () => false,
    setMirror: vi.fn(),
    mirrorSettings: () => DEFAULT_MIRROR,
    setMirrorSettings: vi.fn(),
    ...over,
  }) as unknown as LogoToolsView;

function show(t: LogoToolsView, canTidyUp = false) {
  const ctx = { canTidyUp: () => canTidyUp, tidyUpSelected: vi.fn() };
  const wrap = ({ children }: { children: ReactNode }) => (
    <EditorContext.Provider value={ctx as never}>
      <SelectionStoreProvider store={createSelectionStore()}>{children}</SelectionStoreProvider>
    </EditorContext.Provider>
  );
  render(<LogoTitleBar pageId="p" tools={t} />, { wrapper: wrap });
  return ctx;
}

describe('LogoTitleBar', () => {
  it('opens Mirror and Guides, each pressed while on and named on a desktop', () => {
    const t = tools({ mirrorOn: (id) => id === 'p' });
    show(t);
    expect(screen.getByText('Mirror')).toBeTruthy();
    expect(screen.getByText('Guides')).toBeTruthy();
    const mirror = screen.getByRole('button', { name: 'Mirror' });
    expect(mirror.getAttribute('aria-pressed')).toBe('true');
    // Mirror opens its popover; its switch turns this page's mirror off.
    fireEvent.click(mirror);
    fireEvent.click(screen.getByRole('switch', { name: 'Mirror While Drawing' }));
    expect(t.setMirror).toHaveBeenCalledWith('p', false);
    // Guides opens its popover; its switch turns this page's guides off.
    fireEvent.click(screen.getByRole('button', { name: 'Guides' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Show Guides' }));
    expect(t.setGuides).toHaveBeenCalledWith('p', false);
  });

  it('offers Tidy Up only while the selection holds a hand-drawn line', () => {
    show(tools());
    expect(screen.queryByRole('button', { name: /Tidy Up/ })).toBeNull();
    cleanup();
    const ctx = show(tools(), true);
    fireEvent.click(screen.getByRole('button', { name: /Tidy Up/ }));
    expect(ctx.tidyUpSelected).toHaveBeenCalled();
  });

  it('renders Mirror and Guides alone outside an editor, and reserves room for what shows', () => {
    render(<LogoTitleBar pageId="p" tools={tools()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(logoTitleBarRoom(true, false)).toBeGreaterThan(logoTitleBarRoom(false, false));
    expect(logoTitleBarRoom(false, true)).toBeGreaterThan(logoTitleBarRoom(false, false));
  });
});
