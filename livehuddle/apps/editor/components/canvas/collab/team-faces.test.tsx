// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  type Element,
  type NoticeNote,
  type ShapeElement,
} from '@livehuddle/document';
import { DEFAULT_AVATAR_CONFIG } from '@liveworkspace/avatar/config';
import { isPieceControlPress } from '@/lib/piece-control';
import { createWayfindingStore, type Wayfinding } from '../wayfinding/wayfinding-store';

// docs/specs/009-elements/team-pieces.md: the Calendar Wall's month and its notes (the Notice Board's deltas with a
// day), the Suggestion Box by role and its privacy, the Signpost's arrows and the Team Photo Wall's frames.

const { state, api, track } = vi.hoisted(() => ({
  state: { ctx: null as Record<string, unknown> | null },
  api: {
    apiDropSuggestion: vi.fn(),
    apiListSuggestions: vi.fn(),
    apiRemoveSuggestion: vi.fn(),
  },
  track: vi.fn(),
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => state.ctx,
}));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/api-client', () => api);

import { hasTeamFace, TeamFace } from './TeamFaces';
import { CalendarWallPopover, notesByDay } from './CalendarWallPopover';
import { SuggestionBoxPanel } from './SuggestionBoxPopover';
import { SignpostFace } from '../wayfinding/SignpostFace';
import { PhotoWallFace } from '../wayfinding/PhotoWallFace';

const ADDER = 'a'.repeat(32);
// 7 November 2026, 10:00 on this machine's clock.
const NOW = new Date(2026, 10, 7, 10, 0).getTime();

const piece = (shape: ShapeElement['shape'], over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: shape,
  type: 'shape',
  shape,
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
});
const note = (id: string, day: string, by = ADDER, at = 1): NoticeNote => ({
  id,
  text: `note ${id}`,
  author: 'Sam',
  by,
  at,
  day,
});

