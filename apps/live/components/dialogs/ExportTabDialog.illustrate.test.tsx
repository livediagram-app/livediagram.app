// @vitest-environment jsdom

// Illustrate mode's Export dialog (docs/specs/007-editor/illustrate-pages.md "Export"): a logo
// page's PNG and SVG preview its see-through paper as the download has it, and there is no
// "Hidden layers" option, as the mode has no Layers.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  illustratePagesOf,
  layOutIllustratePages,
  type Tab,
} from '@livediagram/document';
import { ExportTabDialog } from './ExportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@/lib/icon-registry')>()),
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
const pages = layOutIllustratePages(illustratePagesOf(tab));

const open = (withPages = true) =>
  render(
    <ExportTabDialog
      tab={tab}
      documentName="Doc"
      onClose={vi.fn()}
      {...(withPages ? { pages } : {})}
    />,
  );

const preview = () => screen.findByTestId('export-preview');

describe('ExportTabDialog, Illustrate', () => {
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

  it('offers no Hidden layers option', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^SVG/ }));
    await preview();
    expect(screen.queryByText('Hidden layers')).toBeNull();
  });

  it('still offers Hidden layers outside Illustrate', async () => {
    open(false);
    fireEvent.click(screen.getByRole('button', { name: /^SVG/ }));
    await preview();
    expect(screen.getByText('Hidden layers')).toBeTruthy();
  });
});

describe('LogoKitPanel', () => {
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
