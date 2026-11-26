// @vitest-environment jsdom
// Start a Call Here in the editor (liveworkspace/docs/specs/004-index/item-calls.md): the host names the item to the
// store, reads its calls once and again only on the room's word or the tab's return; Call (an account) starts the call
// in its own tab, opened in the Start a Call popover's Start Call press (Work Tracker 1470); "3 in Call" with Join (anyone who reads the item) brings the call's tab back or
// opens it; Meetings in Tools lists the calls. Nothing for a session that can't call, nor in livehuddle itself.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemCallsRead, ItemMeeting } from '@liveworkspace/index-client';

const { itemCalls, startItemCall, listItems, track, toastError, toastWarning, prefs } = vi.hoisted(
  () => ({
    itemCalls: vi.fn(),
    startItemCall: vi.fn(),
    listItems: vi.fn(),
    track: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    prefs: { current: {} },
  }),
);
vi.mock('../../lib/index-client', () => ({
  indexClient: { itemCalls, startItemCall, listItems },
}));
vi.mock('../../hooks/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: toastError, warning: toastWarning }),
}));
vi.mock('../../bindings', () => ({
  workbench: {
    track,
    readPreferences: () => prefs.current,
    api: { currentBearer: async () => null },
  },
}));

import { emitSourceChanged } from '../sheet-links/sheet-link-signal';
import { useToolsDoorItems } from '../chrome/tools-door';
import { ItemCallButton, startCall } from './ItemCallButton';
import { canCall, ItemCallHost } from './ItemCallHost';
import { setCallSource } from './item-call-store';
import { focusOrOpen, isBlank, nameItemTab } from '@liveworkspace/index-client/browser';
import { meetingLength, meetingWhen, meetingWho } from './MeetingsDialog';
import { forgetKeptSpaces, SEARCH_FROM } from './StartCallPopover';
import { closeCallChooser, openCallChooser, resetCallChooser } from './call-chooser-store';
import type { Item } from '@liveworkspace/index-client';

const LINK = 'https://www.livehuddle.app/document/shared?s=abc';
// The call's tab enters by way of livehuddle's no-click sign-in (call-tabs.ts viaSilentSignIn).
const ENTRY = 'https://www.livehuddle.app/api/auth/silent?return=%2Fdocument%2Fshared%3Fs%3Dabc';

const meeting = (over: Partial<ItemMeeting> = {}): ItemMeeting => ({
  id: 'ic_1',
  spaceId: 's1',
  link: LINK,
  people: 3,
  names: ['Ada', 'Ben', 'Cy'],
  startedAt: Date.now() - 600_000,
  endedAt: null,
  live: true,
  summary: null,
  plan: null,
  you: false,
  ...over,
});

const reads = (live: ItemMeeting | null, meetings: ItemMeeting[] = live ? [live] : []) =>
  ({ live, meetings }) as ItemCallsRead;

// A browser tab as window.open answers it: blank (ours) or another origin's (reading where it is throws).
function fakeTab(blank: boolean) {
  const tab = {
    focus: vi.fn(),
    close: vi.fn(),
    opener: {} as unknown,
    location: { href: 'about:blank' },
  };
  if (!blank)
    Object.defineProperty(tab, 'location', {
      get() {
        throw new DOMException('cross-origin', 'SecurityError');
      },
    });
  return tab;
}

function Tools() {
  const rows = useToolsDoorItems();
  return (
    <div>
      {rows.map((r) => (
        <button key={r.id} type="button" onClick={() => r.onSelect(null)}>
          Tool {r.label}
        </button>
      ))}
    </div>
  );
}

function Editor(props: Partial<Parameters<typeof ItemCallHost>[0]> = {}) {
  return (
    <>
      <ItemCallHost
        app="livediagram"
        itemId="D1"
        title="Retro"
        signedIn
        enabled
        share={{ code: 'link1' }}
        {...props}
      />
      <ItemCallButton />
      <Tools />
    </>
  );
}

