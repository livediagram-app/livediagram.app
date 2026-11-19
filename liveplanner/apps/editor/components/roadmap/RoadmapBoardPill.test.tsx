// @vitest-environment jsdom
// docs/specs/026-plan/public-roadmap.md "On the board": a published board's Roadmap pill, for someone who may publish
// only; one read for every header; Copy Roadmap Link, Open Roadmap and Roadmap Settings (the dialog on that board);
// gone with Unpublish and renamed with a save; a failed read or a stale one never shows a wrong pill.
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedRoadmap, RoadmapBoard } from '@liveplanner/api-schema';
import { RoadmapHost } from './RoadmapHost';
import { RoadmapBoardPill } from './RoadmapBoardPill';
import { RoadmapBoardsContext } from './RoadmapContext';
import { useRoadmapsOnBoards } from './use-roadmaps-on-boards';

const client = vi.hoisted(() => ({
  readRoadmaps: vi.fn(),
  saveRoadmap: vi.fn(),
  unpublishRoadmap: vi.fn(),
}));
vi.mock('./roadmap-client', () => client);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const palette = {
  surface: '#fff',
  border: '#ddd',
  column: '#eee',
  card: '#fff',
  cardBorder: '#ddd',
  text: '#111',
  muted: '#666',
  warning: '#b45309',
  warningBg: '#fef3c7',
  focus: '#0284c7',
};
const SCOPE = { ownerId: 'user_1', projectId: 'p1' };
const board = (id: string, tabId: string): RoadmapBoard => ({
  id,
  title: id === 'b1' ? 'Product' : 'Bugs',
  tabName: tabId === 't1' ? 'Board' : 'Bugs',
  tabId,
  columns: [
    { status: 'inbox', name: 'Under Review', color: null },
    { status: 'todo', name: 'Planned', color: null },
  ],
  types: [{ id: 'feature', name: 'Feature', glyph: 'sparkles', color: 'violet' }],
  publishable: true,
});
const CODE = 'lpr_AbCdEfGhIjKlMnOpQrStUv';
const live = (boardId: string, title = 'Product Roadmap'): PublishedRoadmap => ({
  title,
  columns: ['todo'],
  types: ['feature'],
  fields: ['description'],
  voting: false,
  formCode: null,
  boardId,
  code: CODE,
  path: `/roadmap/p1/${CODE}`,
  createdAt: 1,
});
const BOARDS = [board('b1', 't1'), board('b2', 't2')];
const writeText = vi.fn(async () => undefined);

