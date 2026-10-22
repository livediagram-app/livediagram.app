// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkbenchDocumentSessionResponse } from '@livedocuments/api-schema';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';
import { workbenchTransition, type WorkbenchPhase } from './workbench-machine';

// The workbench page (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench page",
// "Presentation and UX"): a status screen with its copy until the workbench answers, then the editor
// signed in as the session's person; `ended` told to the workbench once; a refused session ends it.

const harness = vi.hoisted(() => ({
  initial: { phase: 'reading' } as unknown,
  port: null as unknown,
  dispatch: null as unknown,
  // Each dynamic chunk's loading screen, by what it loads: the editor, or the workspace frame.
  loadings: {} as Record<'editor' | 'frame', () => unknown>,
  pathname: '/embed/workbench',
}));
vi.mock('next/navigation', () => ({ usePathname: () => harness.pathname }));
vi.mock('./useWorkbenchHandshake', () => ({
  useWorkbenchHandshake: () => {
    const [phase, dispatch] = useReducer(workbenchTransition, harness.initial as WorkbenchPhase);
    harness.dispatch = dispatch;
    return { phase, port: harness.port, dispatch };
  },
}));
vi.mock('./useWorkbenchRenewal', () => ({ useWorkbenchRenewal: () => {} }));
vi.mock('next/dynamic', () => ({
  default: (_load: unknown, options: { loading?: () => unknown } = {}) => {
    if (!options.loading) return () => null;
    // The frame's loading screen speaks of the workspace; the editor's does not.
    const loading = options.loading() as { props?: { scope?: string } };
    const frame = loading.props?.scope === 'workspace';
    harness.loadings[frame ? 'frame' : 'editor'] = options.loading;
    if (frame)
      return function FakeFrame() {
        const session = useWorkbenchSession();
        return (
          <p>
            workspace frame as {session?.person.name} in {session?.scope}
          </p>
        );
      };
    return function FakeEditor({ surface }: { surface: string }) {
      const session = useWorkbenchSession();
      return (
        <button type="button" onClick={() => session?.end('trashed')}>
          editor {surface} as {session?.person.name} ended {String(session?.ended)}
        </button>
      );
    };
  },
}));
vi.mock('@/components/chrome/LoadErrorCard', () => ({
  LoadErrorCard: ({ embed }: { embed: boolean }) => <p>load error {String(embed)}</p>,
}));

const { WorkbenchPage } = await import('./WorkbenchPage');
const { default: Page, metadata } = await import('./page');
const core = await import('@/lib/api/core');

const SESSION: WorkbenchDocumentSessionResponse = {
  session: `lvw_${'a'.repeat(43)}`,
  scope: 'document',
  documentId: 'doc-1',
  folderId: null,
  tabId: null,
  origin: 'https://127.0.0.1:5175',
  role: 'edit',
  expiresAt: Date.now() + 60_000,
  person: { id: 'user_1', name: 'Webber', color: '#0ea5e9', pictureUrl: null },
};

function fakePort(): WorkbenchPort {
  return {
    origin: SESSION.origin,
    send: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    close: vi.fn(),
  };
}

beforeEach(() => {
  harness.port = null;
  harness.pathname = '/embed/workbench';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  core.setTokenProvider(null);
  core.setWorkbenchConfinement(null);
  vi.restoreAllMocks();
});

