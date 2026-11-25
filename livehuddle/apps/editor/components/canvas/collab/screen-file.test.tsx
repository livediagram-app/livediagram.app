// @vitest-environment jsdom

// A file on a Screen (docs/specs/009-elements/screen-and-room-sign.md "A file on the Screen", Work Tracker 1427): the
// title card for everyone, the live frame only for someone standing in the Screen's room, the viewer's own access
// asked every time, a lock without it, and the file opened large with Show This Tab on the Screen for an Editor.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ScreenFile, type ShapeElement } from '@livehuddle/document';
import type { LiveEmbedTicket } from '@liveworkspace/workbench/components/live-embed/live-embed-ticket';
import { resetMeetingLive, setMeetingLive } from '@/lib/office/meeting-live';
import { SELF_MEDIA_ID } from '@/lib/calls/calls-media-store';
import { ScreenFileFace } from './ScreenFileFace';
import { ScreenFileOverlay } from './ScreenFileOverlay';
import { ScreenFileOverlayHost } from './ScreenFileOverlayHost';
import { ScreenView } from './ScreenView';

const ticket = vi.hoisted(() => ({
  answer: null as unknown as LiveEmbedTicket,
  asked: [] as { itemId: string; tabId?: string }[],
}));
vi.mock('@liveworkspace/workbench/components/live-embed/live-embed-ticket', () => ({
  requestLiveEmbedTicket: async (
    item: { itemId: string },
    _origin?: string,
    tabId?: string,
  ): Promise<LiveEmbedTicket> => {
    ticket.asked.push({ itemId: item.itemId, ...(tabId ? { tabId } : {}) });
    return ticket.answer;
  },
}));
// On screen and given a place whenever it is wanted: the slot's own rules are the workbench's to test.
vi.mock('@liveworkspace/workbench/components/live-embed/useLiveEmbedSlot', () => ({
  useLiveEmbedSlot: (_ref: unknown, wanted: boolean) => wanted,
}));
const auth = vi.hoisted(() => ({ isSignedIn: true }));
vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => auth,
}));
let editor: unknown = null;
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => editor,
}));

const OK: LiveEmbedTicket = {
  ok: true,
  ticket: 't.1',
  path: '/embed/workbench?d=P1',
  expiresAt: 1,
};
const FILE: ScreenFile = {
  liveItem: { app: 'liveplanner', itemId: 'P1' },
  liveName: 'Launch Plan',
};

beforeEach(() => {
  ticket.answer = OK;
  ticket.asked = [];
  auth.isSignedIn = true;
});

afterEach(() => {
  cleanup();
  editor = null;
  act(() => resetMeetingLive());
});