beforeEach(() => {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// Two boards' headers under the editor's host, as EditorView draws them.
const headers = (scope: typeof SCOPE | null) => (
  <RoadmapHost scope={scope} hasBoards activeTabId="t1">
    <div data-testid="b1">
      <RoadmapBoardPill boardId="b1" palette={palette} />
    </div>
    <div data-testid="b2">
      <RoadmapBoardPill boardId="b2" palette={palette} />
    </div>
  </RoadmapHost>
);
const pill = () => screen.queryByRole('group', { name: 'Product Roadmap, published roadmap' });

describe('the Roadmap pill', () => {
  it('shows on the published board only, from one read for every header', async () => {
    client.readRoadmaps.mockResolvedValue({ roadmaps: [live('b1')], boards: BOARDS, forms: [] });
    render(headers(SCOPE));
    await waitFor(() => expect(pill()).not.toBeNull());
    const shown = pill()!;
    expect(within(screen.getByTestId('b1')).getByRole('group')).toBe(shown);
    expect(within(screen.getByTestId('b2')).queryByRole('group')).toBeNull();
    expect(client.readRoadmaps).toHaveBeenCalledTimes(1);
    expect(client.readRoadmaps).toHaveBeenCalledWith(SCOPE);
    expect(shown.textContent).toContain('Product Roadmap');
    expect(shown.textContent).toContain('Published.');
    // On a phone the title stays its accessible name, and Copy is left to the dialog.
    expect(shown.querySelector('[data-roadmap-strip-name]')!.className).toContain('phone:sr-only');
    expect(screen.getByRole('button', { name: 'Copy roadmap link' }).className).toContain(
      'phone:hidden',
    );
  });

  it('shows nothing and reads nothing for anyone who may not publish (a share link at any level)', async () => {
    client.readRoadmaps.mockResolvedValue({ roadmaps: [live('b1')], boards: BOARDS, forms: [] });
    const { container } = render(headers(null));
    await act(async () => {});
    expect(container.querySelector('[data-roadmap-strip]')).toBeNull();
    expect(client.readRoadmaps).not.toHaveBeenCalled();
  });

  it('draws nothing outside the editor or without a board id', () => {
    const { container } = render(<RoadmapBoardPill boardId="b1" palette={palette} />);
    expect(container.innerHTML).toBe('');
    const want = vi.fn();
    render(
      <RoadmapBoardsContext.Provider
        value={{ byBoard: new Map([['b1', live('b1')]]), want, manage: vi.fn() }}
      >
        <RoadmapBoardPill boardId={undefined} palette={palette} />
      </RoadmapBoardsContext.Provider>,
    );
    expect(want).not.toHaveBeenCalled();
    expect(pill()).toBeNull();
  });

  it('keeps a press on it from the board under it, which would select and move the board', () => {
    const board = vi.fn();
    render(
      <RoadmapBoardsContext.Provider
        value={{ byBoard: new Map([['b1', live('b1')]]), want: vi.fn(), manage: vi.fn() }}
      >
        <div onPointerDown={board}>
          <RoadmapBoardPill boardId="b1" palette={palette} />
        </div>
      </RoadmapBoardsContext.Provider>,
    );
    fireEvent.pointerDown(pill()!);
    expect(board).not.toHaveBeenCalled();
  });

  it('shows no pill when the read fails', async () => {
    client.readRoadmaps.mockRejectedValue(new Error('no'));
    const { container } = render(headers(SCOPE));
    await act(async () => {});
    expect(container.querySelector('[data-roadmap-strip]')).toBeNull();
  });

  it('copies the link and opens the public page', async () => {
    client.readRoadmaps.mockResolvedValue({ roadmaps: [live('b1')], boards: BOARDS, forms: [] });
    const opened = vi.fn();
    vi.stubGlobal('open', opened);
    render(headers(SCOPE));
    await waitFor(() => expect(pill()).not.toBeNull());
    const url = `${window.location.origin}/roadmap/p1/${CODE}`;
    const copy = screen.getByRole('button', { name: 'Copy roadmap link' });
    const before = copy.innerHTML;
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith(url);
    expect(track).toHaveBeenCalledWith('Plan', 'Copied', 'Roadmap');
    // It shows a tick (its tooltip reads Copied) for a moment.
    await waitFor(() => expect(copy.innerHTML).not.toBe(before));
    fireEvent.click(screen.getByRole('button', { name: 'Open roadmap Product Roadmap' }));
    expect(opened).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    // A refused clipboard keeps the copy glyph.
    writeText.mockRejectedValueOnce(new Error('denied'));
    await new Promise((r) => setTimeout(r, 1600));
    const glyph = copy.innerHTML;
    fireEvent.click(copy);
    await act(async () => {});
    expect(copy.innerHTML).toBe(glyph);
  });

  it('opens its settings on its own board, follows a save, and goes with Unpublish', async () => {
    // The board's pill is on a tab other than the one in view: the dialog starts on the pill's.
    client.readRoadmaps.mockResolvedValue({ roadmaps: [live('b2')], boards: BOARDS, forms: [] });
    render(headers(SCOPE));
    const shown = await waitFor(() =>
      within(screen.getByTestId('b2')).getByRole('group', { name: /published roadmap/ }),
    );
    fireEvent.click(within(shown).getByRole('button', { name: 'Roadmap settings' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Roadmap');
    // The dialog's code loads on first open (next/dynamic), which can take a while on a busy runner.
    const title = await screen.findByLabelText<HTMLInputElement>('Title', {}, { timeout: 5000 });
    expect(title.value).toBe('Product Roadmap');
    expect(
      document
        .querySelector('[data-roadmap-dialog-state]')!
        .getAttribute('data-roadmap-dialog-state'),
    ).toBe('published');
    // The dialog's first effects (the field taking the title) land before typing, as they do before a person types.
    await act(async () => {});
    // A save renames the pill as it goes.
    client.saveRoadmap.mockResolvedValue({ roadmap: live('b2', 'Bug Roadmap') });
    fireEvent.change(title, { target: { value: 'Bug Roadmap' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Bug Roadmap, published roadmap' })).toBeTruthy(),
    );
    expect(client.saveRoadmap.mock.calls[0]![1]).toBe('b2');
    // Unpublish takes the pill away at once.
    client.unpublishRoadmap.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    fireEvent.click(
      within(document.querySelector('[data-confirm-popover]') as HTMLElement).getByRole('button', {
        name: 'Unpublish',
      }),
    );
    await waitFor(() => expect(document.querySelector('[data-roadmap-strip]')).toBeNull());
    expect(client.unpublishRoadmap).toHaveBeenCalledWith(SCOPE, 'b2');
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    await waitFor(() => expect(document.querySelector('[data-roadmap-dialog-state]')).toBeNull());
  });
});

describe('useRoadmapsOnBoards', () => {
  const props = (scope: typeof SCOPE | null) => ({ scope });
  it('reads once, drops a read the dialog has overtaken, and starts again for another plan', async () => {
    let answer: (r: unknown) => void = () => undefined;
    client.readRoadmaps.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const { result, rerender } = renderHook(({ scope }) => useRoadmapsOnBoards(scope), {
      initialProps: props(SCOPE),
    });
    act(() => {
      result.current.want();
      result.current.want();
    });
    expect(client.readRoadmaps).toHaveBeenCalledTimes(1);
    // The dialog publishes before the pills' read answers: its list stands.
    act(() => result.current.take([live('b1')]));
    await act(async () => answer({ roadmaps: [], boards: BOARDS, forms: [] }));
    expect(result.current.byBoard?.get('b1')?.title).toBe('Product Roadmap');
    // Another plan: nothing kept, read again on the next want.
    const other = { ownerId: 'user_1', projectId: 'p2' };
    client.readRoadmaps.mockResolvedValue({ roadmaps: [live('b9')], boards: [], forms: [] });
    rerender({ scope: other });
    expect(result.current.byBoard).toBeNull();
    act(() => result.current.want());
    await waitFor(() => expect(result.current.byBoard?.has('b9')).toBe(true));
    expect(client.readRoadmaps).toHaveBeenLastCalledWith(other);
    // No one who may publish: want reads nothing.
    rerender({ scope: null });
    act(() => result.current.want());
    expect(client.readRoadmaps).toHaveBeenCalledTimes(2);
  });
});
