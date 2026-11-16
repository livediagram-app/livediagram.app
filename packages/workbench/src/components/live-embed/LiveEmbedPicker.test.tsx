// @vitest-environment jsdom

// Choose a File (live-embeds.md "Making one"): connected files first, then Recent with the host left out, a pasted
// share link resolved and its code dropped, and the choice handed back with its snapshot.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type Item } from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { LiveEmbedPicker } from './LiveEmbedPicker';

const item = (id: string, title: string, app = 'liveplanner') =>
  ({ id, app, title, updatedAt: 0, lastOpenedAt: 0 }) as unknown as Item;

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

function open(connectedIds: string[] = []) {
  const onChoose = vi.fn();
  const onClose = vi.fn();
  render(
    <LiveEmbedPicker
      client={client as never}
      hostId="doc1"
      connectedIds={connectedIds}
      now={0}
      onChoose={onChoose}
      onClose={onClose}
    />,
  );
  return { onChoose, onClose };
}

describe('Choose a File', () => {
  it('lists connected files first, then Recent without them or the host', async () => {
    open(['d1', 'gone']);
    const connected = await screen.findByRole('list', { name: 'Connected files' });
    expect(connected.textContent).toContain('Architecture');
    const recentList = await screen.findByRole('list', { name: 'Recent files' });
    expect(recentList.textContent).toContain('Roadmap');
    expect(recentList.textContent).not.toContain('Architecture');
    expect(recentList.textContent).not.toContain('This document');
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
