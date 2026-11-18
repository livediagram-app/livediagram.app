// @vitest-environment jsdom
import { Profiler, type ComponentProps, type ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { Tab } from '@livedocuments/document';
import type { EditorContextValue } from './EditorContext';

// docs/specs/007-editor/blueprints/flashcards.md "Performance and limits": the chrome that never reads the document
// reads the chrome store a slice at a time, so a typing commit (a new view-model whose only change is a tab's
// writing) renders none of it, while the document's readers still render.

const renders = { header: 0, tabBar: 0, hosts: 0, reader: 0 };
// The rest of the chrome (Work Tracker 907), each counted by a hook it calls on every render of its own (a Profiler
// round it would count its parent's renders too).
const chromeRenders = vi.hoisted((): Record<string, number> => ({}));
const hit = vi.hoisted(() => (id: string) => {
  chromeRenders[id] = (chromeRenders[id] ?? 0) + 1;
});

// The header is the top-right corner card (experiment: no header bar).
vi.mock('@liveworkspace/workbench/components/chrome/EditorCornerActions', () => ({
  EditorCornerActions: () => {
    renders.header++;
    return <h1>Corner</h1>;
  },
}));
vi.mock('@/components/chrome/TabBar', () => ({
  TabBar: (p: { tabs: Tab[]; isOutOfScope?: (id: string) => boolean }) => {
    renders.tabBar++;
    // A tab out of a tab-scoped link's scope is marked, as the real bar greys it.
    return (
      <nav>
        {p.tabs.map((t) => `${t.name}${p.isOutOfScope?.(t.id) ? ' (out of scope)' : ''}`).join(',')}
      </nav>
    );
  },
}));
// Each dialog's code loads on demand: here it is a marker naming that something opened.
vi.mock('next/dynamic', () => ({ default: () => () => <div data-testid="opened" /> }));
vi.mock('@/components/start/useTemplatePickMove', () => ({ useTemplatePickMove: () => () => {} }));
// The hosts' own engines stand down: what is counted is whether the host renders at all.
vi.mock('@/components/tour/TourStage', () => ({ TourStage: () => null }));
vi.mock('@/hooks/canvas/useQuickStyle', () => ({
  useQuickStyle: () => {
    hit('QuickStyleHost');
    return { view: null };
  },
}));
vi.mock('@/hooks/editor/useFindReplace', () => ({
  useFindReplace: () => {
    hit('FindHost');
    return { open: false, openBar: () => {} };
  },
}));
vi.mock('@liveworkspace/workbench/components/tour/tour-offer', async (original) => {
  const real =
    await original<typeof import('@liveworkspace/workbench/components/tour/tour-offer')>();
  return {
    ...real,
    useOfferTour: (...args: Parameters<typeof real.useOfferTour>) => {
      hit('PagesTourHost');
      return real.useOfferTour(...args);
    },
  };
});
vi.mock('@liveworkspace/workbench/hooks/ui/useCoarsePointer', () => ({
  useCoarsePointer: () => {
    hit('ElementTourHost');
    return false;
  },
}));
vi.mock('@liveworkspace/workbench/hooks/ui/useShiftHeld', () => ({
  useShiftHeld: () => {
    hit('ModifierHint');
    return false;
  },
}));
vi.mock('@liveworkspace/workbench/components/chrome/NewVersionPrompt', () => ({
  NewVersionPrompt: () => {
    hit('NewVersionPrompt');
    return null;
  },
}));
vi.mock('@liveworkspace/workbench/components/canvas/PageTitleBar', async (original) => {
  const real =
    await original<typeof import('@liveworkspace/workbench/components/canvas/PageTitleBar')>();
  return {
    ...real,
    PageTitleBar: () => {
      hit('PageSheetTitleBar');
      return null;
    },
  };
});
vi.mock('@livedocuments/ui', async (original) => {
  const real = await original<typeof import('@livedocuments/ui')>();
  return {
    ...real,
    atLeastInset: (...args: Parameters<typeof real.atLeastInset>) => {
      hit('LandscapeBarsHandle');
      return real.atLeastInset(...args);
    },
  };
});

const { EditorChromeContext, EditorContext, usePublishEditorChrome, useEditorContext } =
  await import('./EditorContext');
const { EditorViewFooter, EditorViewHeader, sameTabsForBar } = await import('./editor-view-bars');
const { sameDepsButWriting, sameSlice, sameTabButWriting } = await import('./editor-chrome-equal');
const { EditorTabDialogs } = await import('@/components/dialogs/EditorTabDialogs');
const { CollaboratorsHost } = await import('@/components/dialogs/CollaboratorsHost');
const { EditorModals } = await import('@/components/dialogs/EditorModals');
const { EditorAnchoredPopovers } = await import('@/components/panels/EditorAnchoredPopovers');
const { EditorElementDialogs } = await import('@/components/dialogs/EditorElementDialogs');
const { EditorContextMenuHost } = await import('@/components/palette/EditorContextMenuHost');
const { EditorStartPanels } = await import('@/components/start/EditorStartPanels');
const { QuickStyleHost } = await import('@/components/canvas/QuickStyleHost');
const { EditorFindHost } = await import('@/components/find/FindHost');
const { PagesTourHost } = await import('@/components/tour/PagesTourHost');
const { ElementTourHost } = await import('@/components/tour/ElementTourHost');
const { ModifierHint } = await import('@/components/chrome/ModifierHintBanner');
const { EditorNewVersionPrompt } = await import('@/components/chrome/NewVersionPrompt');
const { LandscapeBarsHandle } = await import('@/components/chrome/LandscapeBars');
const { PageSheetTitleBar } = await import('@/components/canvas/PageSheetTitleBar');
const { useCanvasChromeProps } = await import('@/components/canvas/canvas-chrome-props');
const { createSelectionStore } = await import('@liveworkspace/workbench/lib/selection-store');
const { SelectionStoreProvider } =
  await import('@liveworkspace/workbench/hooks/canvas/useSelectionStore');
const { withStableEventProps } =
  await import('@liveworkspace/workbench/components/primitives/withStableEventProps');

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
  previewModes: ['edit'],
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
  // The tours, the Quick Style bar and Find.
  editorMode: { mode: 'pages' },
  userPreferences: {},
  quickStyleDeps: { activeTab: tab, pages: [], onUpdate: () => {}, style: { size: 'm' } },
  findDeps: { activeTab: tab, pages: [], scope: 'tab', onReplace: () => {} },
  hasUnsavedChanges: () => false,
} as unknown as EditorContextValue;

