// @vitest-environment jsdom
// The walkthroughs as an app mounts them (walkthroughs.md "In Tools", "Recording", "Playing"): the row in the footer's
// Tools and its panel, recording from set-up to save with what is hidden kept out, and playing with the viewer's tab
// and view put back on close. Over a fake api, devices and recorder.
import type { WalkthroughEvents, WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import {
  configureWorkbench,
  resetWorkbenchForTests,
  type WorkbenchTrack,
} from '@liveworkspace/workbench/bindings';
import { ChromeToolsMenu } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { testBindings } from '@liveworkspace/workbench/lib/testing/bindings';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalkthroughHideable, WalkthroughHost } from './host';
import { CAMERA_ON_KEY } from './useRecorder';
import type { CanvasView } from './timeline';
import { shiftClearOf, VoiceChip } from './ui/Bubble';
import { WalkthroughsTools } from './ui/WalkthroughsTools';
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
  screen: false,
  shareCode: null,
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
  // The api's refusal of a save's first step, as its body says.
  refuse?: { status: number; error: string };
  // The media part, held by the test: told how to report its bytes sent, it answers when the test says.
  upload?: (report: (sent: number, total: number) => void) => Promise<Response>;
};

// What the editor's `track` was handed (the workbench binding), for the telemetry the walkthroughs count.
const track = vi.fn<WorkbenchTrack>();
const counted = () => track.mock.calls.map(([category, action, type]) => [category, action, type]);

function fakeFetch(server: Server) {
  return vi.fn(
    async (
      url: string,
      init?: RequestInit,
      opts?: { uploadProgress?: (sent: number, total: number) => void },
    ) => {
      server.requests.push({ url, init });
      const method = init?.method ?? 'GET';
      if (method === 'DELETE') {
        server.list = server.list.filter((w) => !url.includes(`/${w.id}?`));
        return Response.json({ ok: true });
      }
      if (method === 'POST' && server.refuse) {
        return Response.json({ error: server.refuse.error }, { status: server.refuse.status });
      }
      if (method === 'POST')
        return Response.json({ walkthrough: { ...W, id: 'new' } }, { status: 201 });
      if (method === 'PUT' && server.upload) return server.upload(opts!.uploadProgress!);
      if (method === 'PUT') {
        const saved = { ...W, id: 'new', title: 'Mine', mine: true };
        server.list = [saved, ...server.list];
        return Response.json({ walkthrough: saved });
      }
      if (url.includes('/media')) return new Response(new Uint8Array([1, 2, 3]));
      if (url.includes('/w1?')) return Response.json({ walkthrough: W, events: EVENTS });
      return Response.json({ walkthroughs: server.list, canRecord: server.canRecord });
    },
  );
}

let view: CanvasView;
const setView = vi.fn((v: CanvasView) => {
  view = v;
});

function Harness({
  server,
  initialTab = 't1',
  hideable,
}: {
  server: Server;
  initialTab?: string;
  hideable?: WalkthroughHideable;
}) {
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
    hideable,
  };
  const walkthroughs = useWalkthroughs(host);
  return (
    <>
      <span data-testid="tab">{tab}</span>
      <ChromeToolsMenu items={[]} />
      <WalkthroughsTools walkthroughs={walkthroughs} />
      <div id="canvas-root" style={{ position: 'relative' }}>
        <div data-canvas-content="">
          <div data-element-id="e1" />
        </div>
        {/* A Board or Dashboard tab drawn over the canvas, outside its content (liveplanner's). */}
        <div data-canvas-cover="">
          <div data-plan-card="card1">
            <span data-testid="card1-face" />
          </div>
          <div data-dashboard-slot="slot1">
            <span data-testid="slot1-face" />
          </div>
        </div>
        <WalkthroughsLayer walkthroughs={walkthroughs} />
      </div>
    </>
  );
}

