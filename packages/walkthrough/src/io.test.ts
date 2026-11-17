// @vitest-environment jsdom
// The recorder, the DOM bridge and the api client (walkthroughs.md "Recording", "One package, four apps", "Each app's
// door").
import { WALKTHROUGH_MEDIA_MAX_BYTES } from '@liveworkspace/media/walkthrough';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { walkthroughApi } from './api';
import {
  applyHidden,
  canvasPoint,
  contentOf,
  elementBox,
  elementIdAt,
  hiddenCss,
  onHideableSurface,
  screenPoint,
  sizeOf,
} from './bridge';
import { canRecordHere, recordingType, startRecording, stopStream } from './recorder';

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

const el = (tag: string, attrs: Record<string, string>, ...children: Element[]) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
};

class FakeRecorder {
  static supported = new Set(['video/webm;codecs=vp8,opus', 'audio/mp4']);
  static isTypeSupported = (t: string) => FakeRecorder.supported.has(t);
  static last: FakeRecorder;
  state: RecordingState = 'inactive';
  mimeType = '';
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: ((e: Event) => void) | null = null;
  options: MediaRecorderOptions;
  constructor(_stream: MediaStream, options: MediaRecorderOptions) {
    this.options = options;
    FakeRecorder.last = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.(new Event('stop'));
  }
  emit(size: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(size)]) } as BlobEvent);
  }
}
const Recorder = FakeRecorder as unknown as Parameters<typeof recordingType>[1];

describe('the recorder', () => {
  it('picks a type this browser records, camera or not', () => {
    expect(recordingType(true, Recorder)).toBe('video/webm;codecs=vp8,opus');
    expect(recordingType(false, Recorder)).toBe('audio/mp4');
    expect(recordingType(false, undefined)).toBeNull();
    const none = { isTypeSupported: () => false } as unknown as typeof Recorder;
    expect(recordingType(true, none)).toBeNull();
    expect(canRecordHere(Recorder)).toBe(true);
    expect(canRecordHere(undefined)).toBe(false);
  });

  it('records at the walkthrough bit rates and hands back the bytes', async () => {
    const rec = startRecording({ stream: {} as MediaStream, camera: true, Recorder });
    expect(FakeRecorder.last.options).toMatchObject({
      mimeType: 'video/webm;codecs=vp8,opus',
      audioBitsPerSecond: 48_000,
      videoBitsPerSecond: 1_000_000,
    });
    FakeRecorder.last.emit(10);
    FakeRecorder.last.emit(0);
    FakeRecorder.last.mimeType = 'video/webm;codecs=vp8';
    const done = await rec.stop();
    expect(done.type).toBe('video/webm');
    expect(done.blob.size).toBe(10);
  });

  it('keeps sound alone without the camera rate, and answers a stop after it stopped', async () => {
    const rec = startRecording({ stream: {} as MediaStream, camera: false, Recorder });
    expect(FakeRecorder.last.options).not.toHaveProperty('videoBitsPerSecond');
    FakeRecorder.last.state = 'inactive';
    expect((await rec.stop()).type).toBe('audio/mp4');
  });

  it('stops keeping bytes at the size limit, and says so once', () => {
    const onFull = vi.fn();
    startRecording({ stream: {} as MediaStream, camera: false, Recorder, onFull });
    FakeRecorder.last.emit(WALKTHROUGH_MEDIA_MAX_BYTES);
    FakeRecorder.last.emit(1);
    FakeRecorder.last.emit(1);
    expect(onFull).toHaveBeenCalledTimes(1);
  });

  it('throws the bytes away on cancel', () => {
    const rec = startRecording({ stream: {} as MediaStream, camera: false, Recorder });
    rec.cancel();
    expect(FakeRecorder.last.state).toBe('inactive');
    expect(FakeRecorder.last.ondataavailable).toBeNull();
    rec.cancel();
  });

  it('refuses where nothing records, and stops a stream’s tracks', () => {
    expect(() =>
      startRecording({ stream: {} as MediaStream, camera: false, Recorder: undefined }),
    ).toThrow();
    const stop = vi.fn();
    stopStream({ getTracks: () => [{ stop }, { stop }] } as unknown as MediaStream);
    stopStream(null);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('reads the browser’s own recorder by default', () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    expect(recordingType(false)).toBe('audio/mp4');
    vi.unstubAllGlobals();
  });
});

function canvas() {
  document.body.append(
    el(
      'div',
      { id: 'root' },
      el(
        'div',
        { 'data-canvas-content': '' },
        el('div', { 'data-element-id': 'a' }, el('span', { id: 'inner' })),
        el('div', { 'data-element-id': 'q"\\x' }),
      ),
    ),
    el('div', { id: 'frame' }),
  );
  const content = document.querySelector<HTMLElement>('[data-canvas-content]')!;
  Object.defineProperty(content, 'offsetWidth', { value: 400 });
  Object.defineProperty(content, 'offsetHeight', { value: 300 });
  content.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 }) as DOMRect;
  document.getElementById('frame')!.getBoundingClientRect = () =>
    ({ left: 5, top: 5, width: 0, height: 0 }) as DOMRect;
  document.querySelector<HTMLElement>('[data-element-id="a"]')!.getBoundingClientRect = () =>
    ({ left: 50, top: 60, width: 20, height: 10 }) as DOMRect;
  return {
    root: document.getElementById('root')!,
    content,
    frame: document.getElementById('frame')!,
  };
}