// A typing commit: a new view-model, a new tab holding new writing, nothing else changed.
const typed = (v: EditorContextValue): EditorContextValue => {
  const next = {
    ...v.activeTab,
    articles: { 'card-1': { blocks: [{ id: 'b' }] } },
  } as unknown as Tab;
  // The page rebuilds every bag of handlers on each render, so a typing commit hands the hosts new ones.
  const quick = v.quickStyleDeps as unknown as Record<string, unknown>;
  const find = v.findDeps as unknown as Record<string, unknown>;
  return {
    ...v,
    activeTab: next,
    tabs: [next],
    quickStyleDeps: { ...quick, activeTab: next, onUpdate: () => {} },
    findDeps: { ...find, activeTab: next, onReplace: () => {} },
    hasUnsavedChanges: () => false,
  } as unknown as EditorContextValue;
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
        <EditorViewHeader isOffline={false} isMobileViewport={false} landscapeShown />
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
    expect(screen.getByRole('heading').textContent).toBe('Corner');
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
    // The corner card never reads the name: a rename leaves it be.
    expect(renders.header).toBe(0);
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

describe('a tab-scoped link', () => {
  // Work Tracker 946: the scope is set after mount (the share-code bootstrap), and the bar marks the other tabs then.
  // It subscribes to `isOutOfScope`, which useTabScope makes afresh only when the scope changes.
  it('marks the tabs out of scope once the scope is set after mount', () => {
    const other = { ...tab, id: 't2', name: 'Two' };
    const both: EditorContextValue = { ...base, tabs: [tab, other] };
    const { rerender } = render(<Page value={both} />);
    expect(screen.getByRole('navigation').textContent).toBe('Cards,Two');
    act(() => {
      rerender(
        <Page
          value={{ ...both, sessionTabScope: 't2', isOutOfScope: (id: string) => id !== 't2' }}
        />,
      );
    });
    expect(screen.getByRole('navigation').textContent).toBe('Cards (out of scope),Two');
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

// What the editor view places each render, as it places it: props rebuilt from the view-model, new handlers each time.
// Made once, as EditorView makes them (`NEW_VERSION_PROMPT`, `TOURS`).
const NEW_VERSION = <EditorNewVersionPrompt />;
const TOURS = (
  <>
    <PagesTourHost />
    <ElementTourHost />
  </>
);
const opener = { current: () => {} };
const canvasMain = { current: null };
const selection = createSelectionStore();

function ViewChrome({ value }: { value: EditorContextValue }) {
  return (
    <SelectionStoreProvider store={selection}>
      <QuickStyleHost hidden={false} />
      <EditorFindHost openerRef={opener} canvasMainRef={canvasMain} />
      {TOURS}
      <ModifierHint
        readOnly={false}
        drag={null}
        elements={value.activeTab.elements}
        hasElements
        suppressed={false}
      />
      {NEW_VERSION}
      <LandscapeBarsHandle shown onToggle={() => {}} />
    </SelectionStoreProvider>
  );
}

describe('the rest of the chrome (Work Tracker 907)', () => {
  it('renders none of it on a typing commit', () => {
    const { rerender } = render(
      <Page value={base}>
        <ViewChrome value={base} />
      </Page>,
    );
    const ids = Object.keys(chromeRenders).sort();
    expect(ids).toEqual(
      [
        'ElementTourHost',
        'FindHost',
        'LandscapeBarsHandle',
        'ModifierHint',
        'NewVersionPrompt',
        'PagesTourHost',
        'QuickStyleHost',
      ].sort(),
    );
    for (const k of ids) chromeRenders[k] = 0;
    let value = base;
    for (let i = 0; i < 5; i++) {
      value = typed(value);
      rerender(
        <Page value={value}>
          <ViewChrome value={value} />
        </Page>,
      );
    }
    expect(chromeRenders).toEqual(Object.fromEntries(ids.map((k) => [k, 0])));
  });

  it('renders the Quick Style bar and Find when their data changes', () => {
    const { rerender } = render(
      <Page value={base}>
        <ViewChrome value={base} />
      </Page>,
    );
    for (const k of Object.keys(chromeRenders)) chromeRenders[k] = 0;
    const next = {
      ...base,
      quickStyleDeps: { ...base.quickStyleDeps, style: { size: 'l' } },
      findDeps: { ...base.findDeps, scope: 'document' },
    } as unknown as EditorContextValue;
    act(() => {
      rerender(
        <Page value={next}>
          <ViewChrome value={next} />
        </Page>,
      );
    });
    expect(chromeRenders.QuickStyleHost).toBeGreaterThan(0);
    expect(chromeRenders.FindHost).toBeGreaterThan(0);
    expect(chromeRenders.PagesTourHost).toBe(0);
  });
});

describe('the canvas chrome and the page title bar (Work Tracker 907)', () => {
  const chromeBox = { renders: 0, last: null as Record<string, unknown> | null };
  const Chrome = withStableEventProps((p: Record<string, unknown>) => {
    chromeBox.renders++;
    chromeBox.last = p;
    return null;
  });
  const pages = [{ id: 'card-1', flow: 'card-1' }];
  const elements: never[] = [];
  // The canvas's props on a render: the pages' view rebuilt whole, its writing new on a typing commit, and the props
  // the chrome never reads (the chart palette, the arrow preview) new on every render.
  const canvasProps = (articles: object, pagesList: object[] = pages) =>
    ({
      documentName: 'Talk',
      elements,
      canUndo: true,
      onUndo: () => {},
      chartPalette: ['#000'],
      previewDrawnArrow: () => {},
      pagesMode: {
        pages: pagesList,
        focusPage: () => {},
        edit: { addPage: () => {} },
        arrangement: { stacked: true, toggle: () => {} },
        articles: { flows: articles },
      },
    }) as never;
  function CanvasHost({ props }: { props: never }) {
    return <Chrome {...useCanvasChromeProps(props)} />;
  }

  it('hands the chrome nothing new on a typing commit, and its writing through the store', () => {
    chromeBox.renders = 0;
    const { rerender } = render(<CanvasHost props={canvasProps({ 'card-1': { blocks: [] } })} />);
    expect(chromeBox.renders).toBe(1);
    expect(chromeBox.last).not.toHaveProperty('chartPalette');
    expect(chromeBox.last).not.toHaveProperty('previewDrawnArrow');
    const writing = chromeBox.last!.writing as { get: () => { flows: object } };
    for (let i = 0; i < 5; i++) {
      const flows = { 'card-1': { blocks: [{ id: `b${i}` }] } };
      rerender(<CanvasHost props={canvasProps(flows)} />);
      expect(writing.get().flows).toBe(flows);
    }
    expect(chromeBox.renders).toBe(1);
    expect(chromeBox.last!.pagesMode).not.toHaveProperty('articles');
    // A page added renders it.
    rerender(<CanvasHost props={canvasProps({}, [...pages, { id: 'card-2', flow: 'card-2' }])} />);
    expect(chromeBox.renders).toBe(2);
  });

  it('hands the chrome no pages view off Pages mode', () => {
    const { rerender } = render(<CanvasHost props={{ documentName: 'Talk', elements } as never} />);
    expect(chromeBox.last!.pagesMode).toBeUndefined();
    rerender(<CanvasHost props={{ documentName: 'Talk', elements, pagesMode: null } as never} />);
    expect(chromeBox.last!.pagesMode).toBeNull();
  });

  it("skips the page title bar while only its card's writing changes", () => {
    const page = { id: 'card-1', flow: 'card-1', kind: 'flashcard', index: 0, locked: false };
    const act0 = new Proxy({}, { get: () => () => {} });
    const presets: never[] = [];
    const bar = (style: object) => (
      <PageSheetTitleBar
        {...({
          page,
          zoom: 1,
          mobile: true,
          labelled: false,
          appearanceLabelled: false,
          locked: false,
          pageButtons: false,
          articleButtons: true,
          styleButton: false,
          notesButton: false,
          tidyButton: false,
          tabStyle: false,
          hasArticle: true,
          storedArticleStyle: style,
          themeAccent: '#000',
          themePresets: presets,
          deck: undefined,
          tidyEdit: undefined,
          applyReach: 0,
          open: false,
          styleRequest: 0,
          textRequest: 0,
          layoutsRequest: 0,
          backgroundRequest: 0,
          shownName: undefined,
          many: false,
          act: act0,
        } as unknown as ComponentProps<typeof PageSheetTitleBar>)}
      />
    );
    const { rerender } = render(bar({ margins: 'narrow' }));
    chromeRenders.PageSheetTitleBar = 0;
    // A typing commit parses the article afresh: an equal style, a new object.
    for (let i = 0; i < 3; i++) rerender(bar({ margins: 'narrow' }));
    expect(chromeRenders.PageSheetTitleBar).toBe(0);
    rerender(bar({ margins: 'wide' }));
    expect(chromeRenders.PageSheetTitleBar).toBe(1);
  });
});

describe('how the chrome compares (editor-chrome-equal)', () => {
  const t = tab;
  const fn = () => {};
  it('sees a bag of handlers and data as the same while only its handlers and its writing are new', () => {
    const a = { activeTab: t, pages: [], on: fn, nested: { go: fn, n: 1 } };
    expect(sameDepsButWriting(a, a)).toBe(true);
    expect(sameDepsButWriting(a, { ...a, on: () => {}, nested: { go: () => {}, n: 1 } })).toBe(
      true,
    );
    expect(sameDepsButWriting(a, { ...a, activeTab: typed(base).activeTab })).toBe(true);
    // Data that changed, a field come or gone, a tab changed beyond its writing.
    expect(sameDepsButWriting(a, { ...a, nested: { go: fn, n: 2 } })).toBe(false);
    expect(sameDepsButWriting(a, { ...a, nested: { go: fn, n: 1, m: 1 } as never })).toBe(false);
    expect(sameDepsButWriting(a, { ...a, pages: [] })).toBe(false);
    expect(sameDepsButWriting(a, { ...a, extra: 1 } as never)).toBe(false);
    expect(sameDepsButWriting(a, { ...a, activeTab: { ...t, name: 'X' } })).toBe(false);
    expect(
      sameDepsButWriting(a, { activeTab: t, pages: a.pages, on: fn, other: a.nested } as never),
    ).toBe(false);
  });

  it('compares a tab but for its writing, and a slice field by field', () => {
    expect(sameTabButWriting(t, { ...t, articles: {} })).toBe(true);
    expect(sameTabButWriting(t, { ...t, locked: true })).toBe(false);
    expect(sameTabButWriting(t, { ...t, elements: [] })).toBe(false);
    const slice = { a: 1, b: t };
    expect(sameSlice(slice, slice)).toBe(true);
    expect(sameSlice(slice, { a: 1, b: t })).toBe(true);
    expect(sameSlice(slice, { a: 2, b: t })).toBe(false);
    expect(sameSlice(slice, { a: 1 } as never)).toBe(false);
  });
});
