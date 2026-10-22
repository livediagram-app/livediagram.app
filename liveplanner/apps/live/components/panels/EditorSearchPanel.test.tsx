// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The panel itself is lazy (next/dynamic); a stub captures the props the editor wires.
const panelProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
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
    setActiveId: vi.fn(),
    setSelectedId: vi.fn(),
    isReadOnly: true,
    setSearchOpen: vi.fn(),
    openSettingsAt: vi.fn(),
  }),
}));
vi.mock('@/hooks/canvas/useEditorCommands', () => ({
  useEditorCommands: () => ({ commandItems: [], runCommand: vi.fn() }),
}));
vi.mock('@/hooks/ui/useIconCatalogs', () => ({ useIconCatalogs: () => undefined }));

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

  // A Plan tab's content covers the canvas, so search offers nothing to add to it.
  it('offers no Add to canvas group', () => {
    render(<EditorSearchPanel />);
    expect(panelProps.current?.paletteItems).toBeUndefined();
    expect(panelProps.current?.onAddPaletteItem).toBeUndefined();
  });
});
