// @vitest-environment jsdom

// The Export dialog's Print (docs/specs/020-import-export/print.md): offered on every page kind and never on a
// selection, Current Page or Whole Document with what will print, then the print frame and its telemetry. The frame
// is stood in for (tested in lib/print-frame.test.ts) and so is the drawing (the PDF export's, tested with it).

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  layOutPages,
  newFlashcardPage,
  newSlidePage,
  pagesOf,
  type Tab,
} from '@livedocuments/document';
import { ExportTabDialog } from './ExportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@liveworkspace/workbench/lib/icon-registry')>()),
  ensureIconCatalogs: vi.fn(async () => {}),
}));
vi.mock('@/lib/print-frame', () => ({ printInFrame: vi.fn(async () => {}) }));
vi.mock('@/lib/export-tab', async (orig) => ({
  ...(await orig<typeof import('@/lib/export-tab')>()),
  renderTabToSvg: vi.fn(
    (tab: Tab, opts: { page?: { id: string } }) => `<svg data-sheet="${tab.id}:${opts.page?.id}"/>`,
  ),
}));
vi.mock('@/lib/current-page-kind', async (orig) => ({
  ...(await orig<typeof import('@/lib/current-page-kind')>()),
  currentPageIdNow: vi.fn(() => 's2'),
}));

const { track } = await import('@/lib/telemetry');
const { printInFrame } = await import('@/lib/print-frame');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const deckTab = {
  id: 'd',
  name: 'Pitch',
  elements: [],
  pages: [newSlidePage('s1'), newSlidePage('s2'), newSlidePage('s3')],
} as unknown as Tab;
const articleTab = {
  id: 'a',
  name: 'Report',
  elements: [],
  pages: [{ id: 'a1', orientation: 'portrait', kind: 'article', flow: 'f' }],
  articles: { f: { blocks: [] } },
} as unknown as Tab;
const infographicTab = {
  id: 'i',
  name: 'Poster',
  elements: [],
  pages: [{ id: 'i1', orientation: 'portrait', kind: 'infographic' }],
} as unknown as Tab;
const cardsTab = {
  id: 'c',
  name: 'Cards',
  elements: [],
  pages: [newFlashcardPage('c1', 'f1'), newFlashcardPage('c2', 'f2')],
  articles: { f1: { blocks: [] }, f2: { blocks: [] } },
} as unknown as Tab;
// A tab still on the Start screen: nothing to print.
const emptyTab = { id: 'e', name: 'Empty', elements: [] } as unknown as Tab;

const onClose = vi.fn();
const open = (tab: Tab, extra: { selection?: boolean; documentTabs?: Tab[] } = {}) =>
  render(
    <ExportTabDialog
      tab={tab}
      documentName="Q4"
      onClose={onClose}
      {...(extra.selection
        ? { scope: 'selection' as const }
        : { pages: layOutPages(pagesOf(tab)) })}
      {...(extra.documentTabs ? { documentTabs: extra.documentTabs } : {})}
    />,
  );

const card = (name: RegExp) => screen.queryByRole('button', { name });

describe('ExportTabDialog, Print', () => {
  it('offers Print on every page kind, after PDF, and not on a selection', () => {
    for (const tab of [deckTab, articleTab, infographicTab, cardsTab]) {
      open(tab);
      expect(card(/^Print/)).toBeTruthy();
      const titles = screen.getAllByRole('button').map((b) => b.textContent ?? '');
      expect(titles.findIndex((t) => t.startsWith('Print'))).toBe(
        titles.findIndex((t) => t.startsWith('PDF')) + 1,
      );
      cleanup();
    }
    open(deckTab, { selection: true });
    expect(card(/^Print/)).toBeNull();
  });

  it('prints the page in view, as one sheet', async () => {
    open(deckTab, { documentTabs: [deckTab, articleTab] });
    fireEvent.click(card(/^Print/)!);
    expect(screen.getByRole('radio', { name: 'Current Page' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Page to print').value).toBe('1');
    expect(screen.getByText(/^1 page\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(printInFrame).toHaveBeenCalledTimes(1));
    const html = vi.mocked(printInFrame).mock.calls[0]![0];
    expect(html.match(/class="sheet"/g)).toHaveLength(1);
    expect(html).toContain('data-sheet="d:s2"');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'PrintPage');
    expect(onClose).toHaveBeenCalled();
  });

  it('prints another page picked from the list', async () => {
    open(deckTab);
    fireEvent.click(card(/^Print/)!);
    fireEvent.change(screen.getByLabelText('Page to print'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(printInFrame).toHaveBeenCalledTimes(1));
    expect(vi.mocked(printInFrame).mock.calls[0]![0]).toContain('data-sheet="d:s3"');
  });

  it('prints the whole document: every tab in order, the Start screen skipped', async () => {
    open(deckTab, { documentTabs: [articleTab, emptyTab, deckTab, cardsTab] });
    fireEvent.click(card(/^Print/)!);
    fireEvent.click(screen.getByRole('radio', { name: 'Whole Document' }));
    expect(screen.queryByLabelText('Page to print')).toBeNull();
    expect(screen.getByText(/^6 pages from 3 tabs\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(printInFrame).toHaveBeenCalledTimes(1));
    const html = vi.mocked(printInFrame).mock.calls[0]![0];
    const order = [...html.matchAll(/data-sheet="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['a:a1', 'd:s1', 'd:s2', 'd:s3', 'c:c1', 'c:c2']);
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'PrintDocument');
  });

  it('names a failure and stays open; Back returns to the formats', async () => {
    vi.mocked(printInFrame).mockRejectedValueOnce(new Error('Printing is not available here.'));
    open(infographicTab);
    fireEvent.click(card(/^Print/)!);
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(await screen.findByText('Printing is not available here.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    vi.mocked(printInFrame).mockRejectedValueOnce('no');
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(await screen.findByText('Printing failed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /All formats/ }));
    expect(card(/^Print/)).toBeTruthy();
  });
});
