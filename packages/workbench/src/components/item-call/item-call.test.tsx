// @vitest-environment jsdom
// Start a Call Here in the editor (liveworkspace/docs/specs/004-index/item-calls.md): the host names the item to the
// store, reads its calls once and again only on the room's word or the tab's return; Call (an account) starts the call
// in its own tab, opened in the press; "3 in Call" with Join (anyone who reads the item) brings the call's tab back or
// opens it; Meetings in Tools lists the calls. Nothing for a session that can't call, nor in livehuddle itself.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemCallsRead, ItemMeeting } from '@liveworkspace/index-client';

const { itemCalls, startItemCall, track, toastError, toastWarning, prefs } = vi.hoisted(() => ({
  itemCalls: vi.fn(),
  startItemCall: vi.fn(),
  track: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  prefs: { current: {} },
}));
vi.mock('../../lib/index-client', () => ({ indexClient: { itemCalls, startItemCall } }));
vi.mock('../../hooks/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: toastError, warning: toastWarning }),
}));
vi.mock('../../bindings', () => ({
  workbench: { track, readPreferences: () => prefs.current },
}));

import { emitSourceChanged } from '../sheet-links/sheet-link-signal';
import { useToolsDoorItems } from '../chrome/tools-door';
import { ItemCallButton, startCall } from './ItemCallButton';
import { canCall, ItemCallHost } from './ItemCallHost';
import { setCallSource } from './item-call-store';
import { focusOrOpen, isBlank, nameItemTab } from '@liveworkspace/index-client/browser';
import { meetingLength, meetingWhen, meetingWho } from './MeetingsDialog';

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
});

beforeEach(() => {
  itemCalls.mockResolvedValue(reads(null));
  window.name = '';
});

afterEach(() => {
  cleanup();
  act(() => setCallSource(null));
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

describe('Call', () => {
  it('opens the call’s tab in the press, then sends it to the call', async () => {
    const tab = fakeTab(true);
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    startItemCall.mockResolvedValue({ call: meeting({ people: 0 }), started: true });
    render(<Editor />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect(open).toHaveBeenCalledWith('', 'lw-call-D1');
    await flush();
    // No Calls Space chosen: nothing sent beside the item, as before the setting.
    expect(startItemCall).toHaveBeenCalledWith('D1', { code: 'link1' }, null);
    expect(tab.location.href).toBe(ENTRY);
    expect(tab.opener).toBeNull();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'ItemCall');
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it('starts the call in the chosen Calls Space, and says so when it was skipped', async () => {
    prefs.current = { callSpace: 'lh_room' };
    try {
      const open = vi.spyOn(window, 'open').mockReturnValue(fakeTab(true) as unknown as Window);
      startItemCall.mockResolvedValue({ call: meeting({ people: 0 }), started: true });
      render(<Editor />);
      await flush();
      fireEvent.click(screen.getByRole('button', { name: 'Call' }));
      await flush();
      expect(startItemCall).toHaveBeenLastCalledWith('D1', { code: 'link1' }, 'lh_room');
      expect(toastWarning).not.toHaveBeenCalled();

      open.mockReturnValue(fakeTab(true) as unknown as Window);
      startItemCall.mockResolvedValue({
        call: meeting({ people: 0 }),
        started: true,
        fallback: 'unavailable',
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Call' }));
      await flush();
      expect(toastWarning).toHaveBeenCalledWith(expect.stringMatching(/Settings › Calls/));
    } finally {
      prefs.current = {};
    }
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
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    await flush();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/blocked/));

    const tab = fakeTab(true);
    open.mockReturnValue(tab as unknown as Window);
    startItemCall.mockRejectedValue(new Error('503'));
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    await flush();
    expect(tab.close).toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/couldn’t start/));
    expect(track).toHaveBeenCalledWith('UI', 'Refused', 'ItemCall');
  });

  it('is for an account only: a guest through a link sees no Call', async () => {
    render(<Editor signedIn={false} />);
    await flush();
    expect(screen.queryByRole('button', { name: 'Call' })).toBeNull();
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
