// A stalled origin answers 504 at the deadline, never a hang (Work Tracker 958): the shared helper, every forward that
// goes through it, and what is never timed (a streaming body, an upload, an upgrade, a local stack).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FORWARD_DEADLINE_MS,
  FORWARD_UPLOAD_BYTES,
  WORKBENCH_ROUTE,
  forwardDeadlineFor,
  forwardOr502,
  forwardToDrive,
  forwardToIndex,
  routeToPreviews,
  routeToWorkspace,
} from './workspace-proxy';

// A fetch that never answers on its own, only to its signal (the stall of 2026-11-15).
const signals: (AbortSignal | undefined)[] = [];
const stalled = ((_input: RequestInfo | URL, init?: RequestInit) => {
  signals.push(init?.signal ?? undefined);
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });
}) as typeof fetch;

beforeEach(() => {
  vi.useFakeTimers();
  signals.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

// Resolves `pending` once the deadline has passed in fake time, and checks nothing answered a moment before it.
async function atDeadline(pending: Promise<Response> | null): Promise<Response> {
  let settled = false;
  void pending!.then(() => (settled = true));
  await vi.advanceTimersByTimeAsync(FORWARD_DEADLINE_MS - 1);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(settled).toBe(true);
  return pending!;
}

async function expect504(res: Response, origin: string, what: string) {
  expect(res.status).toBe(504);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(await res.text()).toBe(`router: ${what} at ${origin} did not answer in time`);
  expect(signals.at(-1)?.aborted).toBe(true);
}

const APP = 'https://www.livediagram.app';
const at = (path: string, init?: RequestInit) => new Request(`${APP}${path}`, init);

describe('forwardOr502 at its deadline', () => {
  it('answers 504 naming the origin when the headers never come, and aborts the fetch', async () => {
    const res = await atDeadline(
      forwardOr502(new Request('https://www.liveworkspace.app/explorer'), 'liveworkspace', stalled),
    );
    await expect504(res, 'https://www.liveworkspace.app', 'liveworkspace');
  });

  it('times only the headers: a body still streaming past the deadline is never cut', async () => {
    let push: ((chunk: string) => void) | undefined;
    let end: (() => void) | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (chunk) => controller.enqueue(new TextEncoder().encode(chunk));
        end = () => controller.close();
      },
    });
    let signal: AbortSignal | undefined;
    const streaming = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    const res = await forwardOr502(
      new Request('https://www.liveworkspace.app/api/previews/items/x'),
      'the previews service',
      streaming,
    );
    push!('first ');
    await vi.advanceTimersByTimeAsync(FORWARD_DEADLINE_MS * 3);
    push!('and last');
    end!();
    expect(signal?.aborted).toBe(false);
    expect(await res.text()).toBe('first and last');
  });

  it('still answers 502 when the origin fails before the deadline', async () => {
    const failing = (async () => {
      throw new Error('Network connection lost.');
    }) as typeof fetch;
    const res = await forwardOr502(new Request('https://www.liveworkspace.app/'), 'x', failing);
    expect(res.status).toBe(502);
  });

  it('is bounded at every forward to liveworkspace: the Explorer, the index, Drive, previews', async () => {
    await expect504(
      await atDeadline(
        routeToWorkspace(at('/explorer/recent'), {
          app: 'livediagram',
          origin: 'https://www.liveworkspace.app',
          fetch: stalled,
        }),
      ),
      'https://www.liveworkspace.app',
      'liveworkspace',
    );
    await expect504(
      await atDeadline(
        forwardToIndex(
          at('/api/index/items'),
          new URL(`${APP}/api/index/items`),
          'https://www.liveworkspace.app',
          { fetch: stalled },
        ),
      ),
      'https://www.liveworkspace.app',
      'the index',
    );
    await expect504(
      await atDeadline(
        forwardToDrive(
          at('/api/drive/status'),
          new URL(`${APP}/api/drive/status`),
          'https://www.liveworkspace.app',
          stalled,
        ),
      ),
      'https://www.liveworkspace.app',
      'the Drive mirror',
    );
    await expect504(
      await atDeadline(routeToPreviews(at('/api/share/abc/image.png'), undefined, stalled)),
      'https://www.liveworkspace.app',
      'the previews service',
    );
  });

  it("bounds an app API's workbench forward to accounts the same way", async () => {
    const res = await atDeadline(
      routeToWorkspace(
        new Request('https://www.livediagram.app/api/workbench/pairings', {
          method: 'POST',
          body: '{}',
          headers: { 'Content-Length': '2' },
        }),
        {
          app: 'livediagram',
          origin: 'https://www.liveworkspace.app',
          routes: [WORKBENCH_ROUTE],
          fetch: stalled,
        },
      ),
    );
    await expect504(res, 'https://www.liveworkspace.app', 'liveworkspace');
  });
});

describe('forwardDeadlineFor', () => {
  it('times an ordinary request, a small body included', () => {
    expect(forwardDeadlineFor(at('/explorer'))).toBe(FORWARD_DEADLINE_MS);
    expect(
      forwardDeadlineFor(
        at('/api/workspace/auth/sign-in/email-otp', {
          method: 'POST',
          body: '{}',
          headers: { 'Content-Length': '2' },
        }),
      ),
    ).toBe(FORWARD_DEADLINE_MS);
  });

  it('never times a WebSocket upgrade, an upload or a local stack', () => {
    expect(forwardDeadlineFor(at('/api/index/live', { headers: { Upgrade: 'websocket' } }))).toBe(
      null,
    );
    expect(
      forwardDeadlineFor(
        at('/api/drive/upload', {
          method: 'POST',
          body: 'x',
          headers: { 'Content-Length': String(FORWARD_UPLOAD_BYTES + 1) },
        }),
      ),
    ).toBe(null);
    for (const host of ['127.0.0.1:3000', 'localhost:3000', '[::1]:3000']) {
      expect(forwardDeadlineFor(new Request(`http://${host}/explorer`))).toBe(null);
    }
  });

  it('leaves an untimed forward waiting as long as it takes', async () => {
    let answer: ((res: Response) => void) | undefined;
    const slow = (() =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      })) as typeof fetch;
    let settled = false;
    const pending = forwardOr502(new Request('http://127.0.0.1:3000/explorer'), 'x', slow).then(
      (res) => {
        settled = true;
        return res;
      },
    );
    await vi.advanceTimersByTimeAsync(FORWARD_DEADLINE_MS * 2);
    expect(settled).toBe(false);
    answer!(new Response('late', { status: 200 }));
    expect((await pending).status).toBe(200);
  });
});
