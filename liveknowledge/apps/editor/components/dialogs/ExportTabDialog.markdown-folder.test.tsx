// @vitest-environment jsdom

// The Export dialog's Markdown Folder card (docs/specs/020-import-export/knowledgebase-export.md "Where it is offered",
// "The panel"): offered only where the session reads the whole knowledgebase, then the making, its progress, Cancel,
// the download and what it could not read.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, pagesOf, type Tab } from '@liveknowledge/document';
import { ZipTooLargeError } from '@liveworkspace/workbench/lib/zip-writer';
import { ExportTabDialog, type MarkdownFolderExport } from './ExportTabDialog';
import {
  ExportCancelled,
  type MarkdownFolderResult,
} from '@/lib/knowledgebase-export/markdown-folder';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/export-tab', async (orig) => ({
  ...(await orig<typeof import('@/lib/export-tab')>()),
  downloadBlob: vi.fn(),
}));
vi.mock('@liveworkspace/workbench/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@liveworkspace/workbench/lib/icon-registry')>()),
  ensureIconCatalogs: vi.fn(async () => {}),
}));

const { track } = await import('@/lib/telemetry');
const { downloadBlob } = await import('@/lib/export-tab');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const tab = {
  id: 'a',
  name: 'Start Here',
  elements: [],
  pages: [{ id: 'a1', orientation: 'portrait', kind: 'article', flow: 'f' }],
  articles: { f: { blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: 'Hi.' }] }] } },
} as unknown as Tab;

const done = (over: Partial<MarkdownFolderResult> = {}): MarkdownFolderResult => ({
  blob: new Blob(['zip']),
  pages: 3,
  pictures: 1,
  missingPictures: 0,
  missingPages: 0,
  ...over,
});

const open = (markdownFolder?: MarkdownFolderExport, selection = false) => {
  const onClose = vi.fn();
  render(
    <ExportTabDialog
      tab={tab}
      documentName="Team: Handbook"
      onClose={onClose}
      {...(selection ? { scope: 'selection' as const } : { pages: layOutPages(pagesOf(tab)) })}
      {...(markdownFolder ? { markdownFolder } : {})}
    />,
  );
  return onClose;
};
const card = () => screen.queryByRole('button', { name: /^Markdown Folder/ });

describe('ExportTabDialog, Markdown Folder', () => {
  it('offers the card after Markdown only when the whole knowledgebase is read, never on a selection', () => {
    const run = vi.fn();
    open({ counts: { pages: 3, connected: 0 }, run });
    const buttons = screen.getAllByRole('button');
    const at = (name: RegExp) => buttons.indexOf(screen.getByRole('button', { name }));
    expect(at(/^Markdown\b(?! Folder)/)).toBeLessThan(at(/^Markdown Folder/));
    expect(at(/^Markdown Folder/)).toBeLessThan(at(/JSON/));
    cleanup();
    open();
    expect(card()).toBeNull();
    cleanup();
    open({ counts: { pages: 3, connected: 0 }, run }, true);
    expect(card()).toBeNull();
  });

  it('says what the zip holds, makes it page by page, downloads it named after the knowledgebase and closes', async () => {
    let finish!: (r: MarkdownFolderResult) => void;
    let progress!: (done: number, total: number) => void;
    const run = vi.fn(
      ({ onProgress }: { onProgress: (d: number, t: number) => void }) =>
        new Promise<MarkdownFolderResult>((resolve) => {
          progress = onProgress;
          finish = resolve;
        }),
    );
    const onClose = open({ counts: { pages: 1250, connected: 2 }, run });
    fireEvent.click(card()!);
    expect(await screen.findByText('1,250 Pages, in Folders Following the Page Tree')).toBeTruthy();
    expect(screen.getByText('2 connected files stay out: they belong to other apps.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download .zip' }));
    expect(await screen.findByText('Reading the Page Tree…')).toBeTruthy();
    act(() => progress(140, 320));
    const bar = await screen.findByRole('progressbar', { name: 'Preparing 140 of 320 Pages' });
    expect(bar.getAttribute('aria-valuenow')).toBe('44');
    expect(screen.getByRole('button', { name: /All Formats/ }).hasAttribute('disabled')).toBe(true);
    await act(async () => finish(done()));
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Team- Handbook.zip');
    expect(track).toHaveBeenCalledWith('Document', 'Exported', 'MarkdownFolder');
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open after a download that lost pictures, and says so', async () => {
    const onClose = open({
      counts: { pages: 1, connected: 0 },
      run: async () => done({ missingPictures: 3 }),
    });
    fireEvent.click(card()!);
    fireEvent.click(await screen.findByRole('button', { name: 'Download .zip' }));
    expect((await screen.findByRole('status')).textContent).toBe(
      'Downloaded. 3 Pictures Could Not Be Read: their words are kept.',
    );
    expect(downloadBlob).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('names a failed read and a zip too large, with the button back', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new ZipTooLargeError());
    open({ counts: { pages: 1, connected: 0 }, run });
    fireEvent.click(card()!);
    fireEvent.click(await screen.findByRole('button', { name: 'Download .zip' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'A page could not be read. Check your connection and try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download .zip' }));
    expect((await screen.findByRole('alert')).textContent).toContain('larger than a zip file');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('cancels: the signal aborts, nothing downloads, and the button comes back', async () => {
    let signal!: AbortSignal;
    const run = vi.fn(
      (options: { signal: AbortSignal }) =>
        new Promise<MarkdownFolderResult>((_resolve, reject) => {
          signal = options.signal;
          options.signal.addEventListener('abort', () => reject(new ExportCancelled()));
        }),
    );
    open({ counts: { pages: 1, connected: 0 }, run });
    fireEvent.click(card()!);
    fireEvent.click(await screen.findByRole('button', { name: 'Download .zip' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(signal.aborted).toBe(true);
    expect(await screen.findByRole('button', { name: 'Download .zip' })).toBeTruthy();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('cancels a making still under way when the dialog closes', async () => {
    let signal!: AbortSignal;
    const run = vi.fn((options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise<MarkdownFolderResult>(() => {});
    });
    open({ counts: { pages: 1, connected: 0 }, run });
    fireEvent.click(card()!);
    fireEvent.click(await screen.findByRole('button', { name: 'Download .zip' }));
    await screen.findByRole('button', { name: 'Cancel' });
    cleanup();
    expect(signal.aborted).toBe(true);
  });
});
