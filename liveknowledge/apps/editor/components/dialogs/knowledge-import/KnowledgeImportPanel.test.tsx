// @vitest-environment jsdom

// A Knowledgebase import inside the Import dialog (docs/specs/020-import-export/knowledgebase-import.md): the pick
// step, the review of what was found and where it lands, a plan that cannot fit, the progress and the summary.

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import type { ImportSource } from '@liveknowledge/knowledge-import';
import type {
  KnowledgeImportHost,
  RunImportArgs,
  RunImportResult,
} from '@/lib/knowledge-import/run-import';
import { forgetKnowledgeTiersForTests, setKnowledgeTier } from '@/lib/knowledge-tier';
import { KnowledgeImportPanel } from './KnowledgeImportPanel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const tab = (id: string, name: string, parent?: string): Tab => ({
  id,
  name,
  elements: [],
  ...(parent ? { parent } : {}),
});

const result = (over: Partial<RunImportResult> = {}): RunImportResult => ({
  documentId: 'doc',
  total: 3,
  imported: 3,
  first: { id: 'new-1', title: 'Home' },
  failedPages: [],
  failedPictures: [],
  cancelled: false,
  stalled: false,
  ...over,
});

function mount(
  opts: {
    source?: ImportSource;
    tabs?: Tab[];
    run?: (args: RunImportArgs) => Promise<RunImportResult>;
  } = {},
) {
  const tabs = opts.tabs ?? [tab('home', 'Start Here'), tab('guides', 'Guides', 'home')];
  const host: KnowledgeImportHost = {
    ownerId: 'me',
    documentId: 'doc',
    offline: false,
    teamId: null,
    getTabs: () => tabs,
    getActiveTab: () => tabs[0],
    commitTabs: vi.fn(),
    markTabLoaded: vi.fn(),
  };
  const run = vi.fn(opts.run ?? (async () => result()));
  const onOpenPage = vi.fn();
  const onClose = vi.fn();
  const onBack = vi.fn();
  render(
    <KnowledgeImportPanel
      source={opts.source ?? 'markdown-folder'}
      host={host}
      pages={tabs.map((t) => ({ id: t.id, name: t.name, parent: t.parent }))}
      activePageId="guides"
      onOpenPage={onOpenPage}
      loadRunner={async () => run}
      onBack={onBack}
      onClose={onClose}
    />,
  );
  return { run, onOpenPage, onClose, onBack };
}

// A folder chosen in the folder picker: each file under its path in the folder.
function chooseFolder(files: Record<string, string>) {
  const list = Object.entries(files).map(([path, content]) => {
    const file = new File([content], path.split('/').pop()!);
    Object.defineProperty(file, 'webkitRelativePath', { value: path });
    return file;
  });
  fireEvent.change(screen.getByTestId('knowledge-import-folder'), { target: { files: list } });
}

const THREE = {
  'kb/README.md': '# Home\n\nSee [setup](guides/setup.md).',
  'kb/guides/README.md': '# Guides',
  'kb/guides/setup.md': '# Setup\n\n![Missing](nope.png)',
};

