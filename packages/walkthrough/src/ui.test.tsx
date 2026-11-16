// @vitest-environment jsdom
// The walkthroughs as an app mounts them (walkthroughs.md "The Walkthroughs menu", "Recording", "Playing"): the header
// button and its menu, recording from set-up to save with what is hidden kept out, and playing with the viewer's tab
// and view put back on close. Over a fake api, devices and recorder.
import type { WalkthroughEvents, WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalkthroughHost } from './host';
import type { CanvasView } from './timeline';
import { shiftClearOf } from './ui/Bubble';
import { WalkthroughsButton } from './ui/WalkthroughsButton';
import { WalkthroughsLayer } from './ui/WalkthroughsLayer';
import { useWalkthroughs } from './useWalkthroughs';

const W: WalkthroughSummary = {
  id: 'w1',
  title: 'Tour',
  author: 'Ada',
  durationMs: 64_000,
  mediaType: 'audio/webm',
  mediaBytes: 3,
  camera: false,
  createdAt: Date.now() - 2 * 86_400_000,
  mine: false,
  canDelete: true,
};

const EVENTS: WalkthroughEvents = {
  v: 1,
  durationMs: 64_000,
  camera: false,
  corner: 'bottom-right',
  startTab: 't2',
  hidden: ['secret'],
  fingerprints: { t2: 'old' },
  events: [{ t: 0, k: 'view', cx: 5, cy: 5, zoom: 2, w: 100, h: 100 }],
};

type Server = {
  list: WalkthroughSummary[];
  canRecord: boolean;
  requests: { url: string; init?: RequestInit }[];
};

function fakeFetch(server: Server) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    server.requests.push({ url, init });
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
      server.list = server.list.filter((w) => !url.includes(`/${w.id}?`));
      return Response.json({ ok: true });
    }
    if (method === 'POST')
      return Response.json({ walkthrough: { ...W, id: 'new' } }, { status: 201 });
    if (method === 'PUT') {
      const saved = { ...W, id: 'new', title: 'Mine', mine: true };
      server.list = [saved, ...server.list];
      return Response.json({ walkthrough: saved });
    }
    if (url.includes('/media')) return new Response(new Uint8Array([1, 2, 3]));
    if (url.includes('/w1?')) return Response.json({ walkthrough: W, events: EVENTS });
    return Response.json({ walkthroughs: server.list, canRecord: server.canRecord });
  });
}

let view: CanvasView;
const setView = vi.fn((v: CanvasView) => {
  view = v;
});