beforeEach(() => {
  track.mockClear();
  configureWorkbench(testBindings({ track }));
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
  resetWorkbenchForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Opens the footer's Tools, then its Walkthroughs row, which opens inside Tools (walkthroughs.md "In Tools").
async function openWalkthroughs() {
  fireEvent.click(await screen.findByRole('button', { name: /^Tools/ }));
  const row = document.querySelector<HTMLElement>('[data-tools-item="walkthroughs"]');
  if (!row) throw new Error('no Walkthroughs row in Tools');
  fireEvent.click(row);
  return screen.getByRole('dialog', { name: 'Tools, Walkthroughs' });
}

describe('the Walkthroughs row in Tools', () => {
  it('is not there for someone with nothing to play and nothing to record, nor is an empty Tools', async () => {
    render(<Harness server={{ list: [], canRecord: false, requests: [] }} />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /^Tools/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Walkthroughs/ })).toBeNull();
  });

  it('sits under Collaborate with its count, puts no dot on Tools, and has no header button', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    const tools = await screen.findByRole('button', { name: 'Tools' });
    expect(document.querySelector('[data-tools-attention]')).toBeNull();
    expect(document.querySelector('[data-walkthroughs-button]')).toBeNull();
    fireEvent.click(tools);
    const row = document.querySelector<HTMLElement>(
      '[data-tools-group="collaborate"] [data-tools-item="walkthroughs"]',
    );
    expect(row?.textContent).toContain('Walkthroughs');
    expect(row?.textContent).toContain('Play a recorded talk-through.');
    expect(row?.textContent).toContain('1');
  });

  it('counts the walkthroughs and lists them, with who and when', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    const menu = await openWalkthroughs();
    expect(menu.querySelector('[data-tools-view="walkthroughs"]')).toBeTruthy();
    expect(menu.textContent).toContain('Tour');
    expect(menu.textContent).toContain('1:04 · Ada · 2 days ago');
    expect(screen.queryByText('Record Walkthrough')).toBeNull();
  });

  it('shows an Editor the empty state and Record Walkthrough, whose set-up opens in Tools', async () => {
    render(<Harness server={{ list: [], canRecord: true, requests: [] }} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Tools/ }));
    expect(document.querySelector('[data-tools-item="walkthroughs"]')?.textContent).toContain(
      'Record yourself talking through it.',
    );
    fireEvent.click(document.querySelector<HTMLElement>('[data-tools-item="walkthroughs"]')!);
    expect(screen.getByText('No Walkthroughs Yet')).toBeTruthy();
    fireEvent.click(screen.getByText('Record Walkthrough'));
    expect(await screen.findByRole('region', { name: 'Record a Walkthrough' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: /^Tools/ })).toBeTruthy();
    // Leaving the page lets the set-up go.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Record a Walkthrough' })).toBeNull(),
    );
  });

  it('steps back to the Tools list on Escape, then closes', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    await openWalkthroughs();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Tools' })).toBeTruthy());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Tools/ })).toBeNull());
  });

  it('deletes a walkthrough after asking', async () => {
    const server: Server = { list: [W], canRecord: true, requests: [] };
    render(<Harness server={server} />);
    await openWalkthroughs();
    // The ⋯ inside the row opens its menu: Rename, then Delete, which asks first.
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Tour' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Tour')).toBeNull());
    expect(server.requests.at(-1)).toMatchObject({ url: '/api/walkthroughs/w1?d=doc' });
    expect(counted()).toEqual([['Walkthrough', 'Deleted', undefined]]);
  });
});

