// @vitest-environment jsdom

// A live embed's frame (live-embeds.md "The frame"): a ticket only while active, the frame's address on the item app's
// origin, this page answering the frame as its workbench, and only that frame at that origin heard.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveItem } from '@liveworkspace/element-model/live-item';
import type { LiveEmbedTicket } from './live-embed-ticket';
import { settledWithoutFrame, useLiveEmbedFrame } from './useLiveEmbedFrame';

const ITEM: LiveItem = { app: 'liveplanner', itemId: 'p1' };
const TARGET = 'https://www.liveplanner.app';
const OK: LiveEmbedTicket = {
  ok: true,
  ticket: 't.1',
  path: '/embed/workbench?d=p1',
  expiresAt: 1,
};

let frame: HTMLIFrameElement;
let posted: { message: unknown; origin: string }[];

beforeEach(() => {
  frame = document.createElement('iframe');
  document.body.appendChild(frame);
  posted = [];
  vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(
    ((message: unknown, origin: string) =>
      void posted.push({ message, origin })) as typeof window.postMessage,
  );
});

afterEach(() => {
  frame.remove();
  vi.restoreAllMocks();
});

function setup(
  props: { item?: LiveItem | null; active?: boolean },
  request: (item: LiveItem) => Promise<LiveEmbedTicket>,
) {
  const frameRef = { current: frame };
  return renderHook(
    ({ item, active }: { item: LiveItem | null; active: boolean }) =>
      useLiveEmbedFrame({ item, active, hostName: 'livedocuments', frameRef, request }),
    {
      initialProps: {
        item: props.item === undefined ? ITEM : props.item,
        active: props.active ?? true,
      },
    },
  );
}

const say = (data: unknown, opts: { origin?: string; source?: MessageEventSource | null } = {}) =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: opts.origin ?? TARGET,
        source: opts.source === undefined ? frame.contentWindow : opts.source,
      }),
    );
  });

describe('a live embed frame', () => {
  it('asks nothing until active, then frames the item app with the ticket', async () => {
    const request = vi.fn(async () => OK);
    const { result, rerender } = setup({ active: false }, request);
    expect(result.current.state).toBe('idle');
    expect(request).not.toHaveBeenCalled();
    rerender({ item: ITEM, active: true });
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('live'));
    expect(result.current).toMatchObject({
      src: `${TARGET}/embed/workbench?d=p1&live=1#ticket=t.1`,
      ready: false,
    });
    expect(request).toHaveBeenCalledWith(ITEM);
  });

  it('answers hello as its workbench, renews with a fresh ticket, and takes ended as its reason', async () => {
    let next: LiveEmbedTicket = OK;
    const request = vi.fn(async () => next);
    const { result } = setup({}, request);
    await waitFor(() => expect(result.current.state).toBe('live'));
    say({ type: 'liveplanner:hello', v: 1 });
    expect(posted).toEqual([
      { message: { type: 'liveplanner:hello-ack', v: 1, name: 'livedocuments' }, origin: TARGET },
      { message: { type: 'liveplanner:theme', v: 1, colourScheme: 'light' }, origin: TARGET },
    ]);
    expect(result.current).toMatchObject({ state: 'live', ready: true });
    next = { ...OK, ticket: 't.2' } as LiveEmbedTicket;
    say({ type: 'liveplanner:renew', v: 1 });
    await waitFor(() => expect(posted).toHaveLength(3));
    expect(posted[2]).toEqual({
      message: { type: 'liveplanner:ticket', v: 1, ticket: 't.2' },
      origin: TARGET,
    });
    say({ type: 'liveplanner:ended', v: 1, reason: 'trashed' });
    expect(result.current.state).toBe('gone');
    expect(settledWithoutFrame(result.current)).toBe(true);
  });

  it('loses the frame at a renewal the reader no longer has access for', async () => {
    let next: LiveEmbedTicket = OK;
    const { result } = setup({}, async () => next);
    await waitFor(() => expect(result.current.state).toBe('live'));
    next = { ok: false, reason: 'no-access' };
    say({ type: 'liveplanner:renew', v: 1 });
    await waitFor(() => expect(result.current.state).toBe('no-access'));
  });

  it('hears only the frame, at the item app’s origin, and only its own messages', async () => {
    const { result } = setup({}, async () => OK);
    await waitFor(() => expect(result.current.state).toBe('live'));
    say({ type: 'liveplanner:hello', v: 1 }, { origin: 'https://evil.example' });
    say({ type: 'liveplanner:hello', v: 1 }, { source: window });
    say({ type: 'livediagram:hello', v: 1 });
    say(null);
    say({ type: 7 });
    say({ type: 'liveplanner:selection', v: 1 });
    expect(posted).toEqual([]);
    say({ type: 'liveplanner:ended', v: 1, reason: 'revoked' });
    expect(result.current.state).toBe('no-access');
  });

  it('reads an unknown or missing ended reason as a failure, and Try Again asks afresh', async () => {
    const request = vi.fn(async () => OK);
    const { result } = setup({}, request);
    await waitFor(() => expect(result.current.state).toBe('live'));
    say({ type: 'liveplanner:ended', v: 1 });
    expect(result.current.state).toBe('failed');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toBe('live'));
    say({ type: 'liveplanner:ended', v: 1, reason: 'whatever' });
    expect(result.current.state).toBe('failed');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps an answer that needs no frame while inactive, and drops a frame off screen', async () => {
    const { result, rerender } = setup({}, async () => ({ ok: false, reason: 'gone' }));
    await waitFor(() => expect(result.current.state).toBe('gone'));
    rerender({ item: ITEM, active: false });
    expect(result.current.state).toBe('gone');

    const live = setup({}, async () => OK);
    await waitFor(() => expect(live.result.current.state).toBe('live'));
    live.rerender({ item: ITEM, active: false });
    await waitFor(() => expect(live.result.current.state).toBe('idle'));
  });

  it('is idle with nothing chosen, and ignores an answer that lands after it is gone', async () => {
    const none = setup({ item: null }, async () => OK);
    expect(none.result.current.state).toBe('idle');
    let resolve: (t: LiveEmbedTicket) => void = () => {};
    const late = setup({}, () => new Promise((r) => (resolve = r)));
    late.unmount();
    resolve(OK);
    expect(late.result.current.state).toBe('loading');
  });

  it('draws in the dark when the page is dark', async () => {
    document.documentElement.classList.add('dark');
    const { result } = setup({}, async () => OK);
    await waitFor(() => expect(result.current.state).toBe('live'));
    say({ type: 'liveplanner:hello', v: 1 });
    expect(posted[1]!.message).toMatchObject({ colourScheme: 'dark' });
    document.documentElement.classList.remove('dark');
  });
});
