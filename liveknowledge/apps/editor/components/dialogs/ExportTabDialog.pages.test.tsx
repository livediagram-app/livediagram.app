// @vitest-environment jsdom

// Pages mode's Export dialog (docs/specs/007-editor/pages-mode.md "Export"): there is no
// "Hidden layers" option, as the mode has no Layers (docs/specs/006-document/layers.md "Retired: the Layers panel").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, pagesOf, layOutPages, type Tab } from '@liveknowledge/document';
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
  // Bare, the preview SVG was named by every word on the page (a screen reader read the whole page out).
  it('names its preview as one picture', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^PDF/ }));
    const shown = await preview();
    expect(shown.getAttribute('role')).toBe('img');
    expect(shown.getAttribute('aria-label')).toBe('The page as it will download');
  });

  it('offers no Hidden layers option', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^SVG/ }));
    await preview();
    expect(screen.queryByText('Hidden layers')).toBeNull();
  });

  it('offers no Hidden layers option outside Pages either, with a layer hidden', async () => {
    open(false);
    fireEvent.click(screen.getByRole('button', { name: /^SVG/ }));
    await preview();
    expect(screen.queryByText('Hidden layers')).toBeNull();
  });
});