function Harness({ server, initialTab = 't1' }: { server: Server; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [fetch] = useState(() => fakeFetch(server));
  const host: WalkthroughHost = {
    itemId: 'doc',
    api: useState(() => ({ base: '/api', fetch }))[0],
    viewport: { get: () => view, subscribe: () => () => undefined, setView },
    canvasRoot: () => document.getElementById('canvas-root'),
    tab,
    tabName: (t) => `Tab ${t}`,
    showTab: (t) => {
      setTab(t);
      return true;
    },
    fingerprint: (t) => (t === 't2' ? 'new' : 'same'),
    selection: () => ['sel1', 'sel2'],
    author: 'Grace',
  };
  const walkthroughs = useWalkthroughs(host);
  return (
    <>
      <span data-testid="tab">{tab}</span>
      <WalkthroughsButton menu={walkthroughs.menu} />
      <div id="canvas-root" style={{ position: 'relative' }}>
        <div data-canvas-content="">
          <div data-element-id="e1" />
        </div>
        <WalkthroughsLayer walkthroughs={walkthroughs} />
      </div>
    </>
  );
}

beforeEach(() => {
  view = { zoom: 1, offset: { x: 0, y: 0 } };
  setView.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
  );
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the header button', () => {
  it('is not there for someone with nothing to play and nothing to record', async () => {
    render(<Harness server={{ list: [], canRecord: false, requests: [] }} />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /Walkthroughs/ })).toBeNull();
  });

  it('counts the walkthroughs and lists them, with who and when', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    const button = await screen.findByRole('button', { name: /Walkthroughs/ });
    fireEvent.click(button);
    const menu = screen.getByRole('dialog', { name: 'Walkthroughs' });
    expect(menu.textContent).toContain('Tour');
    expect(menu.textContent).toContain('1:04 · Ada · 2 days ago');
    expect(screen.queryByText('Record Walkthrough')).toBeNull();
  });

  it('shows an Editor the empty state and Record Walkthrough', async () => {
    render(<Harness server={{ list: [], canRecord: true, requests: [] }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Walkthroughs/ }));
    expect(screen.getByText('No Walkthroughs Yet')).toBeTruthy();
    expect(screen.getByText('Record Walkthrough')).toBeTruthy();
  });

  it('deletes a walkthrough after asking', async () => {
    const server: Server = { list: [W], canRecord: true, requests: [] };
    render(<Harness server={server} />);
    fireEvent.click(await screen.findByRole('button', { name: /Walkthroughs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Tour')).toBeNull());
    expect(server.requests.at(-1)).toMatchObject({ url: '/api/walkthroughs/w1?d=doc' });
  });
});

describe('playing', () => {
  it('plays over the canvas, hides what was hidden, says it was edited, and puts the viewer back', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Walkthroughs/ }));
    fireEvent.click(screen.getByText('Tour'));
    await screen.findByRole('region', { name: 'Walkthrough: Tour' });
    // The recording's tab, its hidden element hidden.
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('t2'));
    expect(
      document.head.querySelector('[data-walkthrough-hidden="viewer"]')?.textContent,
    ).toContain('"secret"');
    expect(
      screen.getByText('Edited since recording. It plays over the canvas as it is now.'),
    ).toBeTruthy();
    // The speed steps round.
    fireEvent.click(screen.getByRole('button', { name: 'Speed 1x' }));
    expect(screen.getByRole('button', { name: 'Speed 1.5x' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close walkthrough' }));
    await waitFor(() => expect(screen.getByTestId('tab').textContent).toBe('t1'));
    expect(document.head.querySelector('[data-walkthrough-hidden]')).toBeNull();
    await waitFor(() =>
      expect(setView).toHaveBeenLastCalledWith({ zoom: 1, offset: { x: 0, y: 0 } }),
    );
  });

  it('pauses when the viewer looks around, and resumes', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Walkthroughs/ }));
    fireEvent.click(screen.getByText('Tour'));
    const audio = await waitFor(() => {
      const found = document.querySelector('audio');
      if (!found) throw new Error('no audio yet');
      return found;
    });
    fireEvent.play(audio);
    await screen.findByRole('button', { name: 'Pause' });
    fireEvent.pointerDown(document.querySelector('[data-element-id="e1"]')!);
    fireEvent.pause(audio);
    expect(await screen.findByText('Paused. Look around, then Resume.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByText('Paused. Look around, then Resume.')).toBeNull();
  });
});

