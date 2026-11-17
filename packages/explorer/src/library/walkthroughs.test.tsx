// The Library's Walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md "The Explorer's Walkthroughs"): the
// person's walkthroughs as cards, played in place from a blob, maximised, closed, and deleted after a confirm.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import type { WalkthroughEntry, WalkthroughsHost } from './types';
import { clockOf, sizeOf, WalkthroughsContent } from './WalkthroughsPane';
import { ExplorerProvider } from '../explorer/context';

const entry = (n: number, over: Partial<WalkthroughEntry> = {}): WalkthroughEntry => ({
  id: `w${n}`,
  item: makeItem(1).id,
  title: `Walk ${n}`,
  author: 'Ada',
  durationMs: 43_000,
  mediaType: 'audio/webm',
  mediaBytes: 243 * 1024,
  camera: false,
  createdAt: Date.UTC(2026, 10, 17),
  ...over,
});

function host(entries: WalkthroughEntry[]): WalkthroughsHost & {
  media: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
} {
  return {
    list: vi.fn(async () => entries),
    media: vi.fn(async () => new Blob(['x'], { type: 'audio/webm' })),
    remove: vi.fn(async () => {}),
  };
}

// The index's lookup names the item it has, and no other.
function client() {
  const fake = createFakeIndex({ items: [makeItem(1)] }).client;
  fake.lookupItems = vi.fn(async (ids: readonly string[]) => ({
    items: ids.filter((id) => id === makeItem(1).id).map(() => makeItem(1)),
  }));
  return fake;
}

// The panel's Library tab: the same list, compact.
function ExplorerPanelHarness({ walkthroughs }: { walkthroughs: WalkthroughsHost }) {
  return (
    <ExplorerProvider
      app="livediagram"
      client={client()}
      view={{ kind: 'walkthroughs' }}
      filter="all"
      setFilter={vi.fn()}
      onNavigate={vi.fn()}
      itemHref={(i) => `/d/${i.id}`}
      onCreate={vi.fn()}
    >
      <WalkthroughsContent compact host={walkthroughs} />
    </ExplorerProvider>
  );
}

function page(walkthroughs?: WalkthroughsHost) {
  render(
    <Explorer
      app="livediagram"
      client={client()}
      view={{ kind: 'walkthroughs' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/d/${i.id}`}
      onCreate={vi.fn()}
      heroHidden
      {...(walkthroughs ? { walkthroughs } : {})}
    />,
  );
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:walk');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('Walkthroughs in the Library', () => {
  it('words a length and a size', () => {
    expect(clockOf(43_000)).toBe('0:43');
    expect(clockOf(125_400)).toBe('2:05');
    expect(sizeOf(200)).toBe('1 KB');
    expect(sizeOf(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });

  it('lists each as a card naming its item, and plays one in place', async () => {
    const h = host([entry(1), entry(2, { camera: true, item: 'gone' })]);
    page(h);
    const play = await screen.findByRole('button', { name: 'Play Walk 1' });
    const card = play.closest('li')!;
    expect(card.textContent).toContain('0:43');
    expect(card.textContent).toContain('Voice');
    await waitFor(() =>
      expect(within(card).getByRole('link').getAttribute('href')).toContain('/d/'),
    );
    const other = screen.getByRole('button', { name: 'Play Walk 2' }).closest('li')!;
    expect(other.textContent).toContain('Camera');
    expect(other.textContent).toContain('An item you can no longer open');
    await act(async () => fireEvent.click(play));
    const video = await within(card).findByLabelText('Walk 1, playing');
    expect(video.getAttribute('src')).toBe('blob:walk');
    expect(h.media).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), expect.anything());
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }));
    expect(within(card).queryByLabelText('Walk 1, playing')).toBeNull();
  });

  it('says so when the media will not load', async () => {
    const h = host([entry(1)]);
    h.media.mockRejectedValueOnce(new Error('gone'));
    page(h);
    const play = await screen.findByRole('button', { name: 'Play Walk 1' });
    await act(async () => fireEvent.click(play));
    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t play it');
  });

  it('deletes one after its confirm', async () => {
    const h = host([entry(1), entry(2)]);
    page(h);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Walk 1' }));
    await act(async () =>
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
      ),
    );
    await waitFor(() => expect(screen.queryByText('Walk 1')).toBeNull());
    expect(h.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }));
    expect(screen.getByText('Walk 2')).toBeTruthy();
  });

  it('says when there are none, and offers Try Again when the list fails', async () => {
    page(host([]));
    expect(await screen.findByText('No walkthroughs yet')).toBeTruthy();
  });

  it('offers Try Again when the list fails', async () => {
    const h = host([entry(1)]);
    (h.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
    page(h);
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Walk 1')).toBeTruthy();
  });

  it('draws small tiles three to a row in the panel, one playing taking the row', async () => {
    const h = host([entry(1), entry(2)]);
    render(<ExplorerPanelHarness walkthroughs={h} />);
    const play = await screen.findByRole('button', { name: 'Play Walk 1' });
    const grid = document.querySelector('[data-walkthroughs-grid]')!;
    expect(grid.className).toContain('grid-cols-3');
    const card = play.closest('li')!;
    expect(card.textContent).not.toContain('Voice');
    await act(async () => fireEvent.click(play));
    expect(card.className).toContain('col-span-3');
  });

  it('says the app keeps none without a host', async () => {
    page();
    expect(await screen.findByText('No Walkthroughs here')).toBeTruthy();
  });
});
