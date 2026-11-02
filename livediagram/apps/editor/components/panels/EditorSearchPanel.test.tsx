// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The panel itself is lazy (next/dynamic); a stub captures the props the editor wires.
const opened = vi.hoisted(() => vi.fn());
const panelProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    panelProps.current = props;
    return null;
  },
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ({
    searchOpen: true,
    documentList: [],
    folders: [{ id: 'f 1', name: 'Plans' }],
    sharedDocuments: [],
    teams: [],
    teamFolders: [],
    teamDocuments: [],
    tabs: [],
    activeId: 't1',
    openDocument: opened,
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
vi.mock('@liveworkspace/workbench/hooks/ui/useIconCatalogs', () => ({
  useIconCatalogs: () => undefined,
}));
vi.mock('@/components/palette/useEditorTileActions', () => ({ useEditorTileActions: () => ({}) }));

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

  // Work Tracker #63: a result from every app opens in its own app; one of this app's opens here.
  it("opens another app's item in that app, and one of its own here", () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: 'https://example.test', assign });
    render(<EditorSearchPanel />);
    const pick = panelProps.current?.onSelectWorkspaceItem as (item: {
      id: string;
      app: string;
      sharedVia: string | null;
    }) => void;
    expect((panelProps.current?.workspace as { client: unknown } | undefined)?.client).toBeTruthy();
    pick({ id: 'x 1', app: 'liveplanner', sharedVia: null });
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('x%201'));
    expect(assign.mock.calls[0]![0]).toMatch(/^https:\/\/www\.liveplanner\.app\//);
    pick({ id: 'own', app: 'livediagram', sharedVia: 'code-1' });
    expect(opened).toHaveBeenCalledWith('own', 'code-1');
    pick({ id: 'mine', app: 'livediagram', sharedVia: null });
    expect(opened).toHaveBeenLastCalledWith('mine', undefined);
  });
});