const flush = () => act(async () => {});

beforeAll(async () => {
  await import('./MeetingsDialog');
  await import('./StartCallPopover');
});

// A livehuddle Space the person may choose (choosableSpaces), or one they may not with `over`.
const space = (id: string, title: string, over: Partial<Item> = {}): Item =>
  ({
    id,
    title,
    app: 'livehuddle',
    access: 'edit',
    sharedVia: null,
    trashedAt: null,
    archivedAt: null,
    teamId: null,
    updatedAt: 1,
    summary: null,
    ...over,
  }) as unknown as Item;

beforeEach(() => {
  itemCalls.mockResolvedValue(reads(null));
  listItems.mockResolvedValue({ items: [] });
  window.name = '';
});

afterEach(() => {
  cleanup();
  act(() => setCallSource(null));
  act(() => resetCallChooser());
  forgetKeptSpaces();
  prefs.current = {};
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('the host', () => {
  it('reads the calls with the link, names the tab, and reads again on the room’s word only', async () => {
    render(<Editor />);
    await flush();
    expect(itemCalls).toHaveBeenCalledTimes(1);
    expect(itemCalls.mock.calls[0]![0]).toBe('D1');
    expect(itemCalls.mock.calls[0]![1]).toMatchObject({ share: { code: 'link1' } });
    expect(window.name).toBe('lw-item-D1');

    // A plan's cards changing is not the calls'.
    act(() => emitSourceChanged({ app: 'liveplanner', itemId: 'P', sheetIds: [], cards: ['c'] }));
    await flush();
    expect(itemCalls).toHaveBeenCalledTimes(1);

    itemCalls.mockResolvedValue(reads(meeting()));
    act(() => emitSourceChanged({ app: 'livehuddle', itemId: 's1', sheetIds: [], calls: true }));
    await flush();
    expect(itemCalls).toHaveBeenCalledTimes(2);
    expect(screen.getByText('3 in Call')).toBeTruthy();

    // The tab coming back reads once more.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();
    expect(itemCalls).toHaveBeenCalledTimes(3);
  });

  it('does nothing for a session that can’t call, or in livehuddle', async () => {
    const { rerender } = render(<Editor enabled={false} />);
    await flush();
    rerender(<Editor app="livehuddle" />);
    await flush();
    expect(itemCalls).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /call/i })).toBeNull();
    expect(screen.queryByText('Tool Meetings')).toBeNull();
    expect(canCall({ offline: true })).toBe(false);
    expect(canCall({ embed: true })).toBe(false);
    expect(canCall({ community: true })).toBe(false);
    expect(canCall({})).toBe(true);
  });

  it('keeps a tab the page named for itself', async () => {
    window.name = 'something-else';
    render(<Editor />);
    await flush();
    expect(window.name).toBe('something-else');
    nameItemTab('D2');
    expect(window.name).toBe('something-else');
  });
});

