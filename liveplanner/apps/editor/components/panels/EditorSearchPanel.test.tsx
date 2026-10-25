// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The panel itself is lazy (next/dynamic); a stub captures the props the editor wires.
const panelProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const editor = vi.hoisted(() => ({
  setActiveId: vi.fn(),
  setSelectedId: vi.fn(),
  openItem: vi.fn(),
}));
vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    panelProps.current = props;
    return null;
  },
}));
vi.mock('@/app/project/[id]/EditorContext', () => ({
  useEditorContext: () => ({
    searchOpen: true,
    projectList: [],
    folders: [{ id: 'f 1', name: 'Plans' }],
    sharedProjects: [],
    teams: [],
    teamFolders: [],
    teamProjects: [],
    tabs: [],
    activeId: 't1',
    openProject: vi.fn(),
    setActiveId: editor.setActiveId,
    setSelectedId: editor.setSelectedId,
    plan: { context: { items: new Map(), types: [], openItem: editor.openItem } },
    isReadOnly: true,
    setSearchOpen: vi.fn(),
    openSettingsAt: vi.fn(),
  }),
}));
vi.mock('@/hooks/canvas/useEditorCommands', () => ({
  useEditorCommands: () => ({ commandItems: [], runCommand: vi.fn() }),
}));
vi.mock('@liveworkspace/workbench/hooks/ui/useIconCatalogs', () => ({
  useIconCatalogs: () => undefined,
}));

import { EditorSearchPanel } from './EditorSearchPanel';

afterEach(() => vi.unstubAllGlobals());

// The editor's search panel (docs/specs/008-canvas/canvas-and-palette.md "Search panel").
describe('EditorSearchPanel', () => {
  it('opens a picked personal folder on the Explorer page', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: 'https://example.test', assign });
    render(<EditorSearchPanel />);
    const onSelectFolder = panelProps.current?.onSelectFolder as ((id: string) => void) | undefined;
    expect(onSelectFolder).toBeTypeOf('function');
    onSelectFolder!('f 1');
    expect(assign).toHaveBeenCalledWith('https://example.test/explorer/folder?id=f%201');
  });

  // A card picked opens in its panel, on the tab whose board shows it (canvas-and-palette.md "Search panel").
  it('opens a picked card on its board’s tab', () => {
    render(<EditorSearchPanel />);
    expect(panelProps.current?.cards).toBeTruthy();
    const onSelectCard = panelProps.current?.onSelectCard as (
      id: string,
      tab: string | null,
    ) => void;
    onSelectCard('i1', 't2');
    expect(editor.setActiveId).toHaveBeenCalledWith('t2');
    expect(editor.openItem).toHaveBeenCalledWith('i1');
    vi.clearAllMocks();
    // On its own tab already, or shown on no board: it opens where the person is.
    onSelectCard('i2', 't1');
    onSelectCard('i3', null);
    expect(editor.setActiveId).not.toHaveBeenCalled();
    expect(editor.openItem).toHaveBeenCalledTimes(2);
  });

  // A Plan tab's content covers the canvas, so search offers nothing to add to it.
  it('offers no Add to canvas group', () => {
    render(<EditorSearchPanel />);
    expect(panelProps.current?.paletteItems).toBeUndefined();
    expect(panelProps.current?.onAddPaletteItem).toBeUndefined();
  });
});
