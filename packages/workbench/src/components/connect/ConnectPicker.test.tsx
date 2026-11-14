// @vitest-environment jsdom

// Connect File (connected-tabs.md "Connecting", "How it looks"): Recent across every app, the host left
// out; the role, Editor first; both ways; Find a file; one press connects, one at a time; blocked rows say why; a
// failure says why on its row; a connected row goes to its tab; loading, empty and failed lists.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type Item } from '@liveworkspace/index-client';
import { ConnectPicker, type ConnectInk } from './ConnectPicker';
import { CONNECT_RECENT_LIMIT } from './useRecentFiles';

afterEach(cleanup);

const NOW = Date.UTC(2026, 10, 7, 12);
const item = (id: string, title: string, over: Partial<Item> = {}): Item => ({
  id,
  app: 'liveplanner',
  kind: 'plan',
  title,
  ownerId: 'me',
  teamId: null,
  folderId: null,
  source: null,
  intent: null,
  createdAt: NOW - 10 * 86_400_000,
  updatedAt: NOW - 86_400_000,
  trashedAt: null,
  trashReason: null,
  summary: {},
  access: 'edit',
  favourite: false,
  lastOpenedAt: NOW - 2 * 3_600_000,
  sharedVia: null,
  ...over,
});

const ITEMS = [
  item('host', 'This diagram', { app: 'livediagram' }),
  item('plan1', 'Launch plan'),
  item('doc1', 'Brief', { app: 'livedocuments', lastOpenedAt: null }),
  item('space1', 'Team space', { app: 'livehuddle' }),
  item('shared1', 'Their roadmap', { access: 'edit', sharedVia: 'code' }),
];

type Props = Partial<Parameters<typeof ConnectPicker>[0]>;
function setup(over: Props & { list?: () => Promise<{ items: Item[] }> } = {}) {
  const listItems = vi.fn(over.list ?? (async () => ({ items: ITEMS, nextCursor: null })));
  const onConnect = over.onConnect ?? vi.fn(async () => {});
  const onGoTo = over.onGoTo ?? vi.fn();
  const view = render(
    <ConnectPicker
      client={{ listItems } as never}
      hostId="host"
      hostKind="diagram"
      hostManaged
      connected={new Map()}
      now={NOW}
      onConnect={onConnect}
      onGoTo={onGoTo}
      {...over}
    />,
  );
  return { listItems, onConnect, onGoTo, ...view };
}
const row = (id: string) =>
  document.querySelector(`[data-connect-row="${id}"]`) as HTMLButtonElement;

