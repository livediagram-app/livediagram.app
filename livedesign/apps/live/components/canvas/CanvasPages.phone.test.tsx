// @vitest-environment jsdom

// A page's title bar on a phone (docs/specs/007-editor/pages-mode.md "Beside the cog", "On a phone"): a wireframe
// page's Device, Layout and Background gather under Appearance, whose rows open each control's own sheet; no lock and
// no page label. A desktop keeps the full bar; a Participant or Viewer sees no controls.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedesign/design';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { setQuickStylePhoneRows } from '@/lib/quick-style-bar-slots';
import { track } from '@/lib/telemetry';
import { CanvasPages } from './CanvasPages';
import { appearanceRows } from './PageAppearanceButton';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const phone = vi.hoisted(() => ({ on: true }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => phone.on,
}));

beforeEach(() => {
  phone.on = true;
});
afterEach(cleanup);

const stored: Page[] = [
  { id: 'w', orientation: 'portrait', kind: 'wireframe', size: 'device', device: 'iphone' },
];
const pages = layOutPages(stored);

const edit = new Proxy(
  { contentCount: () => 1, applyToAllReach: () => 0 },
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

const names = () =>
  within(screen.getByRole('toolbar', { name: 'Page' }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));
const label = (container: HTMLElement) =>
  container.querySelector('button.group\\/label')?.closest('div.absolute');

describe("a wireframe page's title bar on a phone", () => {
  it('holds Appearance and the cog alone, with no page label', () => {
    const { container } = render(<CanvasPages view={view(true)} zoom={1} />);
    expect(names()).toEqual(['Appearance', 'Page settings']);
    expect(label(container)?.className).toContain('hidden');
  });

  it("opens Device, Layout or Background from Appearance's rows", () => {
    render(<CanvasPages view={view(true)} zoom={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PageAppearance');
    const sheet = screen.getByRole('dialog', { name: 'Appearance' });
    expect(
      [...sheet.querySelectorAll('[data-appearance-row]')].map((r) =>
        r.getAttribute('data-appearance-row'),
      ),
    ).toEqual(['device', 'layout', 'background']);
    fireEvent.click(sheet.querySelector('[data-appearance-row="background"]')!);
    expect(screen.queryByRole('dialog', { name: 'Appearance' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Background' })).toBeTruthy();
  });

  it('shows a Participant or Viewer no controls', () => {
    render(<CanvasPages view={view(false)} zoom={1} />);
    expect(screen.queryByRole('button', { name: 'Appearance' })).toBeNull();
  });
});

// docs/specs/008-canvas/quick-style-panel.md "On a phone, in Appearance".
describe("a phone's Appearance for a selection", () => {
  const logoPages = layOutPages([{ id: 'l', orientation: 'portrait', kind: 'logo' }]);
  const logoView: PagesModeView = { ...view(true), pages: logoPages };
  afterEach(() => setQuickStylePhoneRows('l', null));

  it('shows on any page while something on it is styled, its rows under Selected Element', () => {
    render(<CanvasPages view={logoView} zoom={1} />);
    expect(screen.queryByRole('button', { name: 'Appearance' })).toBeNull();
    const open = vi.fn();
    act(() =>
      setQuickStylePhoneRows('l', {
        pageId: 'l',
        rows: [{ id: 'stroke', name: 'Stroke', line: 'The outline colour', icon: null }],
        open,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    const sheet = screen.getByRole('dialog', { name: 'Appearance' });
    expect(within(sheet).getByText('Selected Element')).toBeTruthy();
    fireEvent.click(sheet.querySelector('[data-appearance-row="stroke"]')!);
    expect(screen.queryByRole('dialog', { name: 'Appearance' })).toBeNull();
    expect(open).toHaveBeenCalledWith('stroke');
  });
});

describe("a wireframe page's title bar on a desktop", () => {
  it('keeps Device, Layout, Background and the lock, with no Appearance', () => {
    phone.on = false;
    const { container } = render(<CanvasPages view={view(true)} zoom={1} />);
    expect(label(container)?.className ?? 'missing').not.toMatch(/\bhidden\b|missing/);
    const shown = names();
    expect(shown).not.toContain('Appearance');
    for (const name of ['Layout', 'Background', 'Lock page', 'Page settings'])
      expect(shown).toContain(name);
  });
});

describe('appearanceRows', () => {
  it("lists a wireframe page's looks, and none elsewhere", () => {
    expect(appearanceRows({ page: true, device: true })).toEqual([
      'device',
      'layout',
      'background',
    ]);
    expect(appearanceRows({ page: false })).toEqual([]);
  });
});