function editor(level: 'edit' | 'participate' | 'view', over: Record<string, unknown> = {}) {
  return {
    can: { level },
    participating: level === 'participate',
    adderKey: level === 'participate' ? ADDER : null,
    selfParticipant: { id: 'p1', name: 'Me', color: '#f00' },
    applyElementDelta: vi.fn(),
    imageContext: { ownerId: 'owner', documentId: 'doc-1', shareCode: 'share' },
    activeTab: { id: 'tab-1' },
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  state.ctx = editor('participate');
});
afterEach(() => {
  cleanup();
  // The popovers' anchors, added by hand.
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('which kinds have a team face', () => {
  it('is the calendar and the box; the signpost and the wall have faces of their own', () => {
    expect(hasTeamFace('calendar-wall')).toBe(true);
    expect(hasTeamFace('suggestion-box')).toBe(true);
    expect(hasTeamFace('signpost')).toBe(false);
    expect(hasTeamFace('notice-board')).toBe(false);
    render(<TeamFace element={piece('signpost')} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the Calendar Wall face', () => {
  it('draws this month with today circled and a tab on each day with notes', () => {
    const { container } = render(
      <TeamFace
        element={piece('calendar-wall', {
          noticeNotes: [note('a', '2026-11-20'), note('b', '2026-11-20'), note('c', '2026-11-03')],
        })}
      />,
    );
    expect(container.textContent).toContain('November 2026');
    expect(container.querySelectorAll('[data-calendar-day]')).toHaveLength(42);
    expect(
      container
        .querySelector('[data-calendar-today]')
        ?.closest('[data-calendar-day]')
        ?.getAttribute('data-calendar-day'),
    ).toBe('2026-11-07');
    const tabs = [...container.querySelectorAll('[data-calendar-note]')].map((t) =>
      t.closest('[data-calendar-day]')!.getAttribute('data-calendar-day'),
    );
    expect(tabs).toEqual(['2026-11-03', '2026-11-20']);
    // A count only where a day holds more than one.
    const twenty = container.querySelector('[data-calendar-day="2026-11-20"] [data-calendar-note]');
    expect(twenty?.textContent).toBe('2');
  });

  it('keeps its Calendar button’s press from the piece, and opens the month by it', () => {
    const onPointerDown = vi.fn();
    render(
      <div onPointerDown={onPointerDown}>
        <TeamFace element={piece('calendar-wall')} />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Open Calendar, 0 notes' });
    fireEvent.pointerDown(button);
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(isPieceControlPress(button)).toBe(true);
    fireEvent.click(button);
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeTruthy();
  });

  it('opens in the reader while walking, from the button or the whole face', () => {
    render(<TeamFace element={piece('calendar-wall')} walking />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the Calendar' }));
    expect(document.querySelector('[data-calendar-reader]')).not.toBeNull();
  });
});

describe('the Calendar Wall month', () => {
  function open(element: ShapeElement) {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    return render(<CalendarWallPopover element={element} anchor={anchor} onClose={() => {}} />);
  }

  it('groups notes by day, newest first, a note with no day on the day it was pinned', () => {
    const noDay = { id: 'x', text: 'x', author: 'Sam', by: ADDER, at: NOW };
    const byDay = notesByDay([
      note('old', '2026-11-20', ADDER, 1),
      note('new', '2026-11-20', ADDER, 2),
      noDay,
    ]);
    expect(byDay.get('2026-11-20')!.map((n) => n.id)).toEqual(['new', 'old']);
    expect(byDay.get('2026-11-07')!.map((n) => n.id)).toEqual(['x']);
    expect(notesByDay(undefined).size).toBe(0);
  });

  it('opens on today, lists a picked day’s notes and pins to that day as one notice-pin delta', () => {
    open(piece('calendar-wall', { noticeNotes: [note('a', '2026-11-20')] }));
    expect(
      screen.getByRole('button', { name: '7 November, today' })?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText('No Notes Yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '20 November, 1 note' }));
    expect(screen.getByText('note a')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Offsite' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin to 20 Nov' }));
    const ctx = state.ctx!;
    const [id, delta] = (ctx.applyElementDelta as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(id).toBe('calendar-wall');
    expect(delta).toMatchObject({
      kind: 'notice-pin',
      note: { text: 'Offsite', by: ADDER, day: '2026-11-20', author: 'Me' },
    });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'Calendar-wall');
  });

  it('dates a note card day then month, as the calendar does', () => {
    open(piece('calendar-wall', { noticeNotes: [note('a', '2026-11-20', ADDER, NOW)] }));
    fireEvent.click(screen.getByRole('button', { name: '20 November, 1 note' }));
    expect(screen.getByText('Sam · 7 Nov')).toBeTruthy();
  });

  it('pins a titled, coloured note', () => {
    open(piece('calendar-wall'));
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Offsite' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Bring a coat' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin to 7 Nov' }));
    const ctx = state.ctx!;
    const [, delta] = (ctx.applyElementDelta as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(delta).toMatchObject({ note: { title: 'Offsite', color: 'blue', day: '2026-11-07' } });
  });

  it('steps months either way and comes back with Today', () => {
    open(piece('calendar-wall'));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeTruthy();
    // A day spilling over from the next month turns to it.
    fireEvent.click(screen.getByRole('button', { name: '1 November' }));
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeTruthy();
  });

  it('lets a Viewer read, never pin, and unpins only what a Participant signed', () => {
    state.ctx = editor('view');
    const { unmount } = open(piece('calendar-wall', { noticeNotes: [note('a', '2026-11-07')] }));
    expect(screen.getByText('note a')).toBeTruthy();
    expect(screen.queryByLabelText('Note')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unpin' })).toBeNull();
    unmount();
    state.ctx = editor('participate');
    open(
      piece('calendar-wall', {
        noticeNotes: [note('mine', '2026-11-07'), note('theirs', '2026-11-07', 'b'.repeat(32), 2)],
      }),
    );
    expect(screen.getAllByRole('button', { name: 'Unpin' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    const ctx = state.ctx;
    const [, delta] = (ctx.applyElementDelta as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(delta).toEqual({ kind: 'notice-unpin', noteId: 'mine', by: ADDER });
  });
});

describe('the Suggestion Box', () => {
  const box = (over: Partial<ShapeElement> = {}) => piece('suggestion-box', over);

  it('opens from its Suggest button, and in the reader while walking', () => {
    const { unmount } = render(<TeamFace element={box()} />);
    const button = screen.getByRole('button', { name: 'Open the Suggestion Box' });
    expect(isPieceControlPress(button)).toBe(true);
    fireEvent.click(button);
    expect(screen.getByLabelText('Suggestion')).toBeTruthy();
    unmount();
    render(<TeamFace element={box()} walking />);
    // The pill, while walking, opens the reader too.
    const [hit, pill] = screen.getAllByRole('button', { name: 'Open the Suggestion Box' });
    expect(hit!.hasAttribute('data-piece-main')).toBe(true);
    fireEvent.click(pill!);
    expect(document.querySelector('[data-suggestion-reader]')).not.toBeNull();
  });

  // furniture-facing.md "Live faces": a control stays reachable at every facing, its words never mirrored.
  it('keeps its Suggest button reachable and unmirrored at every facing', () => {
    for (const chairFacing of ['n', 'e', 's', 'w'] as const) {
      const { unmount } = render(<TeamFace element={box({ chairFacing })} />);
      const button = screen.getByRole('button', { name: 'Open the Suggestion Box' });
      expect(button.textContent, chairFacing).toContain('Suggest');
      for (let el: HTMLElement | null = button; el; el = el.parentElement)
        expect(el.getAttribute('style') ?? '', chairFacing).not.toMatch(/scale\(-1/);
      fireEvent.click(button);
      expect(screen.getByLabelText('Suggestion'), chairFacing).toBeTruthy();
      unmount();
    }
  });

  it('lets a Participant drop a note with nothing but its words, and never read any', async () => {
    api.apiDropSuggestion.mockResolvedValue(undefined);
    render(<SuggestionBoxPanel element={box()} size="popover" />);
    expect(screen.queryByText('In the Box')).toBeNull();
    expect(api.apiListSuggestions).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Suggestion'), { target: { value: '  More plants  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop It In' }));
    await screen.findByText('Dropped in. Only Editors read these, and never who wrote them.');
    expect(api.apiDropSuggestion).toHaveBeenCalledWith(
      'owner',
      'doc-1',
      'tab-1',
      'suggestion-box',
      'More plants',
      'share',
    );
    expect(screen.getByLabelText('Suggestion')).toHaveProperty('value', '');
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'Suggestion-box');
  });

  it.each([
    ['box_full', 'The box is full. An Editor can empty it.'],
    ['box_closed', 'This box is closed.'],
    ['other', "Couldn't drop it. Try again."],
  ])('says why a drop was refused: %s', async (code, words) => {
    api.apiDropSuggestion.mockRejectedValue(Object.assign(new Error('no'), { code }));
    render(<SuggestionBoxPanel element={box()} size="reader" />);
    fireEvent.change(screen.getByLabelText('Suggestion'), { target: { value: 'Idea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop It In' }));
    await screen.findByText(words);
    // Typing again clears it.
    fireEvent.change(screen.getByLabelText('Suggestion'), { target: { value: 'Idea 2' } });
    expect(screen.queryByText(words)).toBeNull();
  });

  it('shows a Viewer the box shut, and a This Browser Space the way to collect', () => {
    state.ctx = editor('view');
    const { unmount } = render(<SuggestionBoxPanel element={box()} size="popover" />);
    expect(screen.queryByLabelText('Suggestion')).toBeNull();
    expect(screen.getByText(/Editors read them/)).toBeTruthy();
    unmount();
    state.ctx = editor('edit', { imageContext: undefined });
    const second = render(<SuggestionBoxPanel element={box()} size="popover" />);
    expect(screen.getByText('Share this Space to collect suggestions.')).toBeTruthy();
    second.unmount();
    state.ctx = null;
    render(<SuggestionBoxPanel element={box()} size="popover" />);
    expect(screen.getByText('Share this Space to collect suggestions.')).toBeTruthy();
  });

  it('shows a locked box closed, and still lets an Editor read it', async () => {
    state.ctx = editor('edit');
    api.apiListSuggestions.mockResolvedValue([]);
    render(<SuggestionBoxPanel element={box({ locked: true })} size="popover" />);
    expect(screen.getByText('This box is closed.')).toBeTruthy();
    expect(screen.queryByLabelText('Suggestion')).toBeNull();
    await screen.findByText('No Notes Yet');
  });

  it('lets an Editor read, refresh and remove notes, putting one back when a remove fails', async () => {
    state.ctx = editor('edit');
    api.apiListSuggestions.mockResolvedValue([
      { id: 's2', text: 'Standing desks', day: '2026-11-06' },
      { id: 's1', text: 'Fruit Fridays', day: '2026-11-05' },
    ]);
    render(<SuggestionBoxPanel element={box()} size="popover" />);
    const list = await screen.findByRole('region', { name: 'Notes in the box' });
    expect(within(list).getByText('Standing desks')).toBeTruthy();
    expect(within(list).getByText('5 Nov')).toBeTruthy();
    expect(api.apiListSuggestions).toHaveBeenCalledWith(
      'owner',
      'doc-1',
      'tab-1',
      'suggestion-box',
      'share',
    );

    api.apiRemoveSuggestion.mockResolvedValueOnce(undefined);
    fireEvent.click(within(list).getAllByRole('button', { name: 'Remove' })[0]!);
    expect(within(list).queryByText('Standing desks')).toBeNull();
    expect(api.apiRemoveSuggestion).toHaveBeenCalledWith('owner', 'doc-1', 'tab-1', 's2', 'share');

    api.apiRemoveSuggestion.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(within(list).getByRole('button', { name: 'Remove' }));
    await within(list).findByText('Fruit Fridays');

    api.apiListSuggestions.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh the notes' }));
    await screen.findByText('No Notes Yet');
  });

  it('offers Try Again when the notes do not load', async () => {
    state.ctx = editor('edit');
    api.apiListSuggestions.mockRejectedValueOnce(new Error('down'));
    render(<SuggestionBoxPanel element={box()} size="popover" />);
    await screen.findByText("Couldn't load the notes.");
    api.apiListSuggestions.mockResolvedValue([{ id: 's1', text: 'Hi', day: '2026-11-05' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByText('Hi')).toBeTruthy());
  });
});

function makeWayfinding(): Wayfinding & { walkThere: ReturnType<typeof vi.fn> } {
  const store = createWayfindingStore();
  const walkThere = vi.fn();
  return {
    store,
    actions: { walkThere, go: vi.fn(), loadFloors: vi.fn(), closePanel: vi.fn(), climb: vi.fn() },
    walkThere,
  };
}
const at = (kind: Parameters<typeof createShape>[0], x: number, y: number, over = {}) =>
  ({ ...createShape(kind, x, y), id: `${kind}-${x}-${y}`, ...over }) as Element;

describe('the Signpost', () => {
  const post = piece('signpost', { x: 1000, y: 1000, width: 120, height: 144 });

  it('names the three nearest places, the nearest on top, and walks to one when pressed', () => {
    const w = makeWayfinding();
    // Stages, whose arrival is the middle of their top, so the distances are plain.
    const near = at('stage', 1150, 1050, { label: 'Kitchen' });
    const far = at('room', 4000, 4000, { label: 'Far Away' });
    const left = at('stage', 200, 1000, { label: 'Main Stage' });
    const mid = at('stage', 1100, 1600, { label: 'A very long pod name indeed' });
    w.store.set({
      tabs: [{ id: 't', name: 'Floor', elements: [far, left, near, mid, post] }],
      activeTabId: 't',
    });
    const { container } = render(<SignpostFace element={post} wayfinding={w} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Walk to Kitchen',
      'Walk to A very long pod name indeed',
      'Walk to Main Stage',
    ]);
    expect(buttons[0]!.hasAttribute('data-piece-main')).toBe(true);
    expect(buttons[1]!.hasAttribute('data-piece-main')).toBe(false);
    expect(
      [...container.querySelectorAll('[data-signpost-board]')].map((b) =>
        b.getAttribute('data-signpost-board'),
      ),
    ).toEqual(['right', 'right', 'left']);
    expect(container.textContent).toContain('A very long…');
    fireEvent.pointerDown(buttons[2]!, { clientX: 0, clientY: 0 });
    fireEvent.click(buttons[2]!, { clientX: 0, clientY: 0 });
    expect(w.walkThere).toHaveBeenCalledWith(expect.objectContaining({ id: left.id }));
  });

  it('stays blank and says how to fill it with no places, and draws nothing without a store', () => {
    const w = makeWayfinding();
    w.store.set({ tabs: [{ id: 't', name: 'Floor', elements: [post] }], activeTabId: 't' });
    const { unmount } = render(<SignpostFace element={post} wayfinding={w} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByRole('img', {
        name: 'Signpost. No Places Yet: add a room, an office pod or a stage and it appears here.',
      }),
    ).toBeTruthy();
    unmount();
    const none = render(<SignpostFace element={post} />);
    expect(none.container.innerHTML).toBe('');
  });

  it('stays blank on a tab the store does not hold', () => {
    const w = makeWayfinding();
    w.store.set({ tabs: [], activeTabId: 'gone' });
    render(<SignpostFace element={post} wayfinding={w} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the Team Photo Wall', () => {
  const wall = piece('photo-wall', { width: 176, height: 112 });
  const person = (i: number, over = {}) => ({
    id: `p${i}`,
    name: `Person ${i}`,
    color: '#0ea5e9',
    tabId: 't',
    placeId: null,
    ...over,
  });

  it('fills a frame for each person here, you first, and names them for a screen reader', () => {
    const w = makeWayfinding();
    w.store.set({
      people: [
        person(0, { name: 'Sam', self: true, config: DEFAULT_AVATAR_CONFIG }),
        person(1, { name: 'Priya' }),
        person(2, { name: 'Jo' }),
      ],
    });
    const { container } = render(<PhotoWallFace element={wall} wayfinding={w} />);
    expect(
      screen.getByRole('img', { name: 'Team photo wall: Sam (you), Priya and Jo' }),
    ).toBeTruthy();
    expect(container.querySelectorAll('[data-photo-frame]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-photo-frame] svg')).toHaveLength(3);
    expect(container.querySelector('[data-photo-more]')).toBeNull();
  });

  it('keeps to eight frames: seven and a +N past eight', () => {
    const w = makeWayfinding();
    w.store.set({ people: Array.from({ length: 12 }, (_, i) => person(i)) });
    const { container } = render(<PhotoWallFace element={wall} wayfinding={w} />);
    expect(container.querySelectorAll('[data-photo-frame]')).toHaveLength(7);
    expect(container.querySelector('[data-photo-more]')?.textContent).toBe('+5');
  });

  it('shows empty frames, never a broken wall, with nobody here or no store', () => {
    const w = makeWayfinding();
    const { container, unmount } = render(<PhotoWallFace element={wall} wayfinding={w} />);
    expect(container.querySelectorAll('[data-photo-frame]')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Team photo wall, empty frames' })).toBeTruthy();
    unmount();
    expect(render(<PhotoWallFace element={wall} />).container.innerHTML).toBe('');
  });

  it('changes as people arrive', () => {
    const w = makeWayfinding();
    const { container } = render(<PhotoWallFace element={wall} wayfinding={w} />);
    act(() => w.store.set({ people: [person(1)] }));
    expect(container.querySelectorAll('[data-photo-frame]')).toHaveLength(1);
  });
});
