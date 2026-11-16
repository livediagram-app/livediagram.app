// @vitest-environment jsdom

// The Export dialog's Markdown card on an article tab (docs/specs/020-import-export/markdown-import.md "Markdown
// export"): offered by the tab's kind, filled by the article's writing, naming what it leaves out.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, pagesOf, type Tab } from '@livedocuments/document';
import { ExportTabDialog } from './ExportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', async (orig) => ({
  ...(await orig<typeof import('@liveworkspace/workbench/lib/icon-registry')>()),
  ensureIconCatalogs: vi.fn(async () => {}),
}));

const { track } = await import('@/lib/telemetry');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const articleTab = (elements: unknown[]) =>
  ({
    id: 'a',
    name: 'Report',
    elements,
    pages: [{ id: 'a1', orientation: 'portrait', kind: 'article', flow: 'f' }],
    articles: {
      f: {
        blocks: [
          { id: 'b1', type: 'paragraph', style: 'h1', runs: [{ text: 'Summary' }] },
          { id: 'b2', type: 'paragraph', runs: [{ text: 'All good.' }] },
        ],
      },
    },
  }) as unknown as Tab;
const infographicTab = {
  id: 'i',
  name: 'Poster',
  elements: [],
  pages: [{ id: 'i1', orientation: 'portrait', kind: 'infographic' }],
} as unknown as Tab;

const open = (tab: Tab, selection = false) =>
  render(
    <ExportTabDialog
      tab={tab}
      documentName="Q4"
      onClose={vi.fn()}
      {...(selection ? { scope: 'selection' as const } : { pages: layOutPages(pagesOf(tab)) })}
    />,
  );
const card = () => screen.queryByRole('button', { name: /^Markdown/ });
const box = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Markdown Text' });

describe('ExportTabDialog, article Markdown', () => {
  it('offers Markdown on an article tab, after Word and before JSON', () => {
    open(articleTab([]));
    const buttons = screen.getAllByRole('button');
    const at = (name: RegExp) => buttons.indexOf(screen.getByRole('button', { name }));
    expect(at(/^Word/)).toBeLessThan(at(/^Markdown/));
    expect(at(/^Markdown/)).toBeLessThan(at(/JSON/));
  });

  it("keeps today's formats for other kinds: no card on an infographic, the outline on a selection", () => {
    open(infographicTab);
    expect(card()).toBeNull();
    cleanup();
    open(articleTab([]), true);
    fireEvent.click(card()!);
    expect(box().value).toContain('No labelled content');
  });

  it('fills the panel with the writing and names what it leaves out', () => {
    open(
      articleTab([
        { id: 'i1', type: 'image' },
        { id: 's1', type: 'shape' },
      ]),
    );
    fireEvent.click(card()!);
    expect(box().value).toBe('# Summary\n\nAll good.\n');
    expect(screen.getByRole('note').textContent).toContain(
      '1 picture and 1 other item are left out',
    );
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download .md' }));
    expect(track).toHaveBeenCalledWith('Document', 'Exported', 'Markdown');
  });

  it('shows no note when nothing is left out', () => {
    open(articleTab([]));
    fireEvent.click(card()!);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