describe('playing', () => {
  it('plays over the canvas, hides what was hidden, says it was edited, and puts the viewer back', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    await openWalkthroughs();
    fireEvent.click(screen.getByText('Tour'));
    await screen.findByRole('region', { name: 'Walkthrough: Tour' });
    expect(counted()).toEqual([['Walkthrough', 'Played', undefined]]);
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
    await openWalkthroughs();
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

  it('plays sound alone with the small voice chip, never a camera-sized frame', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    await openWalkthroughs();
    fireEvent.click(screen.getByText('Tour'));
    const chip = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-walkthrough-voice="bottom-right"]');
      if (!found) throw new Error('no voice chip yet');
      return found;
    });
    expect(document.querySelector('[data-walkthrough-bubble]')).toBeNull();
    expect(chip.textContent).toBe('AAda');
    expect(chip.className).toContain('h-10');
    const bars = chip.querySelector<HTMLElement>('[data-voice-bars]')!;
    expect(bars.dataset.voiceBars).toBe('resting');
    fireEvent.play(document.querySelector('audio')!);
    await waitFor(() => expect(bars.dataset.voiceBars).toBe('moving'));
    expect(bars.querySelector<HTMLElement>('span')!.style.animation).toContain('walkthrough-voice');
    fireEvent.pause(document.querySelector('audio')!);
    await waitFor(() => expect(bars.dataset.voiceBars).toBe('resting'));
    expect(bars.querySelector<HTMLElement>('span')!.style.animation).toBe('');
  });
});

// The stream filmed: the shared tab's video beside the microphone (jsdom has no MediaStream).
class FakeMediaStream {
  readonly tracks: unknown[];
  constructor(tracks: unknown[]) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
}
beforeEach(() => vi.stubGlobal('MediaStream', FakeMediaStream));

// The tab the browser shares: a video track that can end (the browser's own Stop Sharing).
function displayStream() {
  const listeners: (() => void)[] = [];
  const track = {
    stop: vi.fn(),
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    end: () => listeners.forEach((fn) => fn()),
  };
  return {
    track,
    stream: { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] },
  };
}

describe('recording', () => {
  class FakeRecorder {
    static isTypeSupported = (t: string) => t === 'audio/webm' || t.startsWith('video/webm');
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

  it('sets up, asks to share the tab, counts down, records and saves itself', async () => {
    const stop = vi.fn();
    const display = displayStream();
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
        getDisplayMedia: vi.fn(async () => display.stream),
        enumerateDevices: async () => [],
      },
    });
    const server: Server = { list: [], canRecord: true, requests: [] };
    render(<Harness server={server} />);
    await openWalkthroughs();
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
    // The browser's share prompt is asked inside the press; the count starts once the tab is shared.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start Recording/ }));
    });
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({ preferCurrentTab: true, video: expect.anything() }),
    );
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
    // Finish saves it at once under its default name: no naming step (owner, 2026-11-17).
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    // Tools closed for the count, so the save shows as its requests: the start, then the media.
    await waitFor(() => expect(server.requests.some((r) => r.init?.method === 'PUT')).toBe(true));
    expect(stop).toHaveBeenCalled();
    expect(display.track.stop).toHaveBeenCalled();
    const start = server.requests.find((r) => r.init?.method === 'POST')!;
    const body = JSON.parse(String(start.init!.body)) as {
      title: string;
      author: string;
      events: WalkthroughEvents;
    };
    expect(body).toMatchObject({ title: 'Walkthrough of Tab t1', author: 'Grace' });
    // A film of the tab: nothing to replay, and the hidden were never on screen while it filmed.
    expect(body.events).toMatchObject({ screen: true, hidden: [], events: [], fingerprints: {} });
    expect(document.head.querySelector('[data-walkthrough-hidden]')).toBeNull();
    // Started once recording began, Created once saved: no title, id or length with either.
    expect(counted()).toEqual([
      ['Walkthrough', 'Started', undefined],
      ['Walkthrough', 'Created', undefined],
    ]);
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
    await openWalkthroughs();
    fireEvent.click(screen.getByText('Record Walkthrough'));
    expect(
      await screen.findByText(
        'Allow the microphone for this site in your browser, then try again.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Record a Walkthrough' })).toBeNull();
  });

  it.each(['permissionsPolicy', 'featurePolicy'])(
    'says the page cannot use the microphone when %s blocks it',
    async (prop) => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: vi.fn(async () => {
            throw new DOMException('no', 'NotAllowedError');
          }),
          enumerateDevices: async () => [],
        },
      });
      Object.defineProperty(document, prop, {
        configurable: true,
        value: { allowsFeature: (f: string) => f !== 'microphone' },
      });
      try {
        render(<Harness server={{ list: [], canRecord: true, requests: [] }} />);
        await openWalkthroughs();
        fireEvent.click(screen.getByText('Record Walkthrough'));
        expect(
          await screen.findByText(
            "This page can't use the microphone. Reload to get the latest version.",
          ),
        ).toBeTruthy();
      } finally {
        Reflect.deleteProperty(document, prop);
      }
    },
  );

  it('falls back to the browser prompt when the policy cannot be read', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException('no', 'NotAllowedError');
        }),
        enumerateDevices: async () => [],
      },
    });
    Object.defineProperty(document, 'permissionsPolicy', {
      configurable: true,
      get: () => {
        throw new Error('nope');
      },
    });
    try {
      render(<Harness server={{ list: [], canRecord: true, requests: [] }} />);
      await openWalkthroughs();
      fireEvent.click(screen.getByText('Record Walkthrough'));
      expect(
        await screen.findByText(
          'Allow the microphone for this site in your browser, then try again.',
        ),
      ).toBeTruthy();
    } finally {
      Reflect.deleteProperty(document, 'permissionsPolicy');
    }
  });
});