describe('the bridge', () => {
  it('turns screen points into canvas points and back', () => {
    const { root, content, frame } = canvas();
    expect(contentOf(root)).toBe(content);
    expect(contentOf(null)).toBeNull();
    expect(sizeOf(content)).toEqual({ w: 400, h: 300 });
    expect(canvasPoint(content, 410, 320)).toEqual({ x: 200, y: 150 });
    expect(screenPoint(content, frame, { x: 200, y: 150 })).toEqual({ x: 405, y: 315 });
  });

  it('has no point on a canvas with no size', () => {
    const { content, frame } = canvas();
    content.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    expect(canvasPoint(content, 1, 1)).toBeNull();
    const bare = document.createElement('div');
    expect(screenPoint(bare, frame, { x: 1, y: 1 })).toBeNull();
  });

  it('finds the element pressed and its box', () => {
    const { root, frame } = canvas();
    expect(elementIdAt(document.getElementById('inner'))).toBe('a');
    expect(elementIdAt(root)).toBeNull();
    expect(elementIdAt(null)).toBeNull();
    expect(elementBox(root, frame, 'a')).toEqual({ x: 45, y: 55, w: 20, h: 10 });
    expect(elementBox(root, frame, 'q"\\x')).not.toBeNull();
    expect(elementBox(root, frame, 'none')).toBeNull();
  });

  it('hides elements, faded for the presenter and gone for a viewer, until let go', () => {
    expect(hiddenCss([], 'viewer')).toBe('');
    expect(hiddenCss(['a', 'b\u0001"'], 'viewer')).toBe(
      '[data-canvas-content] [data-element-id="a"],[data-canvas-content] [data-element-id="b\\""]{visibility:hidden !important;pointer-events:none !important;}',
    );
    // The drawing fades, the outline on the wrapper does not.
    expect(hiddenCss(['a'], 'presenter')).toBe(
      '[data-canvas-content] [data-element-id="a"] > *{opacity:.35 !important;}' +
        '[data-canvas-content] [data-element-id="a"]{outline:2px dashed rgb(225 29 72) !important;outline-offset:3px;}',
    );
    const off = applyHidden(document, ['a'], 'viewer');
    expect(document.head.querySelector('[data-walkthrough-hidden="viewer"]')).not.toBeNull();
    off();
    expect(document.head.querySelector('style')).toBeNull();
    applyHidden(document, [], 'viewer')();
  });
});

