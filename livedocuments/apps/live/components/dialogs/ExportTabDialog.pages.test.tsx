// @vitest-environment jsdom

// Pages mode's Export dialog (docs/specs/007-editor/pages-mode.md "Export"): there is no
// "Hidden layers" option, as the mode has no Layers.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, pagesOf, layOutPages, type Tab } from '@livedocuments/document';
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
    { id: 'p1', orientation: 'portrait', kind: 'infographic' },
    { id: 'p2', orientation: 'portrait', kind: 'infographic', name: 'Mark' },
  ],
} as unknown as Tab;
const pages = layOutPages(pagesOf(tab));

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

describe('ExportTabDialog, Pages', () => {
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

describe('the GIF card (docs/specs/020-import-export/animated-gif-export.md "Where it is offered")', () => {
  it('comes after SVG and before JSON in Pages, with its copy', () => {
    open();
    const buttons = screen.getAllByRole('button');
    const at = (name: RegExp) => buttons.indexOf(screen.getByRole('button', { name }));
    expect(at(/^SVG/)).toBeLessThan(at(/^GIF/));
    expect(at(/^GIF/)).toBeLessThan(at(/JSON/));
    expect(
      screen.getByText('An animated image of the pages, moving as they move on the canvas.'),
    ).toBeTruthy();
  });

  it('is not offered on a Pages tab with no pages yet', () => {
    render(<ExportTabDialog tab={tab} documentName="Doc" onClose={vi.fn()} pages={[]} />);
    expect(screen.queryByRole('button', { name: /^GIF/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^PDF/ })).toBeTruthy();
  });

  it('is never offered outside Pages', () => {
    open(false);
    expect(screen.queryByRole('button', { name: /^GIF/ })).toBeNull();
  });

  it('opens the GIF options', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^GIF/ }));
    // The panel loads on demand: under a loaded machine the import can take more than a second.
    expect(await screen.findByText('Each page holds', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download GIF' })).toBeTruthy();
  });
});