describe("a file on the Screen's wall", () => {
  it('is a title card alone, asking nothing, for someone outside the room', () => {
    const { container } = render(<ScreenFileFace file={FILE} inRoom={false} paused={false} />);
    expect(screen.getByText('Launch Plan')).toBeTruthy();
    expect(screen.getByText('liveplanner')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeNull();
    expect(ticket.asked).toEqual([]);
  });

  it('frames the file at a desktop width, scaled and inert, for someone in the room', async () => {
    // A 640 by 400 panel (jsdom lays nothing out).
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
    const { container } = render(<ScreenFileFace file={FILE} inRoom paused={false} />);
    await waitFor(() => expect(container.querySelector('iframe')).toBeTruthy());
    expect(ticket.asked).toEqual([{ itemId: 'P1' }]);
    const frame = container.querySelector('iframe')!;
    expect(frame.style.width).toBe('1280px');
    expect(frame.style.height).toBe('800px');
    expect(frame.style.transform).toBe('scale(0.5)');
    expect(frame.className).toContain('pointer-events-none');
    vi.restoreAllMocks();
  });

  it('opens on the Screen’s tab, and gives the frame up while the Screen is open large', async () => {
    const { container, rerender } = render(
      <ScreenFileFace
        file={{ ...FILE, liveTab: { id: 't2', name: 'Roadmap' } }}
        inRoom
        paused={false}
      />,
    );
    await waitFor(() => expect(ticket.asked).toEqual([{ itemId: 'P1', tabId: 't2' }]));
    expect(screen.getByText('liveplanner · Roadmap')).toBeTruthy();
    rerender(
      <ScreenFileFace file={{ ...FILE, liveTab: { id: 't2', name: 'Roadmap' } }} inRoom paused />,
    );
    await waitFor(() => expect(container.querySelector('[data-screen-file="idle"]')).toBeTruthy());
  });

  it('shows a lock, and never the file, to someone without access', async () => {
    ticket.answer = { ok: false, reason: 'no-access' };
    const { container } = render(<ScreenFileFace file={FILE} inRoom paused={false} />);
    expect(await screen.findByText('No Access')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('the Screen with a file', () => {
  const screenEl = {
    ...createShape('screen', 0, 0),
    id: 's1',
    ...FILE,
  } as ShapeElement;

  it('asks for a frame only once you stand in its room, and opens the file large on a press', async () => {
    const { container } = render(<ScreenView element={screenEl} />);
    expect(container.querySelector('[data-screen-face="file"]')).toBeTruthy();
    expect(ticket.asked).toEqual([]);
    act(() =>
      setMeetingLive(
        new Map([['s1', { roomId: 'r1', inside: [{ id: SELF_MEDIA_ID, name: null }] }]]),
      ),
    );
    await waitFor(() => expect(ticket.asked).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Open Launch Plan' }));
    expect(await screen.findByRole('dialog', { name: 'Launch Plan on the Screen' })).toBeTruthy();
  });

  it('closes the file opened large when the file goes, and never reopens it by itself', async () => {
    const { rerender } = render(<ScreenView element={screenEl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Launch Plan' }));
    expect(await screen.findByRole('dialog', { name: 'Launch Plan on the Screen' })).toBeTruthy();
    // An Editor clears the Screen while it is open large (or a share in its room takes it over)...
    const cleared = { ...screenEl, liveItem: undefined, liveName: undefined } as ShapeElement;
    rerender(<ScreenView element={cleared} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    // ...and later puts a file on it again: the Screen waits for a press, as it did before.
    rerender(<ScreenView element={screenEl} />);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a new file afresh when an Editor changes the file while it is open large', async () => {
    const { rerender } = render(
      <ScreenView element={{ ...screenEl, liveTab: { id: 't2', name: 'Roadmap' } }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Launch Plan' }));
    await waitFor(() => expect(ticket.asked).toContainEqual({ itemId: 'P1', tabId: 't2' }));
    const other = {
      ...screenEl,
      liveItem: { app: 'livedocuments', itemId: 'D1' },
      liveName: 'Brief',
    } as ShapeElement;
    rerender(<ScreenView element={other} />);
    // The new file opens on its own first tab, never on the old file's tab.
    await waitFor(() => expect(ticket.asked).toContainEqual({ itemId: 'D1' }));
    expect(ticket.asked).not.toContainEqual({ itemId: 'D1', tabId: 't2' });
  });

  it('shows a share in its room over its file', () => {
    // A share is received only with a stream; with none, the file stays.
    render(<ScreenView element={screenEl} />);
    expect(screen.getByRole('button', { name: 'Open Launch Plan' })).toBeTruthy();
  });
});

describe('the file opened large', () => {
  // The frame shows once its ticket lands, and the frame's message listener attaches in the effect after: wait for
  // both, or a message sent under a slow runner (CI with coverage) is dropped before anyone listens.
  const framed = async () => {
    await waitFor(() => expect(document.querySelector('iframe')).toBeTruthy());
    await act(async () => {});
  };
  const say = (data: unknown) =>
    act(() => {
      const frame = document.querySelector('iframe')!;
      window.dispatchEvent(
        new MessageEvent('message', {
          data,
          origin: 'https://www.liveplanner.app',
          source: frame.contentWindow,
        }),
      );
    });

  beforeEach(() => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      host: 'www.livehuddle.app',
      origin: 'https://www.livehuddle.app',
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('frames the file taking the pointer, with Open in its app in a new tab', async () => {
    render(
      <ScreenFileOverlay file={FILE} canShowTab={false} onShowTab={vi.fn()} onClose={vi.fn()} />,
    );
    await framed();
    const frame = document.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe(
      'https://www.liveplanner.app/embed/workbench?d=P1&live=1#ticket=t.1',
    );
    expect(frame.className).not.toContain('pointer-events-none');
    const open = screen.getByRole('link', { name: 'Open in liveplanner' });
    expect(open.getAttribute('target')).toBe('_blank');
    expect(open.getAttribute('href')).toContain('https://www.liveplanner.app/');
  });

  it('offers an Editor the tab the frame moved to, and nobody else', async () => {
    const onShowTab = vi.fn();
    const { rerender } = render(
      <ScreenFileOverlay file={FILE} canShowTab onShowTab={onShowTab} onClose={vi.fn()} />,
    );
    await framed();
    say({ type: 'liveplanner:ready', v: 1, tabId: 't1', tabName: 'Board' });
    expect(screen.queryByRole('button', { name: /Show This Tab/ })).toBeNull();
    say({ type: 'liveplanner:tab', v: 1, tabId: 't2', tabName: 'Roadmap' });
    fireEvent.click(await screen.findByRole('button', { name: /Show This Tab|On the Screen/ }));
    expect(onShowTab).toHaveBeenCalledWith({ id: 't2', name: 'Roadmap' });
    rerender(
      <ScreenFileOverlay file={FILE} canShowTab={false} onShowTab={onShowTab} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Show This Tab|On the Screen/ })).toBeNull();
  });

  it("puts the tab on this Screen through the editor's patch, an Editor's alone", async () => {
    const setScreenSourceOf = vi.fn();
    editor = { can: { level: 'edit' }, setScreenSourceOf };
    render(<ScreenFileOverlayHost elementId="s1" file={FILE} onClose={vi.fn()} />);
    await framed();
    say({ type: 'liveplanner:ready', v: 1, tabId: 't1', tabName: 'Board' });
    say({ type: 'liveplanner:tab', v: 1, tabId: 't2', tabName: 'Roadmap' });
    fireEvent.click(await screen.findByRole('button', { name: /Show This Tab|On the Screen/ }));
    expect(setScreenSourceOf).toHaveBeenCalledWith('s1', {
      kind: 'file',
      ...FILE,
      liveTab: { id: 't2', name: 'Roadmap' },
    });
    cleanup();
    editor = { can: { level: 'participate' }, setScreenSourceOf };
    render(<ScreenFileOverlayHost elementId="s1" file={FILE} onClose={vi.fn()} />);
    await framed();
    say({ type: 'liveplanner:ready', v: 1, tabId: 't1', tabName: 'Board' });
    say({ type: 'liveplanner:tab', v: 1, tabId: 't2', tabName: 'Roadmap' });
    expect(screen.queryByRole('button', { name: /Show This Tab|On the Screen/ })).toBeNull();
  });

  it('locks a viewer without access, with Request Access when signed in', async () => {
    ticket.answer = { ok: false, reason: 'no-access' };
    render(
      <ScreenFileOverlay file={FILE} canShowTab={false} onShowTab={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByText("You don't have access to Launch Plan.")).toBeTruthy();
    expect(screen.getByRole('button', { name: /Request Access/ })).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
    cleanup();
    auth.isSignedIn = false;
    render(
      <ScreenFileOverlay file={FILE} canShowTab={false} onShowTab={vi.fn()} onClose={vi.fn()} />,
    );
    await screen.findByText("You don't have access to Launch Plan.");
    expect(screen.queryByRole('button', { name: /Request Access/ })).toBeNull();
  });

  it('says a file is gone, and offers Try Again after a failure', async () => {
    ticket.answer = { ok: false, reason: 'gone' };
    render(
      <ScreenFileOverlay file={FILE} canShowTab={false} onShowTab={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByText('This file is no longer there.')).toBeTruthy();
    cleanup();
    ticket.answer = { ok: false, reason: 'failed' };
    render(
      <ScreenFileOverlay file={FILE} canShowTab={false} onShowTab={vi.fn()} onClose={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(ticket.asked.length).toBeGreaterThanOrEqual(2));
  });
});
