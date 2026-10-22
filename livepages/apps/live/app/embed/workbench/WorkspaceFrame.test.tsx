// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useSyncExternalStore, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PageToWorkbenchMessage, WorkbenchToPageMessage } from '@livepages/api-schema';
import {
  useWorkbenchSession,
  WorkbenchSessionContext,
  type WorkbenchSession,
} from '@/components/providers/workbench-session-context';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';

// The workspace frame (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workspace frame", "Workspace
// messages"): the Explorer on its place, a document's editor with Back, `ready` once, `place` on every move,
// `open` from the workbench, and a trashed document back to the Explorer.

// The App Router follows the History API; here the hooks read the address the same way.
const subscribe = (fn: () => void) => {
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (...args) => {
    push(...args);
    fn();
  };
  window.history.replaceState = (...args) => {
    replace(...args);
    fn();
  };
  window.addEventListener('popstate', fn);
  return () => {
    window.history.pushState = push;
    window.history.replaceState = replace;
    window.removeEventListener('popstate', fn);
  };
};
const useAddress = () =>
  useSyncExternalStore(subscribe, () => `${window.location.pathname}${window.location.search}`);
vi.mock('next/navigation', () => ({
  usePathname: () => useAddress().split('?')[0],
  useSearchParams: () => new URLSearchParams(useAddress().split('?')[1] ?? ''),
}));

type FakeExplorer = {
  selected: { kind: string; id?: string };
  loading: boolean;
  folderById: Map<string, { id: string; name: string }>;
  documentsByFolder: Map<string | null, unknown[]>;
  teamFolders: { id: string; teamId: string }[];
};
const explorer = vi.hoisted(() => {
  const state: FakeExplorer = {
    selected: { kind: 'home' },
    loading: false,
    folderById: new Map([['f1', { id: 'f1', name: 'Minigames' }]]),
    documentsByFolder: new Map([['f1', []]]),
    teamFolders: [{ id: 'tf1', teamId: 'team1' }],
  };
  return { state };
});
vi.mock('../../explorer/ExplorerContext', () => ({ useExplorer: () => explorer.state }));
vi.mock('../../explorer/ExplorerShell', () => ({
  ExplorerShell: ({ children }: { children: ReactNode }) => <div>explorer {children}</div>,
}));
vi.mock('../../explorer/ExplorerPane', () => ({ ExplorerPane: () => <p>pane</p> }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function FakeEditor({ surface }: { surface: string }) {
      const session = useWorkbenchSession();
      return (
        <div>
          <p>
            editor {surface} on {session?.documentId} by {session?.shareCode ?? 'owner'}
          </p>
          <button type="button" onClick={() => session?.frame?.back()}>
            {session?.frame?.backTitle}
          </button>
          <button type="button" onClick={() => session?.end('trashed')}>
            trash it
          </button>
          <button
            type="button"
            onClick={() =>
              session?.frame?.reportDocumentPlace({
                documentId: session.documentId!,
                documentName: 'Home screen',
                tabId: 't1',
                tabName: 'Wireframe',
                role: 'edit',
              })
            }
          >
            report
          </button>
        </div>
      );
    },
}));

const { WorkspaceFrame } = await import('./WorkspaceFrame');
const { track } = await import('@/lib/telemetry');

let listeners: ((m: WorkbenchToPageMessage) => void)[];
let send: Mock<(message: PageToWorkbenchMessage) => void>;
let port: WorkbenchPort;
let end: Mock<WorkbenchSession['end']>;

function sessionOf(): WorkbenchSession {
  return {
    scope: 'workspace',
    secret: `lvw_${'a'.repeat(43)}`,
    documentId: null,
    tabId: null,
    shareCode: null,
    origin: 'https://127.0.0.1:5175',
    level: 'edit',
    expiresAt: Date.now() + 60_000,
    person: { id: 'user_1', name: 'Webber', color: '#0ea5e9', pictureUrl: null },
    workbenchName: 'Acme Editor',
    port,
    ended: null,
    end,
    frame: null,
  };
}

const mount = () =>
  render(
    <WorkbenchSessionContext.Provider value={sessionOf()}>
      <WorkspaceFrame />
    </WorkbenchSessionContext.Provider>,
  );

const sent = (type: string): PageToWorkbenchMessage[] =>
  send.mock.calls.map(([m]) => m).filter((m) => m.type === type);

