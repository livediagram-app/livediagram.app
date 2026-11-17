// @vitest-environment jsdom
// The walkthroughs as an app mounts them (walkthroughs.md "In Tools", "Recording", "Playing"): the row in the footer's
// Tools and its panel, recording from set-up to save with what is hidden kept out, and playing with the viewer's tab
// and view put back on close. Over a fake api, devices and recorder.
import type { WalkthroughEvents, WalkthroughSummary } from '@liveworkspace/media/walkthrough';
import { ChromeToolsMenu } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalkthroughHideable, WalkthroughHost } from './host';
import { CAMERA_ON_KEY } from './useRecorder';
import type { CanvasView } from './timeline';
import { shiftClearOf } from './ui/Bubble';
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
      <WalkthroughsTools menu={walkthroughs.menu} />
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

// Opens the footer's Tools, then its Walkthroughs row (walkthroughs.md "In Tools").
async function openWalkthroughs() {
  fireEvent.click(await screen.findByRole('button', { name: /^Tools/ }));
  const row = document.querySelector<HTMLElement>('[data-tools-item="walkthroughs"]');
  if (!row) throw new Error('no Walkthroughs row in Tools');
  fireEvent.click(row);
  return screen.getByRole('dialog', { name: 'Walkthroughs' });
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
    expect(document.querySelector('[data-tools-popover]')).toBeNull();
    expect(menu.textContent).toContain('Tour');
    expect(menu.textContent).toContain('1:04 · Ada · 2 days ago');
    expect(screen.queryByText('Record Walkthrough')).toBeNull();
  });

  it('shows an Editor the empty state and Record Walkthrough, which opens the dock and closes the panel', async () => {
    render(<Harness server={{ list: [], canRecord: true, requests: [] }} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Tools/ }));
    expect(document.querySelector('[data-tools-item="walkthroughs"]')?.textContent).toContain(
      'Record yourself talking through it.',
    );
    fireEvent.click(document.querySelector<HTMLElement>('[data-tools-item="walkthroughs"]')!);
    expect(screen.getByText('No Walkthroughs Yet')).toBeTruthy();
    fireEvent.click(screen.getByText('Record Walkthrough'));
    expect(screen.queryByRole('dialog', { name: 'Walkthroughs' })).toBeNull();
  });

  it('closes on Escape', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    await openWalkthroughs();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Walkthroughs' })).toBeNull());
  });

  it('deletes a walkthrough after asking', async () => {
    const server: Server = { list: [W], canRecord: true, requests: [] };
    render(<Harness server={server} />);
    await openWalkthroughs();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tour' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Tour')).toBeNull());
    expect(server.requests.at(-1)).toMatchObject({ url: '/api/walkthroughs/w1?d=doc' });
  });
});

describe('playing', () => {
  it('plays over the canvas, hides what was hidden, says it was edited, and puts the viewer back', async () => {
    render(<Harness server={{ list: [W], canRecord: false, requests: [] }} />);
    await openWalkthroughs();
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
      value: { getUserMedia, enumerateDevices: async () => [] },
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

  it('hides a board card and a dashboard widget, picked or selected, and keeps them out of the events', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Start Recording/ }));
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    // A press on a hidden card is dropped; one on a canvas element that is not hidden is kept.
    fireEvent.pointerDown(screen.getByTestId('card1-face'));
    fireEvent.pointerDown(document.querySelector('[data-element-id="e1"]')!);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }));
    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/^Saved/);
    const start = server.requests.find((r) => r.init?.method === 'POST')!;
    const { events } = JSON.parse(String(start.init!.body)) as { events: WalkthroughEvents };
    expect(events.hidden.sort()).toEqual(['card1', 'card2', 'sel1', 'sel2', 'slot1']);
    const points = events.events.flatMap((e) => (e.k === 'point' ? [e.id] : []));
    expect(points).toEqual(['e1']);
    expect(JSON.stringify(events.events)).not.toContain('card1');
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
