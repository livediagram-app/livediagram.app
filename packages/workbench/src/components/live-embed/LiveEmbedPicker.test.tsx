// @vitest-environment jsdom

// Embed File (live-embeds.md "Making one"): connected files first, then Recent with the host left out, a pasted
// share link resolved and its code dropped, and the choice handed back with its snapshot. Where the session may
// connect, the role first, and a file the person may share connected one way at it before it is embedded (Work
// Tracker 1375).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type Item } from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { LiveEmbedPicker, embedConnects, type LiveEmbedConnect } from './LiveEmbedPicker';

const item = (
  id: string,
  title: string,
  app = 'liveplanner',
  access = 'view',
  sharedVia?: string,
) => ({ id, app, title, updatedAt: 0, lastOpenedAt: 0, access, sharedVia }) as unknown as Item;

let recent: Item[];
let client: {
  listItems: ReturnType<typeof vi.fn>;
  getItem: ReturnType<typeof vi.fn>;
  resolveShare: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  recent = [
    item('doc1', 'This document', 'livedocuments'),
    item('p1', 'Roadmap'),
    item('d1', 'Architecture', 'livediagram'),
  ];
  client = {
    listItems: vi.fn(async () => ({ items: recent, next: null })),
    getItem: vi.fn(async (id: string) => {
      if (id === 'gone') throw new IndexError(404, 'not_found');
      return { item: item(id, id === 'd1' ? 'Architecture' : 'Connected plan') };
    }),
    resolveShare: vi.fn(async () => ({
      item: item('s1', 'Shared design', 'livedesign'),
      level: 'view',
      tabId: null,
    })),
  };
  // No one to ask as: the snapshot has no picture, which the choice leaves out.
  configureWorkbench(WORKBENCH_DEFAULTS);
});

afterEach(() => {
  configureWorkbench(WORKBENCH_DEFAULTS);
});

function open(connectedIds: string[] = [], connect?: LiveEmbedConnect) {
  const onChoose = vi.fn();
  const onClose = vi.fn();
  render(
    <LiveEmbedPicker
      client={client as never}
      hostId="doc1"
      connectedIds={connectedIds}
      connect={connect}
      now={0}
      onChoose={onChoose}
      onClose={onClose}
    />,
  );
  return { onChoose, onClose };
}