beforeEach(() => {
  window.history.replaceState(null, '', '/embed/workbench/explorer');
  listeners = [];
  send = vi.fn<(message: PageToWorkbenchMessage) => void>();
  port = {
    origin: 'https://127.0.0.1:5175',
    send,
    subscribe: (l: (m: WorkbenchToPageMessage) => void) => {
      listeners.push(l);
      return () => {};
    },
    close: () => {},
  };
  end = vi.fn<WorkbenchSession['end']>();
  explorer.state.selected = { kind: 'home' };
  explorer.state.loading = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkspaceFrame', () => {
  it('shows the Explorer, says it is ready once, then where it is, and counts the mount', () => {
    mount();

    expect(screen.getByText(/explorer/)).toBeTruthy();
    expect(send.mock.calls[0]![0]).toEqual({
      type: 'livepages:ready',
      v: 1,
      scope: 'workspace',
      role: 'edit',
    });
    expect(sent('livepages:place')).toEqual([
      {
        type: 'livepages:place',
        v: 1,
        view: 'home',
        folderId: null,
        folderName: null,
        documentCount: null,
        documentId: null,
        documentName: null,
        tabId: null,
        tabName: null,
        role: 'edit',
      },
    ]);
    expect(track).toHaveBeenCalledWith('Session', 'Opened', 'WorkbenchWorkspace');
  });

  it('names the folder shown and its own documents, once the lists are in', () => {
    explorer.state.selected = { kind: 'folder', id: 'f1' };
    explorer.state.loading = true;
    const { rerender } = mount();
    expect(sent('livepages:place')).toEqual([]);

    explorer.state.loading = false;
    rerender(
      <WorkbenchSessionContext.Provider value={sessionOf()}>
        <WorkspaceFrame />
      </WorkbenchSessionContext.Provider>,
    );

    expect(sent('livepages:place')).toMatchObject([
      { view: 'folder', folderId: 'f1', folderName: 'Minigames', documentCount: 0 },
    ]);
  });

  it('opens a document the workbench asks for in the frame, with Back to where it was', () => {
    mount();

    act(() =>
      listeners.forEach((l) => l({ type: 'livepages:open', v: 1, to: { documentId: 'doc-1' } })),
    );

    expect(window.location.pathname).toBe('/embed/workbench/document/doc-1');
    expect(screen.getByText('editor workbench on doc-1 by owner')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.queryByText(/explorer/)).toBeNull();
  });

  it('tells the workbench the open document, and returns to the Explorer when it is trashed', () => {
    window.history.replaceState(null, '', '/embed/workbench/document/doc-2?s=CODE2345');
    mount();
    expect(screen.getByText('editor workbench on doc-2 by CODE2345')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'report' }));
    expect(sent('livepages:place').at(-1)).toEqual({
      type: 'livepages:place',
      v: 1,
      view: 'document',
      folderId: null,
      folderName: null,
      documentCount: null,
      documentId: 'doc-2',
      documentName: 'Home screen',
      tabId: 't1',
      tabName: 'Wireframe',
      role: 'edit',
    });

    fireEvent.click(screen.getByRole('button', { name: 'trash it' }));
    expect(end).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/embed/workbench/explorer');
  });

  it('moves to Home or a folder the workbench asks for', () => {
    mount();

    act(() =>
      listeners.forEach((l) => l({ type: 'livepages:open', v: 1, to: { folderId: 'f1' } })),
    );
    expect(window.location.pathname).toBe('/embed/workbench/explorer/folder/f1');

    act(() =>
      listeners.forEach((l) => l({ type: 'livepages:open', v: 1, to: { view: 'home' } })),
    );
    expect(window.location.pathname).toBe('/embed/workbench/explorer');
  });

  it('moves a frame started on a team’s folder to that team’s page, in place', () => {
    window.history.replaceState(null, '', '/embed/workbench/explorer/folder/tf1');
    explorer.state.selected = { kind: 'folder', id: 'tf1' };
    mount();

    expect(`${window.location.pathname}${window.location.search}`).toBe(
      '/embed/workbench/explorer/team?id=team1&folder=tf1',
    );
    expect(sent('livepages:place').filter((m) => 'view' in m && m.view === 'folder')).toEqual([]);
  });
});
