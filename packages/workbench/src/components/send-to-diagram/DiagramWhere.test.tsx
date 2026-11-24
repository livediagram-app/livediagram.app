// @vitest-environment jsdom
// The picker's Where (DiagramWhere.tsx): New Diagram, New Tab with its searched list, Update for a place sent before.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiagramSend, Item } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { DiagramWhere, type DiagramWhereChoice } from './DiagramWhere';

const item = (id: string, title: string, over: Partial<Item> = {}): Item =>
  ({ id, title, access: 'edit', archivedAt: null, ...over }) as Item;
const SEND: DiagramSend = {
  id: 's',
  ref: 't:e',
  diagram: { id: 'D', title: '' },
  tabId: 'x',
  link: 'https://ld/D',
  at: 1,
};

afterEach(cleanup);

const mount = (choice: DiagramWhereChoice, client: { listItems: ReturnType<typeof vi.fn> }) => {
  const onChoice = vi.fn();
  render(
    <DiagramWhere
      choice={choice}
      onChoice={onChoice}
      earlier={SEND}
      disabled={false}
      client={client as never}
    />,
  );
  return onChoice;
};

describe('DiagramWhere', () => {
  it('offers Update, New Diagram and New Tab, each picking itself', () => {
    const client = { listItems: vi.fn().mockResolvedValue({ items: [] }) };
    const onChoice = mount({ mode: 'new' }, client);
    expect(screen.getByRole('radio', { name: /Update/ }).textContent).toContain('Untitled diagram');
    fireEvent.click(screen.getByRole('radio', { name: /Update/ }));
    expect(onChoice).toHaveBeenLastCalledWith({ mode: 'update', send: SEND });
    fireEvent.click(screen.getByRole('radio', { name: /New Diagram/ }));
    expect(onChoice).toHaveBeenLastCalledWith({ mode: 'new' });
    fireEvent.click(screen.getByRole('radio', { name: /New Tab/ }));
    expect(onChoice).toHaveBeenLastCalledWith({ mode: 'tab', item: null });
    expect(client.listItems).not.toHaveBeenCalled();
  });

  it('lists the diagrams to edit, keeps the chosen one, and names an untitled one', async () => {
    const client = {
      listItems: vi.fn().mockResolvedValue({
        items: [
          item('1', 'Flows'),
          item('2', ''),
          item('3', 'Read only', { access: 'view' }),
          item('4', 'Old', { archivedAt: 5 }),
        ],
      }),
    };
    const picked = item('2', '');
    const onChoice = mount({ mode: 'tab', item: picked }, client);
    expect(screen.getByRole('status')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    expect(screen.getAllByRole('option')[1]!.textContent).toBe('Untitled diagram');
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('radio', { name: /New Tab/ }).textContent).toContain(
      'Untitled diagram',
    );
    fireEvent.click(screen.getByRole('radio', { name: /New Tab/ }));
    expect(onChoice).toHaveBeenLastCalledWith({ mode: 'tab', item: picked });
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(onChoice).toHaveBeenLastCalledWith({
      mode: 'tab',
      item: expect.objectContaining({ id: '1' }),
    });
    expect(client.listItems.mock.calls[0]![0]).not.toHaveProperty('q');
  });

  it('says so when there are none, when a search finds none, and when the list fails', async () => {
    const listItems = vi.fn().mockResolvedValue({ items: [] });
    mount({ mode: 'tab', item: null }, { listItems });
    await screen.findByText('No diagrams to add to');
    fireEvent.change(screen.getByLabelText('Search your diagrams'), { target: { value: 'zzz' } });
    await waitFor(() =>
      expect(listItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'zzz' }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByText('No diagrams to add to')).toBeNull());
    cleanup();
    mount(
      { mode: 'tab', item: null },
      { listItems: vi.fn().mockRejectedValue(new Error('offline')) },
    );
    await screen.findByText("Couldn't load your diagrams");
  });

  it('drops a list that fails after it was left', async () => {
    let fail!: (e: Error) => void;
    const listItems = vi.fn().mockReturnValue(new Promise((_, r) => (fail = r)));
    const { unmount } = render(
      <DiagramWhere
        choice={{ mode: 'tab', item: null }}
        onChoice={vi.fn()}
        earlier={null}
        disabled={false}
        client={{ listItems }}
      />,
    );
    unmount();
    fail(new Error('late'));
    await Promise.resolve();
    expect(screen.queryByText("Couldn't load your diagrams")).toBeNull();
  });
});
