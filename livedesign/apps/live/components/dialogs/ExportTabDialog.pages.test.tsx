// @vitest-environment jsdom

// Pages mode's Export dialog (docs/specs/007-editor/pages-mode.md "Export"): a logo
// page's PNG and SVG preview its see-through paper as the download has it, and there is no
// "Hidden layers" option, as the mode has no Layers.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, createText, pagesOf, layOutPages, type Tab } from '@livedesign/design';
import { ExportTabDialog } from './ExportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@liveworkspace/workbench/lib/icon-registry')>()),
  ensureIconCatalogs: vi.fn(async () => {}),
}));

afterEach(cleanup);

const box = { ...createShape('square', 0, 0), id: 'box', layerId: 'hidden' };
const tab = {
  id: 't',
  name: 'Brand',
  elements: [box],
  layers: [
    { id: 'default', name: 'Layer 1' },
    { id: 'hidden', name: 'Hidden', visible: false },
  ],
  pages: [
    { id: 'logo1', orientation: 'portrait', kind: 'logo', size: 'logo' },
    { id: 'logo2', orientation: 'portrait', kind: 'logo', size: 'logo', name: 'Mark' },
  ],
} as unknown as Tab;
const pages = layOutPages(pagesOf(tab));

const open = (withPages = true) =>
  render(
    <ExportTabDialog
      tab={tab}
      designName="Doc"
      onClose={vi.fn()}
      {...(withPages ? { pages } : {})}
    />,
  );

const preview = () => screen.findByTestId('export-preview');

describe('ExportTabDialog, Pages', () => {
  it("previews a logo page's PNG see-through, over a checkerboard", async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^PNG/ }));
    const el = await preview();
    expect(el.innerHTML).not.toContain('#ffffff');
    expect(el.style.background).toContain('repeating-conic-gradient');
  });

  it("previews a logo page's PDF on its paper, with no checkerboard", async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^PDF/ }));
    const el = await preview();
    await waitFor(() => expect(el.innerHTML).toContain('#ffffff'));
    expect(el.style.background).toBe('');
  });

  // Bare, the preview SVG was named by every word on the page (a screen reader read the whole page out).
  it('names its preview as one picture, of the page or the tab', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^PNG/ }));
    const page = await preview();
    expect(page.getAttribute('role')).toBe('img');
    expect(page.getAttribute('aria-label')).toBe('The page as it will download');
    cleanup();
    open(false);
    fireEvent.click(screen.getByRole('button', { name: /^PNG/ }));
    const whole = await preview();
    expect(whole.getAttribute('role')).toBe('img');
    expect(whole.getAttribute('aria-label')).toBe('The tab as it will download');
  });

  it('offers no Hidden layers option', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^SVG/ }));
    await preview();
    expect(screen.queryByText('Hidden layers')).toBeNull();
  });

  it('still offers Hidden layers outside Pages', async () => {
    open(false);
    fireEvent.click(screen.getByRole('button', { name: /^SVG/ }));
    await preview();
    expect(screen.getByText('Hidden layers')).toBeTruthy();
  });
});

describe('LogoKitPanel', () => {
  // docs/specs/007-editor/logo-pages.md "Export": the preview is the kit, without the template's notes.
  it("previews the logo without the template's notes", async () => {
    const { x, y } = pages[0]!.rect;
    const withNote = {
      ...tab,
      elements: [
        { ...createText(x + 100, y + 500), id: 'word', label: 'Sunny Side' },
        {
          ...createText(x + 60, y + 60),
          id: 'note',
          label: 'Pick the lockup that fits',
          templateNote: true,
        },
      ],
    } as unknown as Tab;
    render(<ExportTabDialog tab={withNote} designName="Doc" onClose={vi.fn()} pages={pages} />);
    fireEvent.click(screen.getByRole('button', { name: /Logo Kit/ }));
    const img = (await screen.findByAltText('The logo as it will export')) as HTMLImageElement;
    const svg = decodeURIComponent(img.src);
    expect(svg).toContain('Sunny Side');
    expect(svg).not.toContain('Pick the lockup');
  });

  it('names each logo page by its full label', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /Logo Kit/ }));
    const select = screen.getByLabelText('Logo page') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Page 1 · 1024 x 1024 · Logo',
      'Mark · 1024 x 1024 · Logo',
    ]);
  });
});