describe('KnowledgeImportPanel, picking', () => {
  it('says what a Markdown Folder takes and offers a .zip or a folder', () => {
    const { onBack } = mount();
    expect(screen.getByText('Drop a Folder or a .zip Here')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a .zip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a Folder' })).toBeTruthy();
    expect(screen.getByText(/README.md or index.md becomes its folder/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /All Formats/ }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('names Notion and Confluence in plain words, each taking a .zip only', () => {
    mount({ source: 'notion' });
    expect(screen.getByText('Drop a Notion Export Here')).toBeTruthy();
    expect(screen.getByText(/Markdown & CSV/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose a Folder' })).toBeNull();
    // No other product's logo: the glyphs are drawn, never an image.
    expect(document.querySelector('img')).toBeNull();
  });

  it('says so when what was chosen is no archive, and stays on the pick step', async () => {
    mount({ source: 'confluence' });
    fireEvent.change(screen.getByTestId('knowledge-import-zip'), {
      target: { files: [new File(['hello'], 'notes.txt')] },
    });
    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be read as an archive',
    );
    expect(screen.getByText('Drop a Confluence Export Here')).toBeTruthy();
  });
});

describe('KnowledgeImportPanel, review', () => {
  it('shows what was found as a tree, what is left out, where it lands and Import <n> Pages', async () => {
    mount();
    chooseFolder(THREE);
    expect((await screen.findByTestId('knowledge-import-found')).textContent).toBe('3 Pages Found');
    const tree = screen.getByRole('list', { name: 'Pages Found' });
    const rows = within(tree).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual(['Home', 'Guides', 'Setup']);
    // The folder's own README is the top page listed first, not the page the rest sit under; Setup sits under
    // Guides, a level further in.
    expect(rows.map((r) => r.style.paddingLeft)).toEqual(['12px', '12px', '28px']);
    const issues = screen.getByRole('region', { name: 'Left Out or Changed' });
    expect(issues.textContent).toContain('1 Picture Not Found');
    expect(issues.textContent).toContain('Setup: ');
    expect(screen.getByRole('radio', { name: /A New Knowledgebase/ })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByText(/Named kb\./)).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain(
      'An import cannot be undone as one step.',
    );
    expect(screen.getByRole('note').textContent).toContain('so they can be deleted together');
    expect(screen.getByRole('button', { name: 'Import 3 Pages' })).toBeTruthy();
  });

  it('caps the tree at twelve pages and counts the rest', async () => {
    mount();
    const files: Record<string, string> = {};
    for (let i = 0; i < 40; i++) files[`kb/page-${i}.md`] = `Page ${i}`;
    chooseFolder(files);
    await screen.findByTestId('knowledge-import-found');
    const rows = within(screen.getByRole('list', { name: 'Pages Found' })).getAllByRole('listitem');
    expect(rows).toHaveLength(13);
    expect(rows[12]!.textContent).toBe('and 28 more');
    expect(screen.getByRole('button', { name: 'Import 40 Pages' })).toBeTruthy();
  });

  it('lands under a chosen page of this knowledgebase, picked from its tree', async () => {
    const { run } = mount();
    chooseFolder(THREE);
    await screen.findByTestId('knowledge-import-found');
    fireEvent.click(screen.getByRole('radio', { name: /Under a Page of This Knowledgebase/ }));
    const picker = await screen.findByRole('radiogroup', { name: 'Page to Import Under' });
    const pages = within(picker).getAllByRole('radio');
    expect(pages.map((p) => p.closest('label')!.textContent)).toEqual(['Start Here', 'Guides']);
    // The open page is chosen first.
    expect(pages[1]).toHaveProperty('checked', true);
    await waitFor(() =>
      expect(screen.getByRole('note').textContent).toContain('land together under Guides'),
    );
    fireEvent.click(pages[0]!);
    await waitFor(() =>
      expect(screen.getByRole('note').textContent).toContain('land together under Start Here'),
    );
    const go = screen.getByRole('button', { name: 'Import 3 Pages' });
    await waitFor(() => expect(go.getAttribute('aria-busy')).not.toBe('true'));
    fireEvent.click(go);
    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(run.mock.calls[0]![0]).toMatchObject({
      source: 'markdown-folder',
      name: 'kb',
      destination: { kind: 'under', pageId: 'home' },
    });
  });

  it('a plan that cannot fit says why and offers no Import', async () => {
    // 499 pages there: three more do not fit under one of them.
    mount({ tabs: Array.from({ length: 499 }, (_, i) => tab(`t${i}`, `Page ${i}`)) });
    chooseFolder(THREE);
    await screen.findByRole('button', { name: 'Import 3 Pages' });
    fireEvent.click(screen.getByRole('radio', { name: /Under a Page of This Knowledgebase/ }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Too Many Pages');
    expect(alert.textContent).toContain('It holds 3 pages, and there is room for 1.');
    expect(screen.queryByRole('button', { name: /^Import/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose Another' })).toBeTruthy();
    // Going back to a place with room brings Import back.
    fireEvent.click(screen.getByRole('radio', { name: /A New Knowledgebase/ }));
    expect(await screen.findByRole('button', { name: 'Import 3 Pages' })).toBeTruthy();
  });

  it('with Pro on, offers the first pages that fit and says what was left out', async () => {
    // The fixed bound of 500: 499 there, so one of the three fits under a page. Nobody's usage is known here, so the
    // words are the bound's, with no tier named.
    setKnowledgeTier('doc', { pagesMax: 500, historyDays: 30 });
    const { run } = mount({
      tabs: Array.from({ length: 499 }, (_, i) => tab(`t${i}`, `Page ${i}`)),
    });
    chooseFolder(THREE);
    await screen.findByRole('button', { name: 'Import 3 Pages' });
    fireEvent.click(screen.getByRole('radio', { name: /Under a Page of This Knowledgebase/ }));
    expect(await screen.findByText('1 more page fits')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Import First 1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import 1 Page' }));
    await waitFor(() => expect(run).toHaveBeenCalled());
    expect(run.mock.calls[0]![0].plan.summary.leftOut).toBe(2);
    expect(
      await screen.findByText(
        'Imported 3 of 5 pages. The other 2 were left out: this Knowledgebase is full.',
      ),
    ).toBeTruthy();
    forgetKnowledgeTiersForTests();
  });

  it('says when an archive holds no pages, with the way back', async () => {
    mount();
    chooseFolder({ 'kb/logo.png': 'PNG' });
    expect(await screen.findByText('No Pages Found')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Import/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Another' }));
    expect(screen.getByText('Drop a Folder or a .zip Here')).toBeTruthy();
  });
});

describe('KnowledgeImportPanel, importing and done', () => {
  it('shows a determinate bar, and Cancel stops it between batches', async () => {
    let finish: (r: RunImportResult) => void = () => {};
    let args: RunImportArgs | null = null;
    mount({
      run: (a) => {
        args = a;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    chooseFolder(THREE);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3 Pages' }));
    const bar = await screen.findByRole('progressbar', { name: 'Importing Pages' });
    expect(screen.getByText('Importing 0 of 3 Pages')).toBeTruthy();
    act(() => args!.onProgress({ done: 2, total: 3 }));
    expect(screen.getByText('Importing 2 of 3 Pages')).toBeTruthy();
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(bar.getAttribute('aria-valuemax')).toBe('3');
    expect(screen.getByText(/pages already imported stay/)).toBeTruthy();
    expect(args!.cancelled()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(args!.cancelled()).toBe(true);
    expect(screen.getByText(/Stopping after the pages being saved now/)).toBeTruthy();
    await act(async () => finish(result({ imported: 2, cancelled: true })));
    expect(await screen.findByText('2 of 3 Pages Imported')).toBeTruthy();
    expect(screen.getByText('Import Cancelled')).toBeTruthy();
  });

  it('ends with a summary naming what failed, and opens the first page', async () => {
    const { onOpenPage, onClose } = mount({
      run: async () =>
        result({
          imported: 2,
          failedPages: [{ title: 'Giant Page', reason: 'It is larger than a page may be.' }],
          failedPictures: [
            {
              page: 'Setup',
              picture: 'shot.heic',
              reason: 'Its format is not one a picture can be.',
            },
          ],
        }),
    });
    chooseFolder(THREE);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3 Pages' }));
    const done = await screen.findByTestId('knowledge-import-done');
    expect(done.getAttribute('role')).toBe('status');
    expect(screen.getByText('2 of 3 Pages Imported')).toBeTruthy();
    const pages = screen.getByRole('region', { name: 'Pages Not Imported' });
    expect(pages.textContent).toContain('Giant Page · It is larger than a page may be.');
    const pictures = screen.getByRole('region', { name: 'Pictures Not Imported' });
    expect(pictures.textContent).toContain('shot.heic');
    expect(pictures.textContent).toContain('Setup keeps its description.');
    const open = screen.getByRole('button', { name: 'Open Home' });
    expect(document.activeElement).toBe(open);
    fireEvent.click(open);
    expect(onOpenPage).toHaveBeenCalledWith('doc', 'new-1');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('a clean import says how many pages landed; one where saving stalled says what to do', async () => {
    mount({ run: async () => result({ imported: 1, stalled: true, first: null }) });
    chooseFolder(THREE);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3 Pages' }));
    expect(await screen.findByText('Saving Stopped Answering')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
  });
});