describe('WorkbenchPage', () => {
  it.each([
    { phase: 'reading' },
    { phase: 'redeeming', ticket: 't', documentId: 'doc-1' },
    { phase: 'binding', session: SESSION },
  ] as WorkbenchPhase[])('says it is opening while $phase', (phase) => {
    harness.initial = phase;
    render(<WorkbenchPage />);
    expect(screen.getByRole('status').textContent).toBe('Opening your diagram…');
  });

  it('refuses with its heading and the way back', () => {
    harness.initial = { phase: 'refused', cause: 'no-ticket' };
    render(<WorkbenchPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Open this diagram from your workbench',
    );
    expect(screen.getByRole('status').textContent).toContain(
      'This link works once, for a minute. Open the diagram again from your workbench.',
    );
  });

  it('names the only origin it opens inside', () => {
    harness.initial = { phase: 'unbound', origin: SESSION.origin };
    render(<WorkbenchPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      `This view opens only inside ${SESSION.origin}.`,
    );
  });

  it('shows the embed load error when the api could not be reached', () => {
    harness.initial = { phase: 'failed' };
    render(<WorkbenchPage />);
    expect(screen.getByText('load error true')).toBeTruthy();
  });

  it('is still opening in the moment between the ack and its port', () => {
    harness.initial = { phase: 'mounted', session: SESSION, name: 'Acme Editor' };
    render(<WorkbenchPage />);
    expect(screen.getByRole('status').textContent).toBe('Opening your diagram…');
  });

  it('mounts the editor on the workbench surface, signed in as the person', () => {
    harness.initial = { phase: 'mounted', session: SESSION, name: 'Acme Editor' };
    harness.port = fakePort();
    render(<WorkbenchPage />);
    expect(screen.getByText('editor workbench as Webber ended null')).toBeTruthy();
  });

  it('shows the opening copy while the editor chunk loads', () => {
    render(<>{harness.loadings.editor() as never}</>);
    expect(screen.getByRole('status').textContent).toBe('Opening your diagram…');
  });

  it('is the static route, unindexed, titled for a workbench', () => {
    harness.initial = { phase: 'reading' };
    render(<Page />);
    expect(screen.getByRole('status').textContent).toBe('Opening your diagram…');
    expect(metadata).toEqual({ title: 'Workbench | livedocuments', robots: { index: false } });
  });

  it('ends the page when the editor finds the document trashed', () => {
    harness.initial = { phase: 'mounted', session: SESSION, name: 'Acme Editor' };
    harness.port = fakePort();
    render(<WorkbenchPage />);

    act(() => screen.getByRole('button').click());

    expect(screen.getByText('editor workbench as Webber ended trashed')).toBeTruthy();
  });

  it('tells the workbench why the page ended, once', () => {
    harness.initial = { phase: 'mounted', session: SESSION, name: 'Acme Editor' };
    const port = fakePort();
    harness.port = port;
    const { rerender } = render(<WorkbenchPage />);

    act(() => (harness.dispatch as (e: unknown) => void)({ type: 'ended', reason: 'revoked' }));
    rerender(<WorkbenchPage />);

    expect(port.send).toHaveBeenCalledTimes(1);
    expect(port.send).toHaveBeenCalledWith({ type: 'livedocuments:ended', v: 1, reason: 'revoked' });
    expect(screen.getByText('editor workbench as Webber ended revoked')).toBeTruthy();
  });

  it('ends the page when the api refuses the session, as revoked before its expiry', async () => {
    harness.initial = { phase: 'mounted', session: SESSION, name: 'Acme Editor' };
    harness.port = fakePort();
    render(<WorkbenchPage />);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'invalid_session' }, { status: 401 })),
    );

    await act(async () => {
      await core.apiFetch('/api/documents/doc-1', {
        headers: { Authorization: `Bearer ${SESSION.session}` },
      });
    });

    expect(screen.getByText('editor workbench as Webber ended revoked')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('ignores a refused session before the page is mounted', async () => {
    harness.initial = { phase: 'binding', session: SESSION };
    render(<WorkbenchPage />);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'invalid_session' }, { status: 401 })),
    );

    await act(async () => {
      await core.apiFetch('/api/documents/doc-1', {
        headers: { Authorization: `Bearer ${SESSION.session}` },
      });
    });

    expect(screen.getByRole('status').textContent).toBe('Opening your diagram…');
    vi.unstubAllGlobals();
  });
});

describe('WorkbenchPage, workspace scope', () => {
  const WORKSPACE = {
    ...SESSION,
    scope: 'workspace' as const,
    documentId: null,
    folderId: null,
    tabId: null,
  };

  it('speaks of the workspace while it opens, and when it refuses', () => {
    harness.pathname = '/embed/workbench/explorer';
    harness.initial = { phase: 'reading' };
    const { unmount } = render(<WorkbenchPage />);
    expect(screen.getByRole('status').textContent).toBe('Opening your workspace…');
    unmount();

    harness.initial = { phase: 'refused', cause: 'no-ticket' };
    render(<WorkbenchPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Open your workspace from your workbench',
    );
    expect(screen.getByRole('status').textContent).toContain(
      'This link works once, for a minute. Open it again from your workbench.',
    );
  });

  it('mounts the workspace frame, signed in as the person, confined to the workspace', () => {
    harness.pathname = '/embed/workbench/explorer/folder/f1';
    harness.initial = { phase: 'mounted', session: WORKSPACE, name: 'Acme Editor' };
    harness.port = fakePort();
    render(<WorkbenchPage />);

    expect(screen.getByText('workspace frame as Webber in workspace')).toBeTruthy();
    expect(core.getWorkbenchConfinement()).toEqual({
      scope: 'workspace',
      documentId: null,
      ownerId: 'user_1',
    });
  });

  it('shows the workspace opening copy while the frame chunk loads', () => {
    render(<>{harness.loadings.frame() as never}</>);
    expect(screen.getByRole('status').textContent).toBe('Opening your workspace…');
  });
});