describe('recording', () => {
  class FakeRecorder {
    static isTypeSupported = (t: string) => t === 'audio/webm';
    state = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {
      this.state = 'recording';
    }
    stop() {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(4)]) });
      this.state = 'inactive';
      this.onstop?.();
    }
  }

  it('sets up, counts down, records, keeps hidden elements out and saves', async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
      getAudioTracks: () => [{}],
      getVideoTracks: () => [],
    };
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal(
      'AudioContext',
      class {
        createAnalyser() {
          return { fftSize: 0, getFloatTimeDomainData: () => undefined };
        }
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        close() {
          return Promise.resolve();
        }
      },
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => stream),
        enumerateDevices: async () => [],
      },
    });
    const server: Server = { list: [], canRecord: true, requests: [] };
    render(<Harness server={server} />);
    fireEvent.click(await screen.findByRole('button', { name: /Walkthroughs/ }));
    fireEvent.click(screen.getByText('Record Walkthrough'));
    await screen.findByRole('region', { name: 'Record a Walkthrough' });
    const startButton = await screen.findByRole('button', { name: /Start Recording/ });
    await waitFor(() => expect((startButton as HTMLButtonElement).disabled).toBe(false));

    // Hide an element by pressing it, and the selection.
    fireEvent.click(screen.getByRole('button', { name: /Hide From Recording/ }));
    fireEvent.pointerDown(document.querySelector('[data-element-id="e1"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Selection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      document.head.querySelector('[data-walkthrough-hidden="presenter"]')?.textContent,
    ).toContain('"sel2"');

    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    fireEvent.click(screen.getByRole('button', { name: /Start Recording/ }));
    expect(screen.getByText('Recording starts in 3')).toBeTruthy();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByRole('region', { name: 'Recording' })).toBeTruthy();
    // A press on a hidden element is not written down; one on another is.
    fireEvent.pointerDown(document.querySelector('[data-element-id="e1"]')!);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    const title = (await screen.findByRole('textbox')) as HTMLInputElement;
    expect(title.value).toBe('Walkthrough of Tab t1');
    expect(stop).toHaveBeenCalled();
    fireEvent.change(title, { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved “Mine”.');
    const start = server.requests.find((r) => r.init?.method === 'POST')!;
    const body = JSON.parse(String(start.init!.body)) as {
      title: string;
      author: string;
      events: WalkthroughEvents;
    };
    expect(body).toMatchObject({ title: 'Mine', author: 'Grace' });
    expect(body.events.hidden.sort()).toEqual(['e1', 'sel1', 'sel2']);
    expect(body.events.events.some((e) => e.k === 'point')).toBe(false);
    expect(body.events.fingerprints).toEqual({ t1: 'same' });
    expect(document.head.querySelector('[data-walkthrough-hidden]')).toBeNull();
  });

  it('says so when the microphone is refused', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (c: MediaStreamConstraints) => {
          throw new DOMException('no', c.video ? 'NotReadableError' : 'NotAllowedError');
        }),
        enumerateDevices: async () => [],
      },
    });
    render(<Harness server={{ list: [], canRecord: true, requests: [] }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Walkthroughs/ }));
    fireEvent.click(screen.getByText('Record Walkthrough'));
    expect(
      await screen.findByText(
        'Allow the microphone for this site in your browser, then try again.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Record a Walkthrough' })).toBeNull();
  });
});

describe('the bubble', () => {
  const frame = { left: 0, top: 0, right: 1000, bottom: 800 };
  const none = { map: null, sidebar: null };
  it('stays clear of the Map and a docked Contents sidebar', () => {
    expect(shiftClearOf('bottom-left', frame, none)).toEqual({ x: 0, y: 0 });
    // A Map in another corner leaves it put.
    const farMap = { left: 740, top: 560, right: 996, bottom: 796 };
    expect(shiftClearOf('bottom-left', frame, { map: farMap, sidebar: null })).toEqual({
      x: 0,
      y: 0,
    });
    // The Map in its corner: up above it, with room between.
    const map = { left: 4, top: 560, right: 260, bottom: 796 };
    expect(shiftClearOf('bottom-left', frame, { map, sidebar: null })).toEqual({
      x: 0,
      y: -(800 - 64 - 560 + 12),
    });
    // A Map in a top corner: down below it.
    const topMap = { left: 740, top: 4, right: 996, bottom: 200 };
    expect(shiftClearOf('top-right', frame, { map: topMap, sidebar: null })).toEqual({
      x: 0,
      y: 200 + 12 - 16,
    });
    // A sidebar down the left: across past it, and then clear of a Map beside it too.
    const sidebar = { left: 0, top: 0, right: 236, bottom: 800 };
    expect(shiftClearOf('bottom-left', frame, { map: null, sidebar })).toEqual({
      x: 236 + 12 - 16,
      y: 0,
    });
    const besideMap = { left: 252, top: 600, right: 508, bottom: 796 };
    expect(shiftClearOf('bottom-left', frame, { map: besideMap, sidebar }).y).toBe(
      600 - 12 - (800 - 64),
    );
    // A right corner ignores a left sidebar.
    expect(shiftClearOf('bottom-right', frame, { map: null, sidebar })).toEqual({ x: 0, y: 0 });
  });
});