describe("the bridge, with an app's hideable marks", () => {
  const marks = ['data-plan-card', 'data-dashboard-slot'];
  function board() {
    document.body.append(
      el(
        'div',
        { id: 'root' },
        el(
          'div',
          { 'data-canvas-content': '' },
          // A board drawn on the canvas, its card inside it, and a copy of a card a cover hides.
          el(
            'div',
            { 'data-element-id': 'b1' },
            el('div', { 'data-plan-card': 'c1' }, el('i', { id: 'face' })),
          ),
          el('div', { 'data-plan-card': 'c2', id: 'under' }),
        ),
        el(
          'div',
          { 'data-canvas-cover': '' },
          el('div', { 'data-plan-card': 'c2', id: 'over' }, el('b', { id: 'head' })),
        ),
      ),
      el('div', { id: 'frame' }),
    );
    const root = document.getElementById('root')!;
    const frame = document.getElementById('frame')!;
    frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 }) as DOMRect;
    const under = document.getElementById('under')!;
    const over = document.getElementById('over')!;
    under.getBoundingClientRect = () => ({ left: 1, top: 1, width: 1, height: 1 }) as DOMRect;
    over.getBoundingClientRect = () => ({ left: 9, top: 9, width: 30, height: 20 }) as DOMRect;
    Object.assign(under, { checkVisibility: () => false });
    return { root, frame };
  }

  it('picks the card pressed, not the board around it, and reads marks only when given them', () => {
    board();
    expect(elementIdAt(document.getElementById('face'), marks)).toBe('c1');
    expect(elementIdAt(document.getElementById('face'))).toBe('b1');
    expect(elementIdAt(document.getElementById('head'), marks)).toBe('c2');
    expect(elementIdAt(document.getElementById('head'))).toBeNull();
    const blank = document.createElement('div');
    blank.setAttribute('data-plan-card', '');
    expect(elementIdAt(blank, marks)).toBeNull();
  });

  it('knows a press over the canvas, or on a marked thing laid over it', () => {
    const { root } = board();
    expect(onHideableSurface(document.getElementById('face'))).toBe(true);
    expect(onHideableSurface(document.getElementById('head'))).toBe(false);
    expect(onHideableSurface(document.getElementById('head'), marks)).toBe(true);
    expect(onHideableSurface(root, marks)).toBe(false);
    expect(onHideableSurface(null, marks)).toBe(false);
  });

  it('rings the card drawn, passing over a covered copy', () => {
    const { root, frame } = board();
    expect(elementBox(root, frame, 'c2', marks)).toEqual({ x: 9, y: 9, w: 30, h: 20 });
    expect(elementBox(root, frame, 'c2')).toBeNull();
  });

  it('hides a marked thing wherever it is drawn', () => {
    expect(hiddenCss(['c1'], 'viewer', marks)).toBe(
      '[data-canvas-content] [data-element-id="c1"],[data-plan-card="c1"],[data-dashboard-slot="c1"]{visibility:hidden !important;pointer-events:none !important;}',
    );
    const off = applyHidden(document, ['c1'], 'presenter', marks);
    expect(document.head.querySelector('style')?.textContent).toContain(
      '[data-plan-card="c1"] > *',
    );
    off();
  });
});

