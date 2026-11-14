// @vitest-environment jsdom
import { Profiler, type ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { Tab } from '@livedocuments/document';
import type { EditorContextValue } from './EditorContext';

// docs/specs/007-editor/blueprints/flashcards.md "Performance and limits": the chrome that never reads the document
// reads the chrome store a slice at a time, so a typing commit (a new view-model whose only change is a tab's
// writing) renders none of it, while the document's readers still render.

const renders = { header: 0, tabBar: 0, hosts: 0, reader: 0 };

vi.mock('@/components/chrome/EditorHeader', () => ({
  EditorHeader: (p: { documentName: string }) => {
    renders.header++;
    return <h1>{p.documentName}</h1>;
  },
}));
vi.mock('@/components/chrome/TabBar', () => ({
  TabBar: (p: { tabs: Tab[] }) => {
    renders.tabBar++;
    return <nav>{p.tabs.map((t) => t.name).join(',')}</nav>;
  },
}));
// Each dialog's code loads on demand: here it is a marker naming that something opened.
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="opened" /> }));
vi.mock('@/components/start/useTemplatePickMove', () => ({ useTemplatePickMove: () => () => {} }));

const { EditorChromeContext, EditorContext, usePublishEditorChrome, useEditorContext } =
  await import('./EditorContext');
const { EditorViewFooter, EditorViewHeader, sameTabsForBar } = await import('./editor-view-bars');
const { EditorTabDialogs } = await import('@/components/dialogs/EditorTabDialogs');
const { CollaboratorsHost } = await import('@/components/dialogs/CollaboratorsHost');
const { EditorModals } = await import('@/components/dialogs/EditorModals');
const { EditorAnchoredPopovers } = await import('@/components/panels/EditorAnchoredPopovers');
const { EditorElementDialogs } = await import('@/components/dialogs/EditorElementDialogs');
const { EditorContextMenuHost } = await import('@/components/palette/EditorContextMenuHost');
const { EditorStartPanels } = await import('@/components/start/EditorStartPanels');

const tab = {
  id: 't1',
  name: 'Cards',
  elements: [{ id: 'e1' }],
  articles: { 'card-1': { blocks: [] } },
} as unknown as Tab;
const self = { id: 'me', name: 'Me', color: '#000' };
const base = {
  // The dialogs, all shut.
  exportOpen: false,
  importOpen: false,
  shareDialogOpen: false,
  collaborators: null,
  settingsOpen: false,
  canvasThemeTab: null,
  commentThreadOpenId: null,
  actionPopoverOpenId: null,
  assignActionFor: null,
  linkPickerOpenForId: null,
  cellLinkPickerOpenFor: null,
  lineDataOpenForId: null,
  codeEditOpenForId: null,
  sankeyFlowsOpenForId: null,
  mapDialogOpenForId: null,
  imagePickerOpenFor: null,
  contextMenu: null,
  isReadOnly: false,
  // The header.
  appChrome: true,
  zenMode: false,
  embedMode: false,
  anyWelcomeOpen: false,
  hydrated: true,
  documentId: 'd1',
  documentName: 'Talk',
  documentShareable: false,
  documentTeamId: null,
  canShareDocument: true,
  sessionCommunity: null,
  copying: false,
  isStructureReadOnly: false,
  renameDocumentNonce: 0,
  slideDeck: { runnable: [], startingDeck: false },
  can: { level: 'edit' },
  isOwner: true,
  canToggleRole: false,
  selfParticipant: self,
  livePresence: [],
  documentOwnerId: 'me',
  documentOwnerName: null,
  documentOwnerColor: null,
  // The tab bar.
  tabs: [tab],
  activeId: 't1',
  activeTab: tab,
  followMe: { followingId: null, followerCount: 0 },
  documentList: [],
  workbench: null,
  sessionTabScope: null,
  isOutOfScope: () => false,
  renameTabNonce: 0,
  participantsByTab: new Map(),
  sessionRole: 'edit',
  hasClipboard: false,
  // The template start.
  pendingDraw: null,
  activeTabConnected: false,
} as unknown as EditorContextValue;

