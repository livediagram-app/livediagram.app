// @vitest-environment jsdom

// The one Import dialog's Knowledgebase sources (docs/specs/020-import-export/knowledgebase-import.md "Share roles"):
// an Editor is handed them and sees three choices beside the single-file formats; a Participant or a Viewer is
// handed none and sees none.

import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EditorChromeContext,
  createEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import type { KnowledgeImportProps } from './knowledge-import/KnowledgeImportPanel';
import { useKnowledgeImportProps } from './knowledge-import/useKnowledgeImportProps';
import { ImportTabDialog } from './ImportTabDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));

const SOURCES = ['Markdown Folder', 'Notion', 'Confluence'];

const knowledgebase: KnowledgeImportProps = {
  host: {
    ownerId: 'me',
    documentId: 'doc',
    offline: false,
    teamId: null,
    getTabs: () => [],
    getActiveTab: () => undefined,
    commitTabs: vi.fn(),
    markTabLoaded: vi.fn(),
  },
  pages: [],
  activePageId: 'home',
  onOpenPage: vi.fn(),
};

function open(props: { knowledgebase?: KnowledgeImportProps; formats?: readonly 'json'[] } = {}) {
  render(
    <ImportTabDialog
      tabName="Start Here"
      onImportFile={vi.fn()}
      onImportText={vi.fn()}
      onImportFileFormat={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );
}

describe('ImportTabDialog, the Knowledgebase sources', () => {
  it('offers the three sources to an Editor, beside the single-file formats, each saying what it takes', () => {
    open({ knowledgebase });
    expect(screen.getByRole('heading', { name: 'Into This Page' })).toBeTruthy();
    const group = screen.getByRole('region', { name: 'A Whole Knowledgebase' });
    for (const name of SOURCES) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeTruthy();
    }
    expect(group.textContent).toContain('.zip');
    expect(group.textContent).toContain('folder');
    // The single-file formats are still there, with the warning that is about them.
    expect(screen.getByRole('button', { name: /^Markdown A \.md file/ })).toBeTruthy();
    expect(screen.getByText(/This replaces everything on/)).toBeTruthy();
    // No other product's logo.
    expect(document.querySelector('img')).toBeNull();
  });

  it('opens a source inside the same dialog, and comes back to the formats', async () => {
    open({ knowledgebase });
    fireEvent.click(screen.getByRole('button', { name: /^Notion/ }));
    expect(await screen.findByText('Drop a Notion Export Here')).toBeTruthy();
    expect(screen.getByText('Import a Knowledgebase')).toBeTruthy();
    // The page is not replaced by this import: its warning is gone.
    expect(screen.queryByText(/This replaces everything on/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /All Formats/ }));
    expect(screen.getByRole('button', { name: /^Confluence/ })).toBeTruthy();
  });

  it('keeps the list when a page takes one single-file format only', () => {
    open({ knowledgebase, formats: ['json'] });
    expect(screen.getByRole('button', { name: /^JSON/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Markdown Folder/ })).toBeTruthy();
  });

  it('shows none of them to someone who is handed none', () => {
    open();
    for (const name of SOURCES) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${name}`) })).toBeNull();
    }
    expect(screen.queryByText('A Whole Knowledgebase')).toBeNull();
    expect(screen.getByText('Import to Page')).toBeTruthy();
  });
});

describe('useKnowledgeImportProps, by share role', () => {
  const propsFor = (over: Partial<EditorContextValue>) => {
    const store = createEditorChromeStore({
      can: resolveEditorCapabilities('edit'),
      isStructureReadOnly: false,
      documentId: 'doc',
      selfParticipant: { id: 'me' },
      documentTeamId: null,
      tabs: [{ id: 'home', name: 'Start Here', elements: [] }],
      activeId: 'home',
      ...over,
    } as unknown as EditorContextValue);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EditorChromeContext.Provider value={store}>{children}</EditorChromeContext.Provider>
    );
    return renderHook(() => useKnowledgeImportProps(), { wrapper }).result.current;
  };

  it('hands an Editor the import, over the open knowledgebase', () => {
    const props = propsFor({});
    expect(props?.host).toMatchObject({ ownerId: 'me', documentId: 'doc', offline: false });
    expect(props?.pages).toEqual([{ id: 'home', name: 'Start Here' }]);
    expect(props?.host.getTabs()).toHaveLength(1);
  });

  it('hands a Participant and a Viewer nothing', () => {
    expect(propsFor({ can: resolveEditorCapabilities('participate') })).toBeUndefined();
    expect(propsFor({ can: resolveEditorCapabilities('view') })).toBeUndefined();
  });

  it('hands nothing to an Editor of one page only, or before the reader is known', () => {
    expect(propsFor({ isStructureReadOnly: true })).toBeUndefined();
    expect(
      propsFor({ selfParticipant: { id: 'self' } as EditorContextValue['selfParticipant'] }),
    ).toBeUndefined();
    expect(propsFor({ documentId: null })).toBeUndefined();
  });
});
