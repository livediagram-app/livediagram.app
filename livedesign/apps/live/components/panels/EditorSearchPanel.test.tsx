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
    openDocument: vi.fn(),
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
});
