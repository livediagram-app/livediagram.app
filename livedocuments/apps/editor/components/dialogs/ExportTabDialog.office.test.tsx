// @vitest-environment jsdom

// The Export dialog's PowerPoint and Word cards (docs/specs/020-import-export/office-export.md "Where it is offered" and
// "The panel"): offered by the tab's kind, the panel's summary and list, and the making with its progress, Cancel and
// errors. The writers are stood in for (tested in lib/office-export).

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  layOutPages,
  newSlidePage,
  pageSlideIdFor,
  pagesOf,
  type Deck,
  type Tab,
} from '@livedocuments/document';
import { ExportTabDialog } from './ExportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@liveworkspace/workbench/lib/icon-registry')>()),
  ensureIconCatalogs: vi.fn(async () => {}),
}));
vi.mock('@liveworkspace/workbench/lib/download-blob', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/office-export', async (orig) => ({
  ...(await orig<typeof import('@/lib/office-export')>()),
  exportOfficeFile: vi.fn(),
}));

const { track } = await import('@/lib/telemetry');
const { downloadBlob } = await import('@liveworkspace/workbench/lib/download-blob');
const { exportOfficeFile } = await import('@/lib/office-export');

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
const deck = {
  slides: [{ id: pageSlideIdFor('d', 's2'), tabId: 'd', pageId: 's2', notes: 'Say hello' }],
} as unknown as Deck;
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

const onClose = vi.fn();
const open = (tab: Tab, extra: { scope?: 'selection'; deck?: Deck } = {}) =>
  render(
    <ExportTabDialog
      tab={tab}
      documentName="Q4"
      onClose={onClose}
      {...(extra.scope ? { scope: extra.scope } : { pages: layOutPages(pagesOf(tab)) })}
      {...(extra.deck ? { deck: extra.deck } : {})}
    />,
  );

const card = (name: RegExp) => screen.queryByRole('button', { name });

describe('ExportTabDialog, PowerPoint and Word', () => {
  it('offers PowerPoint for a deck, Word for an article, and neither for anything else', () => {
    open(deckTab);
    expect(card(/^PowerPoint/)).toBeTruthy();
    expect(card(/^Word/)).toBeNull();
    cleanup();
    open(articleTab);
    expect(card(/^Word/)).toBeTruthy();
    expect(card(/^PowerPoint/)).toBeNull();
    cleanup();
    open(infographicTab);
    expect(card(/^Word|^PowerPoint/)).toBeNull();
    cleanup();
    open(deckTab, { scope: 'selection' });
    expect(card(/^PowerPoint/)).toBeNull();
  });

  it('says what the deck holds and what stays editable, then makes and downloads it', async () => {
    let finish: (v: Awaited<ReturnType<typeof exportOfficeFile>>) => void = () => {};
    vi.mocked(exportOfficeFile).mockImplementation(async (_input, progress) => {
      progress?.onProgress?.(0.4);
      return new Promise((resolve) => (finish = resolve));
    });
    open(deckTab, { deck });
    fireEvent.click(card(/^PowerPoint/)!);
    expect(
      await screen.findByText('3 slides, one a page, with the speaker notes of 1.'),
    ).toBeTruthy();
    expect(screen.getByText('Download the tab as a PowerPoint deck.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'What stays editable' }).children).toHaveLength(3);
    await screen.findByTestId('export-preview');

    fireEvent.click(screen.getByRole('button', { name: 'Download PowerPoint' }));
    expect(await screen.findByRole('button', { name: 'Making the deck… 40%' })).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    const input = vi.mocked(exportOfficeFile).mock.calls[0]![0];
    expect(input).toMatchObject({ format: 'pptx', title: 'Q4', deck });
    expect(input.pages).toHaveLength(3);

    const blob = new Blob(['x']);
    await act(async () => finish({ ok: true, blob }));
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'Q4 - Pitch.pptx');
    expect(track).toHaveBeenCalledWith('Document', 'Exported', 'PagesPPTX');
    expect(onClose).toHaveBeenCalled();
  });

  it('names a failure, and stops on Cancel', async () => {
    vi.mocked(exportOfficeFile).mockResolvedValueOnce({ ok: false, failure: 'draw' });
    open(articleTab);
    fireEvent.click(card(/^Word/)!);
    expect(
      screen.getByText("The article's writing, its pictures and drawings as images."),
    ).toBeTruthy();
    await screen.findByTestId('export-preview');
    fireEvent.click(screen.getByRole('button', { name: 'Download Word' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn't draw a picture/);
    expect(downloadBlob).not.toHaveBeenCalled();

    let signal: AbortSignal | undefined;
    vi.mocked(exportOfficeFile).mockImplementationOnce(async (_input, progress) => {
      signal = progress?.signal;
      return new Promise(() => {});
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download Word' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Download Word' })).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
