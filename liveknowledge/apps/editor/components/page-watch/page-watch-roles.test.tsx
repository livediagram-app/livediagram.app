// @vitest-environment jsdom
// docs/specs/030-knowledgebase/watching.md "Where it shows" and "Share roles", as the editor draws them: every
// signed-in reader (an Editor, a Participant, a Viewer) watches and unwatches from the page's menu in the tree and
// from the rail; a guest is offered neither; a section offers Watch This Section; a page under a watched section reads
// "Watching Through". The api's half is apps/api/src/routes/knowledge-watch-routes.test.ts.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel, PageWatchResponse } from '@liveknowledge/api-schema';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { knowledgeRights } from '@/lib/knowledge/knowledge-rights';
import { trustMarks } from '@/lib/knowledge/page-trust';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

const chrome = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const api = vi.hoisted(() => ({
  read: vi.fn(),
  set: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const tracked = vi.hoisted(() => vi.fn());

vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorChrome: (pick: (s: unknown) => unknown) => pick(chrome.state),
  useEditorChromeStore: () => ({ get: () => chrome.state }),
}));
vi.mock('@/lib/api/page-feedback', () => ({ apiPageWatch: api.read, apiSetPageWatch: api.set }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/telemetry', () => ({ track: tracked }));

const { PageTree } = await import('@/components/page-tree/PageTree');
const { PageWatchMenuRows } = await import('./PageWatchMenuRows');
const { PageWatchButton, PageWatchControl } = await import('./PageWatchButton');

const TABS = [
  { id: 'a', name: 'Handbook' },
  { id: 'b', name: 'Release Process', parent: 'a' },
  { id: 'c', name: 'Notes' },
];
const WATCH: Record<string, PageWatchResponse> = {
  a: { watching: null, through: null, watchers: 0, section: true },
  b: { watching: null, through: null, watchers: 0, section: false },
  c: { watching: null, through: null, watchers: 0, section: false },
};

let doc = 0;
function as(level: AccessLevel | 'guest') {
  doc += 1;
  const signedIn = level !== 'guest';
  chrome.state = {
    documentId: `kb-${doc}`,
    activeId: 'a',
    activeTab: TABS[0],
    tabs: TABS,
    selfParticipant: { id: signedIn ? 'user_1' : 'guest_1', name: 'Ada' },
    accountUserId: signedIn ? 'user_1' : null,
    workbench: null,
    sessionShareCode: null,
  };
}

function tree(level: AccessLevel) {
  const can = resolveEditorCapabilities(level);
  const rights = knowledgeRights({ can, isStructureReadOnly: level === 'view', offline: false });
  render(
    <PageTree
      tabs={TABS}
      activeId="a"
      closed={new Set()}
      onSetOpen={vi.fn()}
      canEdit={can.editPages}
      actions={{
        onSelect: vi.fn(),
        onRename: vi.fn(),
        onAdd: vi.fn(),
        onDuplicate: vi.fn(),
        onDelete: vi.fn(),
        onMove: vi.fn(),
        onStep: vi.fn(),
        onIndent: vi.fn(),
        onOutdent: vi.fn(),
        onCopyLink: vi.fn(),
      }}
      knowledge={{
        marks: trustMarks(TABS, 90, 0),
        inContext: new Set(),
        canVerify: rights.verify,
        canEditFields: rights.editFields,
        onVerify: vi.fn(),
        onSetContext: vi.fn(),
        watchRows: (id, onClose, separated) => (
          <PageWatchMenuRows id={id} onClose={onClose} separated={separated} />
        ),
      }}
    />,
  );
}

const row = (name: string) => screen.getByRole('treeitem', { name });
const openMenu = (name: string) => {
  fireEvent.pointerOver(row(name));
  fireEvent.click(within(row(name)).getByRole('button', { name: `Page Options for ${name}` }));
};
const item = (name: string) => screen.queryByRole('menuitem', { name });

beforeEach(() => {
  api.read.mockImplementation(async (_who: unknown, _doc: string, tab: string) => WATCH[tab]);
  api.set.mockImplementation(
    async (_who: unknown, _doc: string, tab: string, scope: PageWatchResponse['watching']) => ({
      ...WATCH[tab]!,
      watching: scope,
      watchers: scope ? 1 : 0,
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Watch in the page’s menu', () => {
  it.each(['edit', 'participate', 'view'] as const)('is offered to %s', async (level) => {
    as(level);
    tree(level);
    openMenu('Handbook');
    await waitFor(() => expect(item('Watch')?.getAttribute('aria-disabled')).toBeNull());
    expect(item('Watch This Section')).not.toBeNull();
    fireEvent.click(item('Watch This Section')!);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Watching Handbook. You'll hear when it changes."),
    );
    expect(api.set).toHaveBeenCalledWith(
      expect.anything(),
      chrome.state.documentId,
      'a',
      'section',
    );
    expect(tracked).toHaveBeenCalledWith('UI', 'Toggled', 'WatchSectionOn');
    // A page alone has no section to watch.
    openMenu('Notes');
    await waitFor(() => expect(item('Watch')?.getAttribute('aria-disabled')).toBeNull());
    expect(item('Watch This Section')).toBeNull();
  });

  it('is never offered to a guest', async () => {
    as('guest');
    tree('view');
    openMenu('Handbook');
    expect(item('Watch')).toBeNull();
    expect(api.read).not.toHaveBeenCalled();
  });

  it('offers Unwatch to a watcher, and a greyed Watching Through under a watched section', async () => {
    as('view');
    api.read.mockImplementation(async (_w: unknown, _d: string, tab: string) =>
      tab === 'a'
        ? { ...WATCH.a, watching: 'section', watchers: 1 }
        : { ...WATCH.b, through: { tab: 'a', name: 'Handbook' }, watchers: 1 },
    );
    tree('view');
    openMenu('Handbook');
    await waitFor(() => expect(item('Unwatch This Section')).not.toBeNull());
    fireEvent.click(item('Unwatch This Section')!);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Stopped watching Handbook.'));
    expect(tracked).toHaveBeenCalledWith('UI', 'Toggled', 'WatchSectionOff');
    openMenu('Release Process');
    await waitFor(() => expect(item('Watching Through Handbook')).not.toBeNull());
    expect(item('Watching Through Handbook')?.getAttribute('aria-disabled')).not.toBeNull();
    expect(item('Unwatch')).toBeNull();
  });

  it('puts a refused press back with its words', async () => {
    as('edit');
    api.set.mockRejectedValueOnce(new ApiError('watch page', 409, 'watchers_full'));
    tree('edit');
    openMenu('Notes');
    await waitFor(() => expect(item('Watch')?.getAttribute('aria-disabled')).toBeNull());
    fireEvent.click(item('Watch')!);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'This knowledgebase holds as many watches as it can (2,000).',
      ),
    );
  });
});

describe('Watch in the rail', () => {
  it('toggles a page alone, and counts who watches', async () => {
    as('view');
    chrome.state = { ...chrome.state, activeId: 'c', activeTab: TABS[2] };
    api.read.mockResolvedValueOnce({ ...WATCH.c, watchers: 3 });
    render(<PageWatchButton />);
    const button = await screen.findByRole('button', { name: 'Watch Notes' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText('3 watching')).toBeTruthy();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    const pressed = await screen.findByRole('button', { name: 'Watching Notes' });
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
    expect(tracked).toHaveBeenCalledWith('UI', 'Toggled', 'WatchPageOn');
  });

  it('opens a menu on a section, and is hidden for a guest', async () => {
    const onSet = vi.fn();
    render(<PageWatchControl watch={WATCH.a!} ready pageName="Handbook" onSet={onSet} />);
    const button = screen.getByRole('button', { name: 'Watch Handbook' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.queryByText(/watching$/)).toBeNull();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Watch This Section' }));
    expect(onSet).toHaveBeenCalledWith('section');
    cleanup();
    render(
      <PageWatchControl
        watch={{ ...WATCH.b!, through: { tab: 'a', name: ' ' }, watchers: 1 }}
        ready
        pageName=""
        onSet={onSet}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Watching Untitled Page' }));
    expect(screen.getByRole('menuitem', { name: 'Watching Through Untitled Page' })).toBeTruthy();
    cleanup();
    as('guest');
    const { container } = render(<PageWatchButton />);
    expect(container.innerHTML).toBe('');
  });
});