// Call, then the popover's Start Call: the press that opens the call's tab.
async function pressCallThenStart() {
  fireEvent.click(await screen.findByRole('button', { name: 'Call' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Start Call' }));
}

const radio = (name: string) => screen.findByRole<HTMLInputElement>('radio', { name });

describe('Call', () => {
  it('asks first: Call opens the popover and starts nothing', async () => {
    const open = vi.spyOn(window, 'open');
    render(<Editor />);
    await flush();
    const call = screen.getByRole('button', { name: 'Call' });
    expect(call.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(call);
    expect(await screen.findByRole('heading', { name: 'Start a Call' })).toBeTruthy();
    expect(screen.getByText('Retro')).toBeTruthy();
    expect(call.getAttribute('aria-expanded')).toBe('true');
    expect(open).not.toHaveBeenCalled();
    expect(startItemCall).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith('UI', 'Started', 'ItemCall');
  });

  it('opens the call’s tab in the Start Call press, then sends it to the call', async () => {
    const tab = fakeTab(true);
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    startItemCall.mockResolvedValue({ call: meeting({ people: 0 }), started: true });
    render(<Editor />);
    await flush();
    await pressCallThenStart();
    expect(open).toHaveBeenCalledWith('', 'lw-call-D1');
    // Closed once the tab is open.
    expect(screen.queryByRole('heading', { name: 'Start a Call' })).toBeNull();
    await flush();
    // No Calls Space chosen: nothing sent beside the item, as before the setting.
    expect(startItemCall).toHaveBeenCalledWith('D1', { code: 'link1' }, null);
    expect(tab.location.href).toBe(ENTRY);
    expect(tab.opener).toBeNull();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'ItemCall');
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it('preselects A New Space, marked Default, when no Calls Space is set', async () => {
    listItems.mockResolvedValue({ items: [space('lh_a', 'Studio')] });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect((await radio('A New Space')).checked).toBe(true);
    expect((await radio('Studio')).checked).toBe(false);
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('Your Space')).toBeTruthy();
    expect(listItems).toHaveBeenCalledWith({ app: 'livehuddle', view: 'all', limit: 200 });
  });

  it('starts the call in the chosen Calls Space, and says so when it was skipped', async () => {
    prefs.current = { callSpace: 'lh_room' };
    listItems.mockResolvedValue({
      items: [space('lh_room', 'Daily Room', { teamId: 't1' }), space('lh_b', 'Studio')],
    });
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeTab(true) as unknown as Window);
    startItemCall.mockResolvedValue({ call: meeting({ people: 0 }), started: true });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect((await radio('Daily Room')).checked).toBe(true);
    expect(screen.getByText('Your Calls Space')).toBeTruthy();
    expect(screen.getByText('Team Space')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Call' }));
    await flush();
    expect(startItemCall).toHaveBeenLastCalledWith('D1', { code: 'link1' }, 'lh_room');
    expect(toastWarning).not.toHaveBeenCalled();

    open.mockReturnValue(fakeTab(true) as unknown as Window);
    startItemCall.mockResolvedValue({
      call: meeting({ people: 0 }),
      started: true,
      fallback: 'unavailable',
    });
    await pressCallThenStart();
    await flush();
    expect(toastWarning).toHaveBeenCalledWith(expect.stringMatching(/Settings › Calls/));
  });

  it('picks another place for this call only, leaving the setting as it is', async () => {
    prefs.current = { callSpace: 'lh_room' };
    listItems.mockResolvedValue({
      items: [space('lh_room', 'Daily Room'), space('lh_b', 'Studio')],
    });
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeTab(true) as unknown as Window);
    startItemCall.mockResolvedValue({ call: meeting({ people: 0 }), started: true });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    fireEvent.click(await radio('Studio'));
    expect((await radio('Studio')).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Start Call' }));
    await flush();
    expect(startItemCall).toHaveBeenLastCalledWith('D1', { code: 'link1' }, 'lh_b');

    // A New Space over a set Calls Space sends none, so the index makes a Space as the default does.
    open.mockReturnValue(fakeTab(true) as unknown as Window);
    fireEvent.click(await screen.findByRole('button', { name: 'Call' }));
    expect((await radio('Daily Room')).checked).toBe(true);
    fireEvent.click(await radio('A New Space'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Call' }));
    await flush();
    expect(startItemCall).toHaveBeenLastCalledWith('D1', { code: 'link1' }, null);
    expect(prefs.current).toEqual({ callSpace: 'lh_room' });
  });

  it('chooses A New Space and says why when the Calls Space is unavailable', async () => {
    prefs.current = { callSpace: 'lh_gone' };
    listItems.mockResolvedValue({ items: [space('lh_b', 'Studio')] });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect(await screen.findByText(/isn’t available, so a new Space is chosen/)).toBeTruthy();
    expect((await radio('A New Space')).checked).toBe(true);
  });

  it('keeps focus on the chosen row when the list replaces the Calls Space placeholder', async () => {
    prefs.current = { callSpace: 'lh_room' };
    let answer: (v: { items: unknown[] }) => void = () => undefined;
    listItems.mockReturnValue(new Promise((r) => (answer = r)));
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    const placeholder = await radio('Your Calls Space');
    await waitFor(() => expect(document.activeElement).toBe(placeholder));
    answer({ items: [space('lh_room', 'Daily Room')] });
    await flush();
    const row = await radio('Daily Room');
    await waitFor(() => expect(document.activeElement).toBe(row));
  });

  it('closes with nothing started on Cancel, Escape or the close', async () => {
    const open = vi.spyOn(window, 'open');
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Start a Call' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    const heading = await screen.findByRole('heading', { name: 'Start a Call' });
    fireEvent.keyDown(heading, { key: 'Escape' });
    await flush();
    expect(screen.queryByRole('heading', { name: 'Start a Call' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    fireEvent.click(await screen.findByRole('button', { name: /close/i }));
    expect(screen.queryByRole('heading', { name: 'Start a Call' })).toBeNull();
    expect(open).not.toHaveBeenCalled();
    expect(startItemCall).not.toHaveBeenCalled();
  });

  it('starts on Enter, as the form’s submit', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeTab(true) as unknown as Window);
    startItemCall.mockResolvedValue({ call: meeting({ people: 0 }), started: true });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    fireEvent.submit((await radio('A New Space')).form!);
    expect(open).toHaveBeenCalledWith('', 'lw-call-D1');
    await flush();
    expect(startItemCall).toHaveBeenCalledOnce();
  });

  it('keeps Start Call working while the Spaces can’t load, and tries again', async () => {
    prefs.current = { callSpace: 'lh_room' };
    listItems.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(window, 'open').mockReturnValue(fakeTab(true) as unknown as Window);
    startItemCall.mockResolvedValue({ call: meeting({ people: 0 }), started: true });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    // The setting's Space, unnamed until the list comes, stays chosen.
    expect((await radio('Your Calls Space')).checked).toBe(true);

    listItems.mockResolvedValue({ items: [space('lh_room', 'Daily Room')] });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect((await radio('Daily Room')).checked).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start Call' }));
    await flush();
    expect(startItemCall).toHaveBeenLastCalledWith('D1', { code: 'link1' }, 'lh_room');
  });

  it('shows the kept list at once on the next open, and offers to make a Space when there are none', async () => {
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect(await screen.findByRole('link', { name: /Make a Space in livehuddle/ })).toBeTruthy();
    act(() => closeCallChooser());

    listItems.mockReturnValue(new Promise(() => undefined));
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect(await screen.findByRole('link', { name: /Make a Space in livehuddle/ })).toBeTruthy();
  });

  it('lists only the Spaces the person may choose, with a search from seven', async () => {
    const many = Array.from({ length: SEARCH_FROM }, (_, i) =>
      space(`lh_${i}`, i === 3 ? 'Design Crit' : `Room ${i}`),
    );
    listItems.mockResolvedValue({
      items: [...many, space('lh_x', 'Not Mine', { sharedVia: 'link' })],
    });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    const find = await screen.findByRole('searchbox', { name: 'Find a Space' });
    expect(screen.queryByRole('radio', { name: 'Not Mine' })).toBeNull();
    fireEvent.change(find, { target: { value: 'crit' } });
    expect(await radio('Design Crit')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Room 0' })).toBeNull();
    fireEvent.change(find, { target: { value: 'zzz' } });
    expect(await screen.findByText('No Space is called that.')).toBeTruthy();
  });

  it('puts the Calls Space first and keeps the chosen row through a search', async () => {
    prefs.current = { callSpace: 'lh_6' };
    listItems.mockResolvedValue({
      items: Array.from({ length: SEARCH_FROM }, (_, i) => space(`lh_${i}`, `Room ${i}`)),
    });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    const find = await screen.findByRole('searchbox', { name: 'Find a Space' });
    const names = screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'));
    expect(names.slice(0, 2)).toEqual(['A New Space', 'Room 6']);
    fireEvent.change(find, { target: { value: 'zzz' } });
    expect(await screen.findByText('No Space is called that.')).toBeTruthy();
    expect((await radio('Room 6')).checked).toBe(true);
    expect(screen.queryByRole('radio', { name: 'Room 0' })).toBeNull();
  });

  it('asks for its chunk early, and leaves a touch screen’s focus where the sheet puts it', async () => {
    const coarse = vi.fn(() => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    vi.stubGlobal('matchMedia', coarse);
    try {
      prefs.current = { callSpace: 'lh_room' };
      listItems.mockRejectedValueOnce(new Error('offline'));
      render(<Editor />);
      await flush();
      const call = screen.getByRole('button', { name: 'Call' });
      fireEvent.pointerEnter(call);
      fireEvent.focus(call);
      fireEvent.click(call);
      fireEvent.click(await radio('A New Space'));
      fireEvent.click(await radio('Your Calls Space'));
      expect((await radio('Your Calls Space')).checked).toBe(true);
      expect(coarse).toHaveBeenCalledWith('(pointer: coarse)');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opens as a sheet with no Call to sit under (the phone’s Apps drawer)', async () => {
    render(<Editor />);
    await flush();
    act(() => openCallChooser(null));
    expect(await screen.findByRole('heading', { name: 'Start a Call' })).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('brings back a tab already at the call rather than starting another', async () => {
    const tab = fakeTab(false);
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    expect(
      await startCall(
        { app: 'livediagram', id: 'D1', title: 'R', share: null, canStart: true },
        {
          startItemCall,
        },
      ),
    ).toBe('opened');
    expect(tab.focus).toHaveBeenCalled();
    expect(startItemCall).not.toHaveBeenCalled();
  });

  it('says so when the tab is blocked or the call can’t start', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<Editor />);
    await flush();
    await pressCallThenStart();
    await flush();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/blocked/));

    const tab = fakeTab(true);
    open.mockReturnValue(tab as unknown as Window);
    startItemCall.mockRejectedValue(new Error('503'));
    await pressCallThenStart();
    await flush();
    expect(tab.close).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/couldn’t start/));
    expect(track).toHaveBeenCalledWith('UI', 'Refused', 'ItemCall');
  });

  it('says Starting until the index answers, and opens no second popover meanwhile', async () => {
    vi.spyOn(window, 'open').mockReturnValue(fakeTab(true) as unknown as Window);
    let answer: (v: unknown) => void = () => undefined;
    startItemCall.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<Editor />);
    await flush();
    await pressCallThenStart();
    const call = await screen.findByRole('button', { name: 'Starting' });
    expect(call.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(call);
    expect(screen.queryByRole('heading', { name: 'Start a Call' })).toBeNull();
    await act(async () => answer({ call: meeting({ people: 0 }), started: true }));
    expect(await screen.findByRole('button', { name: 'Call' })).toBeTruthy();
  });

  it('is for an account only: a guest through a link sees no Call', async () => {
    render(<Editor signedIn={false} />);
    await flush();
    expect(screen.queryByRole('button', { name: 'Call' })).toBeNull();
    // Nor the popover, should anything ask for it.
    act(() => openCallChooser(null));
    await flush();
    expect(screen.queryByRole('heading', { name: 'Start a Call' })).toBeNull();
  });
});

describe('the pill', () => {
  it('shows who is in the call to a guest too, and Join brings back or opens the call’s tab', async () => {
    itemCalls.mockResolvedValue(reads(meeting()));
    render(<Editor signedIn={false} />);
    await flush();
    const tab = fakeTab(false);
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    fireEvent.click(screen.getByText('3 in Call'));
    expect(open).toHaveBeenCalledWith('', 'lw-call-D1');
    expect(tab.focus).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ItemCall');

    open.mockReturnValue(null);
    fireEvent.click(screen.getByText('3 in Call'));
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/blocked/));
  });

  it('is Call again while a just-started call has nobody in it', async () => {
    itemCalls.mockResolvedValue(reads(meeting({ people: 0, names: [] })));
    render(<Editor />);
    await flush();
    expect(screen.getByRole('button', { name: 'Call' })).toBeTruthy();
  });
});

describe('the tabs', () => {
  it('sends a blank tab on, and only focuses one already somewhere', () => {
    const blank = fakeTab(true);
    const open = vi.spyOn(window, 'open').mockReturnValue(blank as unknown as Window);
    expect(focusOrOpen('n', LINK)).toBe(true);
    expect(blank.location.href).toBe(ENTRY);
    const there = fakeTab(false);
    open.mockReturnValue(there as unknown as Window);
    expect(isBlank(there as unknown as Window)).toBe(false);
    expect(focusOrOpen('n', LINK)).toBe(true);
    expect(there.focus).toHaveBeenCalled();
    open.mockReturnValue(null);
    expect(focusOrOpen('n', LINK)).toBe(false);
  });
});

describe('Meetings', () => {
  it('opens from Tools with each call, its summary and plan, and Join on the live one', async () => {
    itemCalls.mockResolvedValue(
      reads(meeting(), [
        meeting(),
        meeting({
          id: 'ic_0',
          live: false,
          people: 0,
          startedAt: Date.now() - 3 * 86_400_000,
          endedAt: Date.now() - 3 * 86_400_000 + 25 * 60_000,
          summary: { title: 'Retro notes', link: 'https://kb/p1' },
          plan: { id: 'p1', title: 'Sprint', link: 'https://plan/p1' },
          you: true,
        }),
      ]),
    );
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByText('Tool Meetings'));
    expect(await screen.findByText('Meetings')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Meetings');
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('25 min')).toBeTruthy();
    expect(screen.getByText('Started by you')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Summary/ }).getAttribute('href')).toBe(
      'https://kb/p1',
    );
    expect(screen.getByRole('link', { name: /Sprint/ }).getAttribute('href')).toBe(
      'https://plan/p1',
    );
    const tab = fakeTab(true);
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(tab.location.href).toBe(ENTRY);
    fireEvent.click(screen.getByRole('link', { name: /Summary/ }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'MeetingSummary');
  });

  it('says when there are none yet', async () => {
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByText('Tool Meetings'));
    expect(await screen.findByText('No meetings yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /close/i })[0]!);
    await flush();
    expect(screen.queryByText('No meetings yet')).toBeNull();
  });

  it('words when, how long and who', () => {
    const now = new Date(2026, 10, 23, 15, 0).getTime();
    expect(meetingWhen(now - 3_600_000, now)).toMatch(/^Today, /);
    expect(meetingWhen(now - 86_400_000, now)).toMatch(/^Yesterday, /);
    expect(meetingWhen(now - 5 * 86_400_000, now)).not.toMatch(/^(Today|Yesterday)/);
    expect(meetingLength({ startedAt: 0, endedAt: null })).toBeNull();
    expect(meetingLength({ startedAt: 0, endedAt: 10_000 })).toBe('1 min');
    expect(meetingLength({ startedAt: 0, endedAt: 60 * 60_000 })).toBe('1 hr');
    expect(meetingLength({ startedAt: 0, endedAt: 65 * 60_000 })).toBe('1 hr 5 min');
    expect(meetingWho([])).toBe('Nobody joined');
    expect(meetingWho(['Ada'])).toBe('Ada');
    expect(meetingWho(['Ada', 'Ben'])).toBe('Ada and Ben');
    expect(meetingWho(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more');
  });
});