describe('recording, beyond the canvas', () => {
  class FakeRecorder {
    static isTypeSupported = (t: string) => t === 'audio/webm' || t.startsWith('video/webm');
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
  const stream = (video = false) => ({
    getTracks: () => [{ stop: () => undefined }],
    getAudioTracks: () => [{}],
    getVideoTracks: () => (video ? [{}] : []),
  });
  // The browser's devices, answering every ask with a stream (with video when asked for it), or as `answer` says.
  function stubDevices(answer?: (c: MediaStreamConstraints) => Promise<unknown>) {
    const getUserMedia = vi.fn(answer ?? (async (c: MediaStreamConstraints) => stream(!!c.video)));
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
        getUserMedia,
        getDisplayMedia: vi.fn(async () => displayStream().stream),
        enumerateDevices: async () => [],
      },
    });
    return getUserMedia;
  }
  async function openDock(props: { hideable?: WalkthroughHideable } = {}) {
    const server: Server = { list: [], canRecord: true, requests: [] };
    render(<Harness server={server} {...props} />);
    await openWalkthroughs();
    fireEvent.click(screen.getByText('Record Walkthrough'));
    await screen.findByRole('region', { name: 'Record a Walkthrough' });
    const start = await screen.findByRole('button', { name: /Start Recording/ });
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
    return server;
  }
  const board = (over: Partial<WalkthroughHideable> = {}): WalkthroughHideable => ({
    marks: ['data-plan-card', 'data-dashboard-slot'],
    canHide: () => true,
    selection: () => ['card2'],
    ...over,
  });
  const presenterCss = () =>
    document.head.querySelector('[data-walkthrough-hidden="presenter"]')?.textContent ?? '';

  beforeEach(() => localStorage.clear());

  it('hides a board card and a dashboard widget, picked or selected, on screen while it films', async () => {
    stubDevices();
    const server = await openDock({ hideable: board() });
    fireEvent.click(screen.getByRole('button', { name: /Hide From Recording/ }));
    // A press on a card's face picks the card; one on a widget picks the widget.
    fireEvent.pointerDown(screen.getByTestId('card1-face'));
    fireEvent.pointerDown(screen.getByTestId('slot1-face'));
    fireEvent.click(screen.getByRole('button', { name: 'Hide Selection' }));
    // Esc leaves the mode as Done does, and only that: a key other than Esc keeps it.
    fireEvent.keyDown(window, { key: 'a' });
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Record a Walkthrough' })).toBeTruthy();
    expect(presenterCss()).toContain('[data-plan-card="card1"] > *');
    expect(presenterCss()).toContain('[data-dashboard-slot="slot1"] > *');
    expect(presenterCss()).toContain('[data-plan-card="card2"]');

    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start Recording/ }));
    });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    // While it films, the picked card and widget are hidden from the tab itself, so the film never shows them.
    expect(screen.getByRole('region', { name: 'Recording' })).toBeTruthy();
    const filmingCss = document.head.querySelector('[data-walkthrough-hidden]')?.textContent ?? '';
    expect(filmingCss).toContain('card1');
    expect(filmingCss).toContain('slot1');
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    await waitFor(() => expect(server.requests.some((r) => r.init?.method === 'PUT')).toBe(true));
    const start = server.requests.find((r) => r.init?.method === 'POST')!;
    const { events } = JSON.parse(String(start.init!.body)) as { events: WalkthroughEvents };
    expect(events).toMatchObject({ screen: true, hidden: [], events: [] });
    expect(presenterCss()).toBe('');
  });

  it('leaves Hide From Recording out on a tab with nothing to hide, and the mode with it', async () => {
    stubDevices();
    let can = true;
    await openDock({ hideable: board({ canHide: () => can }) });
    fireEvent.click(screen.getByRole('button', { name: /Hide From Recording/ }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    can = false;
    // The next drawing (a tab change) reads it again.
    fireEvent.click(screen.getByRole('switch', { name: 'Camera' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Done' })).toBeNull());
    expect(screen.queryByRole('button', { name: /Hide From Recording/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Start Recording/ })).toBeTruthy();
    // A press on a card now does what it always does: nothing is picked.
    fireEvent.pointerDown(screen.getByTestId('card1-face'));
    expect(presenterCss()).toBe('');
    // Let the devices it asked for again arrive while the stubs stand.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  it('starts with the camera off, asking for the microphone alone, and remembers turning it on', async () => {
    const getUserMedia = stubDevices();
    await openDock();
    const toggle = screen.getByRole('switch', { name: 'Camera' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off, sound only')).toBeTruthy();
    expect(getUserMedia.mock.calls.every(([c]) => c?.video === false)).toBe(true);
    // No bubble corner without a camera.
    expect(screen.queryByRole('radiogroup', { name: 'Bubble corner' })).toBeNull();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ video: expect.objectContaining({}) }),
      ),
    );
    expect(getUserMedia.mock.lastCall?.[0]?.video).not.toBe(false);
    expect(localStorage.getItem(CAMERA_ON_KEY)).toBe('on');
    expect(await screen.findByRole('radiogroup', { name: 'Bubble corner' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Camera' }));
    expect(localStorage.getItem(CAMERA_ON_KEY)).toBe('off');
  });

  it('opens with the camera on where this browser last had it on', async () => {
    localStorage.setItem(CAMERA_ON_KEY, 'on');
    const getUserMedia = stubDevices();
    await openDock();
    expect(screen.getByRole('switch', { name: 'Camera' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(getUserMedia.mock.calls[0]?.[0]?.video).not.toBe(false);
  });

  it('falls back to sound alone, and says so, when the camera will not start', async () => {
    localStorage.setItem(CAMERA_ON_KEY, 'on');
    stubDevices(async (c) => {
      if (c.video) throw new DOMException('busy', 'NotReadableError');
      return stream(false);
    });
    await openDock();
    expect(
      await screen.findByText("The camera couldn't start, so this walkthrough records sound only."),
    ).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Camera' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    // This recording only: the choice is kept for next time.
    expect(localStorage.getItem(CAMERA_ON_KEY)).toBe('on');
  });

  it('keeps the switch on and says No Camera Found when there is no camera at all', async () => {
    localStorage.setItem(CAMERA_ON_KEY, 'on');
    const getUserMedia = stubDevices(async (c) => {
      if (c.video) throw new DOMException('none', 'NotFoundError');
      return stream(false);
    });
    await openDock();
    const list = await screen.findByRole('combobox', { name: 'Which Camera' });
    expect(list.textContent).toBe('No Camera Found');
    expect((list as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole('switch', { name: 'Camera' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      screen.queryByText("The camera couldn't start, so this walkthrough records sound only."),
    ).toBeNull();
    // Sound alone was asked for after.
    await waitFor(() => expect(getUserMedia.mock.calls.at(-1)?.[0]?.video).toBe(false));
    // Turning the switch off and on again tries the camera again.
    const calls = getUserMedia.mock.calls.length;
    fireEvent.click(screen.getByRole('switch', { name: 'Camera' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Camera' }));
    await waitFor(() =>
      expect(getUserMedia.mock.calls.slice(calls).some(([c]) => !!c?.video)).toBe(true),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  it('asks the browser again from Allow Microphone', async () => {
    const getUserMedia = stubDevices();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: async () => [
          { kind: 'audioinput', deviceId: '', label: '', groupId: '' },
        ],
      },
    });
    await openDock();
    const calls = getUserMedia.mock.calls.length;
    fireEvent.click(await screen.findByRole('button', { name: 'Allow Microphone' }));
    await waitFor(() => expect(getUserMedia.mock.calls.length).toBeGreaterThan(calls));
    // Let the devices it asked for again arrive while the stubs stand.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  // Saving shows the media's upload as it goes (Work Tracker 1175): the share sent, the megabytes and the time left.
  describe('the upload', () => {
    const MB = 1024 * 1024;
    // Records a moment and finishes, which saves at once on the save card, with the media part held until the test answers it.
    async function toSaveCard() {
      stubDevices();
      const server = await openDock();
      let report: ((sent: number, total: number) => void) | null = null;
      let answer: (res: Response) => void = () => undefined;
      server.upload = (r) => {
        report = r;
        return new Promise<Response>((resolve) => {
          answer = resolve;
        });
      };
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
      // The share prompt is asked inside the press; the count starts once the tab is shared.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Start Recording/ }));
      });
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      vi.useRealTimers();
      // The clock the estimate reads, moved by hand from here. Finish saves at once, onto the save card.
      vi.useFakeTimers({ toFake: ['performance'] });
      fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
      await screen.findByRole('region', { name: 'Save Walkthrough' });
      await waitFor(() => expect(report).not.toBeNull());
      return {
        server,
        send: (sent: number, total: number) => act(() => report!(sent, total)),
        answer: (res: Response) => act(async () => answer(res)),
      };
    }
    const bar = () => screen.getByRole('progressbar', { name: 'Upload' });

    it('shows the share sent, the megabytes and the time left, then finishing, then saved', async () => {
      const upload = await toSaveCard();
      // Before any byte is reported: the bytes to go, no bar yet.
      expect(screen.getByRole('status').textContent).toMatch(/^Uploading \d+\.\d MB$/);
      await upload.send(10 * MB, 40 * MB);
      expect(bar().getAttribute('aria-valuenow')).toBe('25');
      expect(screen.getByText('25%')).toBeTruthy();
      expect(screen.getByText('· 10.0 of 40.0 MB')).toBeTruthy();
      expect(screen.getByText('Working out the time left')).toBeTruthy();
      // 20 MB in 20 s: 20 more at that speed is 20 s.
      vi.advanceTimersByTime(20_000);
      await upload.send(20 * MB, 40 * MB);
      expect(bar().getAttribute('aria-valuenow')).toBe('50');
      expect(screen.getByText('About 20 seconds left')).toBeTruthy();
      expect(bar().getAttribute('aria-valuetext')).toBe(
        '50%, 20.0 of 40.0 MB, About 20 seconds left',
      );
      // A report inside the same percentage, soon after, doesn't draw the card again.
      await upload.send(20 * MB + 1, 40 * MB);
      expect(bar().getAttribute('aria-valuetext')).toContain('20.0 of 40.0 MB');
      await upload.send(40 * MB, 40 * MB);
      expect(screen.getByRole('status').textContent).toBe('Finishing');
      expect(screen.getByText('Almost done')).toBeTruthy();
      expect(document.querySelector('[data-walkthrough-upload="finishing"]')).not.toBeNull();
      vi.useRealTimers();
      await upload.answer(
        Response.json({ walkthrough: { ...W, id: 'new', title: 'Mine', mine: true } }),
      );
      await screen.findByText('Saved “Mine”.');
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('drops the bar on a failure, says why and still offers Download a Copy', async () => {
      const upload = await toSaveCard();
      await upload.send(10 * MB, 40 * MB);
      expect(bar()).toBeTruthy();
      vi.useRealTimers();
      await upload.answer(Response.json({ error: 'too_large' }, { status: 413 }));
      await screen.findByRole('alert');
      expect(screen.queryByRole('progressbar')).toBeNull();
      expect(screen.getByRole('button', { name: /Download a Copy/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
    });
  });

  // Telemetry (walkthroughs.md "Telemetry"): which of these happened, never what was said or shown.
  describe('telemetry', () => {
    async function countDown() {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Start Recording/ }));
      });
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(screen.getByRole('region', { name: 'Recording' })).toBeTruthy();
    }
    const fakeTimers = (more: ('performance' | 'Date')[] = []) =>
      vi.useFakeTimers({
        toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', ...more],
      });
    // Discard asks first: the button, then the confirmation's own Discard, the last one in the page.
    const discardRecording = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
      fireEvent.click((await screen.findAllByRole('button', { name: 'Discard' })).at(-1)!);
    };

    it('counts nothing for set-up closed before recording began', async () => {
      stubDevices();
      await openDock();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() =>
        expect(screen.queryByRole('region', { name: 'Record a Walkthrough' })).toBeNull(),
      );
      expect(counted()).toEqual([]);
    });

    it('counts a recording thrown away mid-recording as abandoned, once', async () => {
      stubDevices();
      await openDock();
      fakeTimers();
      await countDown();
      vi.useRealTimers();
      await discardRecording();
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Recording' })).toBeNull());
      expect(counted()).toEqual([
        ['Walkthrough', 'Started', undefined],
        ['Walkthrough', 'Abandoned', undefined],
      ]);
    });

    it('counts a finished recording thrown away on the save card as abandoned', async () => {
      stubDevices();
      const server = await openDock();
      fakeTimers();
      await countDown();
      vi.useRealTimers();
      // A save that is refused keeps the card, with Discard on it.
      server.refuse = { status: 403, error: 'forbidden' };
      fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
      await screen.findByText('Walkthrough Not Saved');
      await discardRecording();
      await waitFor(() =>
        expect(screen.queryByRole('region', { name: 'Save Walkthrough' })).toBeNull(),
      );
      expect(counted()).toEqual([
        ['Walkthrough', 'Started', undefined],
        ['Walkthrough', 'Abandoned', undefined],
      ]);
    });

    it('counts the ten minute limit once, as too long', async () => {
      stubDevices();
      await openDock();
      fakeTimers(['performance']);
      await countDown();
      await act(async () => {
        vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
      });
      vi.useRealTimers();
      // Stopped at the limit, it saves itself as any finished one does.
      await waitFor(() =>
        expect(counted()).toEqual([
          ['Walkthrough', 'Started', undefined],
          ['Walkthrough', 'Refused', 'TooLong'],
          ['Walkthrough', 'Created', undefined],
        ]),
      );
      // Ten minutes of the dock's 200ms clock is three thousand ticks, each a render: well past the default budget.
    }, 60_000);

    it('counts the size limit once, as too large', async () => {
      stubDevices();
      class FullRecorder extends FakeRecorder {
        override start() {
          super.start();
          // Two pieces past the limit: the second must not count again.
          queueMicrotask(() => {
            this.ondataavailable?.({ data: { size: 50 * 1024 * 1024 } as Blob });
            this.ondataavailable?.({ data: { size: 50 * 1024 * 1024 } as Blob });
          });
        }
      }
      vi.stubGlobal('MediaRecorder', FullRecorder);
      await openDock();
      fakeTimers();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Start Recording/ }));
      });
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      vi.useRealTimers();
      await waitFor(() =>
        expect(counted()).toEqual([
          ['Walkthrough', 'Started', undefined],
          ['Walkthrough', 'Refused', 'TooLarge'],
          ['Walkthrough', 'Created', undefined],
        ]),
      );
    });

    it('counts a save an api limit refused, and not one it refused for another reason', async () => {
      stubDevices();
      const server = await openDock();
      fakeTimers();
      await countDown();
      vi.useRealTimers();
      server.refuse = { status: 403, error: 'item_full' };
      fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
      await screen.findByText(/already has 50 walkthroughs/);
      server.refuse = { status: 403, error: 'forbidden' };
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
      await screen.findByText('Only an Editor can save a walkthrough here.');
      expect(counted()).toEqual([
        ['Walkthrough', 'Started', undefined],
        ['Walkthrough', 'Refused', 'ItemFull'],
      ]);
    });
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

  it("keeps the voice chip clear by its own size, not the bubble's", () => {
    const chip = { w: 120, h: 40 };
    // A Map just above where a bubble would reach, but clear of the chip: the chip stays put.
    const map = { left: 4, top: 600, right: 260, bottom: 690 };
    expect(shiftClearOf('bottom-left', frame, { map, sidebar: null })).not.toEqual({ x: 0, y: 0 });
    expect(shiftClearOf('bottom-left', frame, { map, sidebar: null }, chip)).toEqual({
      x: 0,
      y: 0,
    });
    // A Map under it: up above it by the chip's height.
    const low = { left: 4, top: 650, right: 260, bottom: 796 };
    expect(shiftClearOf('bottom-left', frame, { map: low, sidebar: null }, chip)).toEqual({
      x: 0,
      y: 650 - 12 - (800 - 64),
    });
    // A right corner lines up by the chip's width.
    const right = { left: 860, top: 700, right: 900, bottom: 760 };
    expect(shiftClearOf('bottom-right', frame, { map: right, sidebar: null }, chip).y).toBe(
      700 - 12 - (800 - 64),
    );
  });

  it('goes up above the player bar where a narrow window brings them together, and only then', () => {
    // 700 px wide: the bar (36rem, centred) runs 62 to 638, its bottom 64 px up, 52 px tall.
    const narrow = { left: 0, top: 0, right: 700, bottom: 800 };
    const bar = { left: 62, top: 684, right: 638, bottom: 736 };
    const chip = { w: 120, h: 40 };
    const clear = 684 - 12 - (800 - 64);
    expect(shiftClearOf('bottom-left', narrow, { map: null, sidebar: null, bar }, chip)).toEqual({
      x: 0,
      y: clear,
    });
    expect(shiftClearOf('bottom-right', narrow, { map: null, sidebar: null, bar })).toEqual({
      x: 0,
      y: clear,
    });
    // Already above it (clear of a Map): left there. A top corner never meets it; nor does a wide window's corner.
    const map = { left: 4, top: 560, right: 260, bottom: 796 };
    expect(shiftClearOf('bottom-left', narrow, { map, sidebar: null, bar }).y).toBe(
      -(800 - 64 - 560 + 12),
    );
    expect(shiftClearOf('top-left', narrow, { map: null, sidebar: null, bar })).toEqual({
      x: 0,
      y: 0,
    });
    const wideBar = { left: 212, top: 684, right: 788, bottom: 736 };
    expect(
      shiftClearOf('bottom-left', frame, { map: null, sidebar: null, bar: wideBar }, chip),
    ).toEqual({ x: 0, y: 0 });
  });

  it('names the presenter on the chip when it can, and takes the initial from the title when not', () => {
    const { rerender } = render(
      <VoiceChip corner="top-left" name="You" fallback="Tour" playing={false} />,
    );
    const chip = () => document.querySelector<HTMLElement>('[data-walkthrough-voice="top-left"]')!;
    expect(chip().textContent).toBe('YYou');
    rerender(<VoiceChip corner="top-left" name={null} fallback="tour" playing={false} />);
    expect(chip().textContent).toBe('T');
    rerender(<VoiceChip corner="top-left" name={null} fallback="  " playing={false} />);
    expect(chip().textContent).toBe('?');
  });
});