describe('ConnectPicker', () => {
  it('lists Recent across every app, newest first, the host left out', async () => {
    const { listItems } = setup();
    expect(screen.getByRole('list', { name: 'Loading recent files' })).toBeTruthy();
    await screen.findByRole('list', { name: 'Recent files' });
    expect(listItems).toHaveBeenCalledWith(
      { view: 'recent', limit: CONNECT_RECENT_LIMIT },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(row('host')).toBeNull();
    expect(row('plan1').textContent).toContain('Launch plan');
    expect(row('plan1').textContent).toContain('liveplanner · Opened 2 hours ago');
    // No open yet: when it last changed.
    expect(row('doc1').textContent).toContain('livedocuments · Opened yesterday');
  });

  it('starts at Editor and says what that means', async () => {
    setup();
    await screen.findByRole('list', { name: 'Recent files' });
    expect(screen.getByRole('radio', { name: 'Editor' }).getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByText('Anyone who can open this diagram can edit the file you connect.'),
    ).toBeTruthy();
  });

  it('walks the roles with the arrows and blocks an app that lacks the role', async () => {
    setup();
    await screen.findByRole('list', { name: 'Recent files' });
    const editor = screen.getByRole('radio', { name: 'Editor' });
    fireEvent.keyDown(editor, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Participant' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.keyDown(editor, { key: 'End' });
    expect(screen.getByRole('radio', { name: 'Viewer' }).getAttribute('aria-checked')).toBe('true');
    expect(row('space1').getAttribute('aria-disabled')).toBe('true');
    expect(row('space1').textContent).toContain('livehuddle has no Viewer role');
    fireEvent.keyDown(editor, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Editor' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(editor, { key: 'ArrowLeft' });
    fireEvent.keyDown(editor, { key: 'Home' });
    fireEvent.keyDown(editor, { key: 'a' });
    fireEvent.click(screen.getByRole('radio', { name: 'Participant' }));
    expect(screen.getByText(/can take part in the file you connect/)).toBeTruthy();
    expect(row('space1').hasAttribute('aria-disabled')).toBe(false);
  });

  it('dims a file the person may not share, saying why, and ignores a press on it', async () => {
    const { onConnect } = setup();
    await screen.findByRole('list', { name: 'Recent files' });
    expect(row('shared1').textContent).toContain('Only its owner can share it');
    fireEvent.click(row('shared1'));
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('connects a file with one press, at the role and both ways chosen', async () => {
    const { onConnect } = setup();
    await screen.findByRole('list', { name: 'Recent files' });
    fireEvent.click(screen.getByRole('radio', { name: 'Participant' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Add connection to both files' }));
    fireEvent.click(row('plan1'));
    await waitFor(() => expect(onConnect).toHaveBeenCalledTimes(1));
    expect(onConnect).toHaveBeenCalledWith(ITEMS[1], { level: 'participate', both: true });
  });

  it('holds both ways off, and says why, when the host is not the person’s to share', async () => {
    const { onConnect } = setup({ hostManaged: false });
    await screen.findByRole('list', { name: 'Recent files' });
    const both = screen.getByRole('switch', {
      name: 'Add connection to both files',
    }) as HTMLButtonElement;
    expect(both.disabled).toBe(true);
    expect(screen.getByText("Only this diagram's owner can connect it both ways.")).toBeTruthy();
    fireEvent.click(row('plan1'));
    await waitFor(() =>
      expect(onConnect).toHaveBeenCalledWith(ITEMS[1], { level: 'edit', both: false }),
    );
  });

  it('connects one file at a time, the rest waiting', async () => {
    let finish = () => {};
    const onConnect = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    setup({ onConnect });
    await screen.findByRole('list', { name: 'Recent files' });
    fireEvent.click(row('plan1'));
    expect(row('plan1').getAttribute('aria-busy')).toBe('true');
    expect(row('plan1').textContent).toContain('Connecting');
    expect(row('doc1').getAttribute('data-connect-state')).toBe('waiting');
    fireEvent.click(row('doc1'));
    expect(onConnect).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(row('plan1').getAttribute('data-connect-state')).toBe('open');
  });

  it('says why a connect failed on its row, and clears it on the next try', async () => {
    const onConnect = vi
      .fn()
      .mockRejectedValueOnce(new IndexError(409, 'share_link_limit'))
      .mockResolvedValueOnce(undefined);
    setup({ onConnect });
    await screen.findByRole('list', { name: 'Recent files' });
    fireEvent.click(row('plan1'));
    const words = await screen.findByText(/too many links already/);
    expect(row('plan1').getAttribute('aria-describedby')).toBe(words.id);
    fireEvent.click(row('plan1'));
    await waitFor(() => expect(screen.queryByText(/too many links already/)).toBeNull());
  });

  it('marks a connected file and goes to its tab', async () => {
    const { onGoTo, onConnect } = setup({ connected: new Map([['plan1', 'tab7']]) });
    await screen.findByRole('list', { name: 'Recent files' });
    expect(row('plan1').textContent).toContain('Connected');
    fireEvent.click(row('plan1'));
    expect(onGoTo).toHaveBeenCalledWith('tab7');
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('narrows the list by name, Escape and × clearing it', async () => {
    setup();
    await screen.findByRole('list', { name: 'Recent files' });
    const find = screen.getByRole('textbox', { name: 'Find a file' });
    fireEvent.change(find, { target: { value: 'BRIEF' } });
    expect(row('doc1')).not.toBeNull();
    expect(row('plan1')).toBeNull();
    fireEvent.change(find, { target: { value: 'nothing like it' } });
    expect(screen.getAllByText('No recent file matches “nothing like it”').length).toBeGreaterThan(
      0,
    );
    fireEvent.keyDown(find, { key: 'Escape' });
    expect(row('plan1')).not.toBeNull();
    fireEvent.keyDown(find, { key: 'Escape' });
    fireEvent.change(find, { target: { value: 'plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(row('doc1')).not.toBeNull();
  });

  it('says when nothing is recent, with the way to the Explorer', async () => {
    const onOpenExplorer = vi.fn();
    setup({ list: async () => ({ items: [ITEMS[0]!] }), onOpenExplorer });
    await screen.findByText('No recent files yet');
    fireEvent.click(screen.getByRole('button', { name: 'Open Explorer' }));
    expect(onOpenExplorer).toHaveBeenCalled();
    cleanup();
    setup({ list: async () => ({ items: [] }) });
    await screen.findByText('No recent files yet');
    expect(screen.queryByRole('button', { name: 'Open Explorer' })).toBeNull();
  });

  it('says when the list failed to load, and tries again', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ items: ITEMS });
    setup({ list });
    await screen.findAllByText('Your recent files did not load');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByRole('list', { name: 'Recent files' });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('drops a load that lands after it closed', async () => {
    let land = (_: { items: Item[] }) => {};
    const { unmount } = setup({ list: () => new Promise((resolve) => (land = resolve)) });
    unmount();
    await act(async () => land({ items: ITEMS }));
    let fail = (_: unknown) => {};
    const second = setup({ list: () => new Promise((_, reject) => (fail = reject)) });
    second.unmount();
    await act(async () => fail(new Error('late')));
  });

  it('paints itself from a start panel’s ink when given one', async () => {
    const ink: ConnectInk = {
      text: '#111111',
      muted: '#555555',
      border: '#dddddd',
      surface: '#fafafa',
      column: '#f0f0f0',
      card: '#ffffff',
      accent: '#0055aa',
    };
    const { container } = setup({ ink });
    const root = container.querySelector('[data-connect-picker]') as HTMLElement;
    expect(root.style.getPropertyValue('--cp-accent')).toBe('#0055aa');
    expect(root.style.getPropertyValue('--cp-on-accent')).toBe('#ffffff');
    expect(root.className).not.toContain('[--cp-text:');
    // The both-ways switch takes the theme's colours off as on (Work Tracker 634).
    const track = () => container.querySelector('[data-switch-track]') as HTMLElement;
    expect(track().style.backgroundColor).toContain('var(--cp-muted)');
    expect(track().className).not.toContain('bg-slate-300');
    fireEvent.click(screen.getByRole('switch'));
    expect(track().style.backgroundColor).toBe('var(--cp-accent)');
    await screen.findByRole('list', { name: 'Recent files' });
  });

  it('keeps the shared slate off track without a theme', async () => {
    const { container } = setup();
    const track = container.querySelector('[data-switch-track]') as HTMLElement;
    expect(track.className).toContain('bg-slate-300');
    expect(track.style.backgroundColor).toBe('');
    await screen.findByRole('list', { name: 'Recent files' });
  });
});