describe('the api', () => {
  const summary = { id: 'w1', title: 'T' };
  const respond = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status });

  it('lists, reads, fetches the media and deletes, with the item on every call', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/media?d=doc%201')) return new Response(new Uint8Array([1, 2, 3]));
      if (init?.method === 'DELETE') return respond(200, { ok: true });
      if (url.startsWith('/api/walkthroughs/w1'))
        return respond(200, { walkthrough: summary, events: {} });
      return respond(200, { walkthroughs: [summary], canRecord: true });
    });
    const api = walkthroughApi({ base: '/api', fetch }, 'doc 1');
    expect(await api.list()).toEqual({ walkthroughs: [summary], canRecord: true });
    expect(fetch).toHaveBeenLastCalledWith('/api/walkthroughs?d=doc%201');
    expect(await api.read('w1')).toMatchObject({ walkthrough: summary });
    expect((await api.media('w1'))?.size).toBe(3);
    expect(await api.remove('w1')).toBe(true);
  });

  it('renames and turns the public link on and off, answering the walkthrough as it now is', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = walkthroughApi(
      {
        base: '/api',
        fetch: async (url, init) => {
          calls.push([url, init]);
          return respond(200, { walkthrough: { ...summary, title: 'New', shareCode: 'c' } });
        },
      },
      'd',
    );
    expect(await api.rename('w1', 'New')).toMatchObject({ title: 'New' });
    expect(calls.at(-1)).toEqual([
      '/api/walkthroughs/w1?d=d',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New' }),
      },
    ]);
    expect(await api.share('w1', true)).toMatchObject({ shareCode: 'c' });
    expect(calls.at(-1)).toEqual(['/api/walkthroughs/w1/share?d=d', { method: 'PUT' }]);
    await api.share('w1', false);
    expect(calls.at(-1)?.[1]).toEqual({ method: 'DELETE' });
    const refused = walkthroughApi({ base: '/api', fetch: async () => respond(403) }, 'd');
    expect(await refused.rename('w1', 'X')).toBeNull();
    expect(await refused.share('w1', true)).toBeNull();
  });

  it('answers null or false where it gets nothing', async () => {
    const api = walkthroughApi({ base: '/api', fetch: async () => respond(404) }, 'd');
    expect(await api.list()).toBeNull();
    expect(await api.read('x')).toBeNull();
    expect(await api.media('x')).toBeNull();
    expect(await api.remove('x')).toBe(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const down = walkthroughApi(
      { base: '/api', fetch: () => Promise.reject(new Error('offline')) },
      'd',
    );
    expect(await down.list()).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  const input = {
    title: 'T',
    author: 'Ada',
    media: new Blob([new Uint8Array(5)]),
    mediaType: 'audio/webm',
    events: { v: 1 } as never,
  };

  it('saves in two steps: the events, then the media', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = walkthroughApi(
      {
        base: '/api',
        fetch: async (url, init) => {
          calls.push([url, init]);
          return url.endsWith('/media?d=d')
            ? respond(200, { walkthrough: { ...summary, mine: true } })
            : respond(201, { walkthrough: summary });
        },
      },
      'd',
    );
    const stages: string[] = [];
    const saved = await api.save(input, (s) => stages.push(s));
    expect(saved).toEqual({ ok: true, walkthrough: { ...summary, mine: true } });
    expect(stages).toEqual(['events', 'media']);
    expect(JSON.parse(String(calls[0]![1]!.body))).toMatchObject({ mediaBytes: 5, title: 'T' });
    expect(calls[1]![0]).toBe('/api/walkthroughs/w1/media?d=d');
    expect(calls[1]![1]!.headers).toEqual({ 'Content-Type': 'audio/webm' });
    expect(await api.save(input)).toMatchObject({ ok: true });
  });

  it("asks the app's funnel for the media part's bytes sent, and only for that part", async () => {
    const opts: unknown[] = [];
    const api = walkthroughApi(
      {
        base: '/api',
        fetch: async (url, _init, options) => {
          opts.push(options);
          options?.uploadProgress?.(5, 5);
          return url.endsWith('/media?d=d')
            ? respond(200, { walkthrough: { ...summary, mine: true } })
            : respond(201, { walkthrough: summary });
        },
      },
      'd',
    );
    const progress: [number, number][] = [];
    expect(
      await api.save(input, undefined, (sent, total) => progress.push([sent, total])),
    ).toMatchObject({ ok: true });
    expect(opts).toEqual([undefined, { uploadProgress: expect.any(Function) }]);
    expect(progress).toEqual([[5, 5]]);
  });

  it('says why a save was refused, and lets go of a start whose media was refused', async () => {
    const refused = walkthroughApi(
      { base: '/api', fetch: async () => respond(403, { error: 'item_full' }) },
      'd',
    );
    expect(await refused.save(input)).toEqual({
      ok: false,
      message: 'This already has 50 walkthroughs. Delete one to save another.',
      error: 'item_full',
    });
    const deletes: string[] = [];
    const halfway = walkthroughApi(
      {
        base: '/api',
        fetch: async (url, init) => {
          if (init?.method === 'DELETE') {
            deletes.push(url);
            throw new Error('gone');
          }
          return url.includes('/media')
            ? respond(413, 'not json')
            : respond(201, { walkthrough: summary });
        },
      },
      'd',
    );
    expect(await halfway.save(input)).toMatchObject({ ok: false });
    expect(deletes).toEqual(['/api/walkthroughs/w1?d=d']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = walkthroughApi(
      { base: '/api', fetch: () => Promise.reject(new Error('x')) },
      'd',
    );
    expect(await broken.save(input)).toEqual({
      ok: false,
      message: "The walkthrough couldn't be saved. Try again.",
    });
    const nonJson = walkthroughApi(
      { base: '/api', fetch: async () => new Response('oops', { status: 500 }) },
      'd',
    );
    expect(await nonJson.save(input)).toMatchObject({ ok: false });
    warn.mockRestore();
  });
});
