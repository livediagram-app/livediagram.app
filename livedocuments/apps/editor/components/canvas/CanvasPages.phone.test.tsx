// @vitest-environment jsdom

// A page's title bar on a phone (docs/specs/007-editor/pages-mode.md "Beside the cog", "On a phone, three buttons at
// most"): Appearance, Notes and the cog; no Tidy, no lock, no page label. Appearance's rows open each look control's
// own sheet. A desktop keeps the full bar; a Participant or Viewer sees no controls on either.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newSlidePage } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { track } from '@/lib/telemetry';
import { registerTabStyleOpen } from '@/lib/tab-style-opener';
import { CanvasPages } from './CanvasPages';
import { appearanceRows } from './PageAppearanceButton';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// Tidy needs the editor's own context; a stand-in shows where the bar would place it.
vi.mock('./PageTidyUpButton', async (real) => ({
  ...(await real<typeof import('./PageTidyUpButton')>()),
  PageTidyUpButton: () => <button type="button" aria-label="Tidy" />,
}));
const phone = vi.hoisted(() => ({ on: true }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => phone.on,
}));

let undo = () => {};
beforeEach(() => {
  phone.on = true;
  undo = registerTabStyleOpen(vi.fn());
});
afterEach(() => {
  act(() => undo());
  cleanup();
});

const pages = layOutPages([newSlidePage('s1')]);

const edit = new Proxy(
  { contentCount: () => 1, applyToAllReach: () => 0, canTidy: () => true },
  { get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()) },
);

function view(editable: boolean): PagesModeView {
  return {
    pages,
    elements: [],
    focusPage: vi.fn(),
    setLayoutPreview: vi.fn(),
    themeBackgrounds: [],
    ...(editable ? { edit } : {}),
  } as unknown as PagesModeView;
}

const bar = () => screen.getByRole('toolbar', { name: 'Page' });
const names = () =>
  within(bar())
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));
const label = (container: HTMLElement) =>
  container.querySelector('button.group\\/label')?.parentElement?.closest('div.absolute');

describe("a page's title bar on a phone", () => {
  it('holds Appearance and the cog alone: no Style, Layout, Background, Tidy or lock', () => {
    const { container } = render(<CanvasPages view={view(true)} zoom={1} />);
    expect(names()).toEqual(['Appearance', 'Page settings']);
    // No page label above the page's top-left corner either.
    expect(label(container)?.className).toContain('hidden');
  });

  it("lists the page's look controls and opens each one's own sheet", () => {
    render(<CanvasPages view={view(true)} zoom={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PageAppearance');
    const sheet = screen.getByRole('dialog', { name: 'Appearance' });
    const rows = [...sheet.querySelectorAll('[data-appearance-row]')].map((r) =>
      r.getAttribute('data-appearance-row'),
    );
    expect(rows).toEqual(['style', 'layout', 'background']);
    fireEvent.click(sheet.querySelector('[data-appearance-row="background"]')!);
    expect(screen.queryByRole('dialog', { name: 'Appearance' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Background' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PageBackgroundButton');
  });

  it("opens Tab Style from Appearance's Style row", () => {
    act(() => undo());
    const open = vi.fn();
    undo = registerTabStyleOpen(open);
    render(<CanvasPages view={view(true)} zoom={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    fireEvent.click(document.querySelector('[data-appearance-row="style"]')!);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('names Appearance while the page on screen has room, and drops to its icon when it is too narrow', () => {
    const { unmount } = render(<CanvasPages view={view(true)} zoom={1} />);
    // The slide is far wider on screen than the named bar.
    expect(screen.getByRole('button', { name: 'Appearance' }).textContent).toContain('Appearance');
    unmount();
    // Zoomed far out, the slide is a sliver: the icon alone.
    render(<CanvasPages view={view(true)} zoom={0.04} />);
    expect(screen.getByRole('button', { name: 'Appearance' }).textContent).not.toContain(
      'Appearance',
    );
  });

  it('shows a Participant or Viewer no controls', () => {
    render(<CanvasPages view={view(false)} zoom={1} />);
    expect(screen.queryByRole('toolbar', { name: 'Page' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Appearance' })).toBeNull();
  });
});

describe("a page's title bar on a desktop", () => {
  it('keeps every control and the label, and has no Appearance', () => {
    phone.on = false;
    const { container } = render(<CanvasPages view={view(true)} zoom={1} />);
    const shown = names();
    expect(shown).not.toContain('Appearance');
    for (const name of ['Style', 'Layout', 'Background', 'Lock page', 'Page settings'])
      expect(shown).toContain(name);
    expect(shown).toContain('Tidy');
    expect(label(container)?.className ?? '').not.toContain('hidden');
  });
});

describe('appearanceRows', () => {
  it("lists a page's look controls in the bar's order", () => {
    expect(appearanceRows({ style: true, page: true })).toEqual(['style', 'layout', 'background']);
    expect(appearanceRows({ page: false, article: true })).toEqual(['style', 'text', 'background']);
    // A locked page keeps the tab's Style alone; a page with no look controls has none, so no Appearance.
    expect(appearanceRows({ style: true, page: false })).toEqual(['style']);
    expect(appearanceRows({ page: false })).toEqual([]);
  });
});