// A typing commit: a new view-model, a new tab holding new writing, nothing else changed.
const typed = (v: EditorContextValue): EditorContextValue => {
  const next = {
    ...v.activeTab,
    articles: { 'card-1': { blocks: [{ id: 'b' }] } },
  } as unknown as Tab;
  return { ...v, activeTab: next, tabs: [next] };
};

const rendered = (k: keyof typeof renders) => {
  renders[k]++;
};

function DocumentReader() {
  useEditorContext();
  rendered('reader');
  return null;
}

const HOSTS = (
  <Profiler id="hosts" onRender={() => renders.hosts++}>
    <EditorTabDialogs />
    <CollaboratorsHost />
    <EditorModals />
    <EditorAnchoredPopovers />
    <EditorElementDialogs />
    <EditorContextMenuHost />
    <EditorStartPanels />
  </Profiler>
);

function Page({ value, children }: { value: EditorContextValue; children?: ReactNode }) {
  const chrome = usePublishEditorChrome(value);
  return (
    <EditorContext.Provider value={value}>
      <EditorChromeContext.Provider value={chrome}>
        <EditorViewHeader
          isOffline={false}
          headerCommunity={false}
          isMobileViewport={false}
          landscapeShown
        />
        <EditorViewFooter isOffline={false} landscapeShown onSelectTab={() => {}} />
        {HOSTS}
        <DocumentReader />
        {children}
      </EditorChromeContext.Provider>
    </EditorContext.Provider>
  );
}

beforeEach(() => {
  for (const k of Object.keys(renders) as (keyof typeof renders)[]) renders[k] = 0;
});

describe('the chrome store', () => {
  it('renders no chrome on a typing commit, and the document readers once each', () => {
    const { rerender } = render(<Page value={base} />);
    expect(screen.getByRole('heading').textContent).toBe('Talk');
    for (const k of Object.keys(renders) as (keyof typeof renders)[]) renders[k] = 0;
    let value = base;
    for (let i = 0; i < 5; i++) {
      value = typed(value);
      rerender(<Page value={value} />);
    }
    expect(renders).toEqual({ header: 0, tabBar: 0, hosts: 0, reader: 5 });
  });

  it('renders the piece whose slice changed, and only it', () => {
    const { rerender } = render(<Page value={base} />);
    for (const k of Object.keys(renders) as (keyof typeof renders)[]) renders[k] = 0;
    rerender(<Page value={{ ...typed(base), documentName: 'Renamed' }} />);
    expect(screen.getByRole('heading').textContent).toBe('Renamed');
    expect(renders.header).toBe(1);
    expect(renders.tabBar).toBe(0);
    expect(renders.hosts).toBe(0);
    // A tab renamed renders the tab bar.
    const renamed = { ...tab, name: 'Deck' };
    rerender(<Page value={{ ...base, tabs: [renamed], activeTab: renamed }} />);
    expect(screen.getByRole('navigation').textContent).toBe('Deck');
    expect(renders.tabBar).toBe(1);
  });

  it('opens a dialog as its flag is set, before the next paint', () => {
    const { rerender } = render(<Page value={base} />);
    expect(screen.queryByTestId('opened')).toBeNull();
    act(() => {
      rerender(<Page value={{ ...base, collaborators: { focusId: null } }} />);
    });
    expect(screen.getAllByTestId('opened')).toHaveLength(1);
    expect(renders.hosts).toBeGreaterThan(0);
    act(() => {
      rerender(<Page value={base} />);
    });
    expect(screen.queryByTestId('opened')).toBeNull();
  });
});

describe('sameTabsForBar', () => {
  it("is the same list whatever a tab's writing, and a new one for a name, a tab or the order", () => {
    const other = { ...tab, id: 't2', name: 'Two' };
    expect(sameTabsForBar([tab], [tab])).toBe(true);
    expect(sameTabsForBar([tab], [typed(base).activeTab])).toBe(true);
    expect(sameTabsForBar([tab], [{ ...tab, elements: [] }])).toBe(true);
    expect(sameTabsForBar([tab], [{ ...tab, name: 'X' }])).toBe(false);
    expect(sameTabsForBar([tab], [{ ...tab, locked: true }])).toBe(false);
    expect(sameTabsForBar([tab], [tab, other])).toBe(false);
    expect(sameTabsForBar([tab, other], [other, tab])).toBe(false);
  });
});