describe('Embed File', () => {
  it('is titled Embed File and asks no role where the session cannot connect', async () => {
    open();
    expect(screen.getByRole('heading', { name: 'Embed File' })).toBeTruthy();
    await screen.findByText('Roadmap');
    expect(screen.queryByText('Role')).toBeNull();
    // With no tab to make, no row says it gets none.
    expect(screen.queryByText(/Embeds with no tab/)).toBeNull();
  });

  it('lists connected files first, then Recent without them or the host', async () => {
    open(['d1', 'gone']);
    const connected = await screen.findByRole('list', { name: 'Connected files' });
    expect(connected.textContent).toContain('Architecture');
    const recentList = await screen.findByRole('list', { name: 'Recent files' });
    expect(recentList.textContent).toContain('Roadmap');
    expect(recentList.textContent).not.toContain('Architecture');
    expect(recentList.textContent).not.toContain('This document');
  });

  it('lists a knowledgebase (Work Tracker 1375) and leaves out a huddle, which serves no frame', async () => {
    recent = [
      ...recent,
      item('k1', 'Team Handbook', 'liveknowledge'),
      item('h1', 'Standup', 'livehuddle'),
    ];
    open();
    const recentList = await screen.findByRole('list', { name: 'Recent files' });
    expect(recentList.textContent).toContain('Team Handbook');
    expect(recentList.textContent).not.toContain('Standup');
  });

  it('chooses a file with one press and closes', async () => {
    const { onChoose, onClose } = open();
    fireEvent.click(await screen.findByText('Roadmap'));
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(onChoose).toHaveBeenCalledWith({
      liveItem: { app: 'liveplanner', itemId: 'p1' },
      liveName: 'Roadmap',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('says on the row when a choice fails, and stays open', async () => {
    const { onChoose, onClose } = open();
    onChoose.mockImplementationOnce(() => {
      throw new Error('commit failed');
    });
    fireEvent.click(await screen.findByText('Roadmap'));
    expect(await screen.findByText('That file could not be added. Try again.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('finds files by name', async () => {
    open();
    await screen.findByText('Roadmap');
    fireEvent.change(screen.getByLabelText('Find a file'), { target: { value: 'arch' } });
    expect(screen.queryByText('Roadmap')).toBeNull();
    expect(screen.getByText('Architecture')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Find a file'), { target: { value: 'zzz' } });
    expect(screen.getByText('No recent file matches “zzz”')).toBeTruthy();
  });

  it('resolves a pasted share link and chooses its file, the code going nowhere', async () => {
    const { onChoose } = open();
    const field = screen.getByLabelText('Share link');
    fireEvent.change(field, {
      target: { value: 'https://www.livedesign.app/design/shared?s=secretcode' },
    });
    fireEvent.click(screen.getByText('Add'));
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(client.resolveShare).toHaveBeenCalledWith('secretcode');
    expect(JSON.stringify(onChoose.mock.calls)).not.toContain('secretcode');
    expect(onChoose.mock.calls[0]![0]).toMatchObject({
      liveItem: { app: 'livedesign', itemId: 's1' },
    });
  });

  it('says why a pasted link cannot be used', async () => {
    open();
    const field = screen.getByLabelText('Share link');
    fireEvent.change(field, { target: { value: 'https://example.com' } });
    fireEvent.submit(field.closest('form')!);
    expect(await screen.findByText(/Paste a share link from/)).toBeTruthy();
    client.resolveShare.mockResolvedValueOnce({
      item: item('doc1', 'Me', 'livedocuments'),
      level: 'view',
      tabId: null,
    });
    fireEvent.change(field, {
      target: { value: 'https://www.livedocuments.app/document/shared?s=self' },
    });
    fireEvent.submit(field.closest('form')!);
    expect(await screen.findByText('This is the file you are in.', { selector: 'p' })).toBeTruthy();
  });

  it('offers Try Again when Recent does not load, and says when there is nothing', async () => {
    client.listItems.mockRejectedValueOnce(new Error('offline'));
    open();
    fireEvent.click(await screen.findByText('Try Again'));
    expect(await screen.findByText('Roadmap')).toBeTruthy();
  });

  it('says when there are no recent files', async () => {
    recent = [];
    open();
    expect(await screen.findByText('No recent files yet')).toBeTruthy();
  });
});

describe("Embed File's role", () => {
  const made = { connection: { id: 'c1', app: 'liveplanner', itemId: 'p1' }, name: 'Roadmap' };
  let connectClient: {
    makeConnection: ReturnType<typeof vi.fn>;
    takeBackConnection: ReturnType<typeof vi.fn>;
  };
  let addTab: ReturnType<typeof vi.fn>;
  const connectOf = (connected: [string, string][] = []): LiveEmbedConnect => ({
    hostKind: 'canvas',
    connected: new Map(connected),
    grant: async () => 'grant-1',
    newTabId: () => 'tab-new',
    addTab: addTab as never,
    client: connectClient as never,
  });

  beforeEach(() => {
    connectClient = {
      makeConnection: vi.fn(async () => made),
      takeBackConnection: vi.fn(async () => undefined),
    };
    addTab = vi.fn(async () => undefined);
    // Roadmap is the person's own (they may share it); Architecture reached through a link.
    recent = [
      item('p1', 'Roadmap', 'liveplanner', 'edit'),
      item('d1', 'Architecture', 'livediagram', 'edit', 'share'),
    ];
  });

  it('asks the role first, Editor chosen, and says what it means', async () => {
    open([], connectOf());
    expect(screen.getByText('Role')).toBeTruthy();
    const editor = screen.getByRole('radio', { name: 'Editor' });
    expect(editor.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByText(
        'Anyone who can open this canvas can edit the file you embed, through its tab. The embed itself is read-only.',
      ),
    ).toBeTruthy();
  });

  it('connects a file the person may share at the chosen role, then embeds it', async () => {
    const { onChoose, onClose } = open([], connectOf());
    fireEvent.click(screen.getByRole('radio', { name: 'Viewer' }));
    fireEvent.click(await screen.findByText('Roadmap'));
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(connectClient.makeConnection).toHaveBeenCalledWith(
      'doc1',
      { targetId: 'p1', tabId: 'tab-new', level: 'view', both: false },
      'grant-1',
    );
    expect(addTab).toHaveBeenCalledWith(made, 'tab-new');
    expect(onChoose.mock.calls[0]![0]).toMatchObject({
      liveItem: { app: 'liveplanner', itemId: 'p1' },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('embeds a file the person may not share with no tab, saying so on its row', async () => {
    const { onChoose } = open([], connectOf());
    const row = (await screen.findByText('Architecture')).closest('button')!;
    expect(row.textContent).toContain('Embeds with no tab');
    fireEvent.click(row);
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(connectClient.makeConnection).not.toHaveBeenCalled();
  });

  it('embeds a file already connected without a second connection', async () => {
    const { onChoose } = open(['p1'], connectOf([['p1', 'tab-p1']]));
    fireEvent.click(await screen.findByText('Connected plan'));
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(connectClient.makeConnection).not.toHaveBeenCalled();
  });

  it('says why on the row when connecting fails, and embeds nothing', async () => {
    connectClient.makeConnection.mockRejectedValueOnce(new IndexError(409, 'connection_limit'));
    const { onChoose, onClose } = open([], connectOf());
    fireEvent.click(await screen.findByText('Roadmap'));
    await waitFor(() => expect(connectClient.makeConnection).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(onChoose).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says the index is out of reach when no grant is held', async () => {
    const { onChoose } = open([], { ...connectOf(), grant: async () => null });
    fireEvent.click(await screen.findByText('Roadmap'));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(onChoose).not.toHaveBeenCalled();
    expect(connectClient.makeConnection).not.toHaveBeenCalled();
  });

  it('connects only what the person may share, not yet connected, at a role its app offers', () => {
    const mine = { id: 'p1', app: 'liveplanner', access: 'edit' } as unknown as Item;
    const linked = { ...mine, sharedVia: 'share' } as unknown as Item;
    expect(embedConnects(mine, undefined, 'edit')).toBe(false);
    expect(embedConnects(mine, { connected: new Map() }, 'edit')).toBe(true);
    expect(embedConnects(mine, { connected: new Map([['p1', 't']]) }, 'edit')).toBe(false);
    expect(embedConnects(linked, { connected: new Map() }, 'edit')).toBe(false);
  });
});
