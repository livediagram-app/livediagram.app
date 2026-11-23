// @vitest-environment jsdom

// The tab bar's Connect a File (liveworkspace/docs/specs/004-index/connected-tabs.md "From the tab bar"): offered only
// where connecting can work, an Editor's session that may change the tabs (never a Participant's or a Viewer's, a
// tab-scoped link's, an embed's, a workbench's, a guest's or an Offline document's). A press counts and opens the dialog;
// a file connected there is added at the end of the bar, giving no empty tab way, and the start screen's own entry
// still gives way to it.
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: { ctx: null as Record<string, unknown> | null, offline: false },
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => state.ctx,
}));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => state.offline,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/clamp-to-viewport')>()),
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

import { track } from '@/lib/telemetry';
import { tabBarProps } from '@/components/chrome/TabBar.test-props';
import { TabBarWithConnect, useTabBarConnect } from './TabBar';
import { useConnectStart } from '@/components/connect/useConnectStart';

const connectedTabs = {
  connected: new Map(),
  grant: vi.fn(),
  addConnectedTab: vi.fn().mockResolvedValue(undefined),
  showConnected: vi.fn(),
  goTo: vi.fn(),
};

// An Editor on their own document, on the server, unless a test says otherwise.
const editor = (over: Record<string, unknown> = {}) => ({
  accountUserId: 'user-1',
  documentId: 'doc-1',
  isStructureReadOnly: false,
  embedMode: false,
  workbench: null,
  sessionShareCode: null,
  connectedTabs,
  activeTab: { id: 't2' },
  tabs: [{ id: 't1' }, { id: 't2' }],
  ...over,
});

beforeEach(() => {
  state.ctx = editor();
  state.offline = false;
  vi.mocked(track).mockClear();
  connectedTabs.addConnectedTab.mockClear();
});
afterEach(cleanup);

const hook = () => renderHook(() => useTabBarConnect());

describe('Connect a File on the tab bar', () => {
  it('is offered to an Editor, and a press counts and opens the dialog', () => {
    const { result } = hook();
    expect(result.current.dialog).toBeNull();
    act(() => result.current.open!());
    expect(track).toHaveBeenCalledWith('Tab', 'Opened', 'ConnectButton');
    const dialog = result.current.dialog as ReactElement<{
      addTab: (made: unknown, tabId: string) => Promise<void>;
      onClose: () => void;
      hostKind: string;
      hostManaged: boolean;
    }>;
    expect(isValidElement(dialog)).toBe(true);
    expect(dialog.props).toMatchObject({ hostKind: 'document', hostManaged: true });
    const { newTabId, onOpenExplorer } = dialog.props as unknown as {
      newTabId: () => string;
      onOpenExplorer: () => void;
    };
    expect(newTabId()).toMatch(/^[0-9a-f-]{36}$/);
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: 'https://example.test', assign });
    onOpenExplorer();
    expect(assign).toHaveBeenCalledWith('https://example.test/explorer');
    vi.unstubAllGlobals();
    // Added at the end of the bar: no empty start tab gives way.
    void dialog.props.addTab({ name: 'Launch plan' }, 'new-tab');
    expect(connectedTabs.addConnectedTab).toHaveBeenCalledWith({ name: 'Launch plan' }, 'new-tab');
    act(() => dialog.props.onClose());
    expect(result.current.dialog).toBeNull();
  });

  it.each([
    ['a Participant or a Viewer (the tabs read-only)', { isStructureReadOnly: true }],
    ['a guest', { accountUserId: null }],
    ['a document not yet saved', { documentId: null }],
    ['an embed', { embedMode: true }],
    ['a workbench frame', { workbench: { shareCode: null } }],
  ])('is not offered to %s', (_who, over) => {
    state.ctx = editor(over);
    const { result } = hook();
    expect(result.current.open).toBeUndefined();
    expect(result.current.dialog).toBeNull();
  });

  it('is not offered on an Offline document, or outside the editor', () => {
    state.offline = true;
    expect(hook().result.current.open).toBeUndefined();
    state.offline = false;
    state.ctx = null;
    expect(hook().result.current.open).toBeUndefined();
  });

  it("asks the both-ways question only of who manages the document's links", () => {
    state.ctx = editor({ sessionShareCode: 'abc' });
    const { result } = hook();
    act(() => result.current.open!());
    expect(
      (result.current.dialog as ReactElement<{ hostManaged: boolean }>).props.hostManaged,
    ).toBe(false);
  });

  it('draws the button in the tab bar for an Editor, and none for a Viewer', () => {
    render(<TabBarWithConnect {...tabBarProps({})} />);
    expect(screen.getByRole('button', { name: 'Connect a File' })).toBeTruthy();
    cleanup();
    state.ctx = editor({ isStructureReadOnly: true });
    render(<TabBarWithConnect {...tabBarProps({ readOnly: true })} />);
    expect(screen.queryByRole('button', { name: 'Connect a File' })).toBeNull();
  });
});

describe('Connect File on the start screen', () => {
  it('gives way to the empty start tab it was opened on, unless it is the only one', () => {
    const render = renderHook(() => useConnectStart()).result.current!;
    const palette = {
      text: '#000',
      muted: '#555',
      border: '#ddd',
      surface: '#fff',
      column: '#eee',
      card: '#fff',
      focus: '#00f',
    };
    const panel = render(palette) as ReactElement<{
      addTab: (made: unknown, tabId: string) => Promise<void>;
    }>;
    void panel.props.addTab({ name: 'x' }, 'n');
    expect(connectedTabs.addConnectedTab).toHaveBeenCalledWith({ name: 'x' }, 'n', 't2');
    state.ctx = editor({ tabs: [{ id: 't2' }] });
    const only = renderHook(() => useConnectStart()).result.current!(palette) as ReactElement<{
      addTab: (made: unknown, tabId: string) => Promise<void>;
    }>;
    void only.props.addTab({ name: 'x' }, 'n');
    expect(connectedTabs.addConnectedTab).toHaveBeenLastCalledWith({ name: 'x' }, 'n', undefined);
    state.ctx = editor({ isStructureReadOnly: true });
    expect(renderHook(() => useConnectStart()).result.current).toBeUndefined();
  });
});
