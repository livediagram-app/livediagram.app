'use client';

// A live embed's frame (liveworkspace/docs/specs/004-index/live-embeds.md "The frame"): while `active`, a ticket asked
// with the reader's own access, the item app's workbench page framed with it, and this page answering that frame as its
// workbench: `<app>:hello` with `<app>:hello-ack`, `<app>:renew` with a fresh ticket (asked again, so a reader who lost
// access loses the frame), `<app>:ended` taken as its reason. Only the frame's own window at the item app's origin is
// heard. An answer that needs no frame (no access, gone) is kept until the item changes or Try Again.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { LiveItem } from '@liveworkspace/element-model/live-item';
import { liveEmbedOrigin } from './live-embed-target';
import { requestLiveEmbedTicket, type LiveEmbedTicket } from './live-embed-ticket';
import { workbench } from '../../bindings';
import { liveEmbedFramePath } from '../../lib/editor-surface';

export type LiveEmbedFrame =
  | { state: 'idle' }
  | { state: 'loading' }
  // Framed: `ready` once the frame has said hello.
  | { state: 'live'; src: string; ready: boolean }
  | { state: 'no-access' }
  | { state: 'gone' }
  | { state: 'failed' };

/** Whether an answer stands without a frame: the slot can go. */
export const settledWithoutFrame = (frame: LiveEmbedFrame): boolean =>
  frame.state === 'no-access' || frame.state === 'gone' || frame.state === 'failed';

type Outcome = Exclude<LiveEmbedFrame, { state: 'idle' } | { state: 'loading' }>;

// One union member per answer: TypeScript does not narrow `{ state }` across them.
const settledAs = (state: Settled): Outcome => ({ state });

const outcomeOf = (ticket: Extract<LiveEmbedTicket, { ok: false }>): Outcome =>
  settledAs(ticket.reason);

type Settled = 'no-access' | 'gone' | 'failed';
const ENDED: Record<string, Settled> = {
  trashed: 'gone',
  revoked: 'no-access',
  refused: 'no-access',
  expired: 'failed',
};

const appearanceNow = (): 'light' | 'dark' =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';

export function useLiveEmbedFrame({
  item,
  active,
  hostName,
  frameRef,
  request = requestLiveEmbedTicket,
}: {
  item: LiveItem | null;
  active: boolean;
  // This app's name, as the frame shows its workbench's.
  hostName: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  request?: typeof requestLiveEmbedTicket;
}): LiveEmbedFrame & { retry: () => void } {
  const key = item ? `${item.app}:${item.itemId}` : '';
  const [attempt, setAttempt] = useState(0);
  const [held, setHeld] = useState<{ key: string; outcome: Outcome } | null>(null);
  const [ready, setReady] = useState<string | null>(null);
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });
  const outcome = held?.key === `${key}#${attempt}` ? held.outcome : null;
  const framed = outcome?.state === 'live';

  // Off screen, a frame goes; the next time on screen asks again (set while rendering, as React's "storing
  // information from previous renders", so no extra render with a stale frame).
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active && framed) setHeld(null);
  }

  // Ask while active and unanswered; an answer that needs no frame stands while inactive.
  useEffect(() => {
    if (!item || !active || outcome) return;
    let live = true;
    const asked = `${key}#${attempt}`;
    void requestRef.current(item).then((ticket) => {
      if (!live) return;
      if (!ticket.ok) {
        setHeld({ key: asked, outcome: outcomeOf(ticket) });
        return;
      }
      const origin = liveEmbedOrigin(item.app, window.location.host);
      setHeld({
        key: asked,
        outcome: {
          state: 'live',
          // The frame flag: the target's page shows the item only (live-embeds.md "The frame").
          src: `${origin}${liveEmbedFramePath(ticket.path)}#ticket=${ticket.ticket}`,
          ready: false,
        },
      });
      workbench.track('Canvas', 'Used', 'LiveEmbed');
    });
    return () => {
      live = false;
    };
  }, [item, key, attempt, active, outcome]);

  // The frame's messages, from its own window at the item app's origin only.
  useEffect(() => {
    if (!item || !framed) return;
    const origin = liveEmbedOrigin(item.app, window.location.host);
    const prefix = `${item.app}:`;
    const asked = `${key}#${attempt}`;
    const post = (message: Record<string, unknown>) =>
      frameRef.current?.contentWindow?.postMessage(message, origin);
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.origin !== origin) return;
      const data = event.data as { type?: unknown; v?: unknown; reason?: unknown } | null;
      if (!data || typeof data.type !== 'string' || !data.type.startsWith(prefix)) return;
      const type = data.type.slice(prefix.length);
      if (type === 'hello') {
        post({ type: `${prefix}hello-ack`, v: 1, name: hostName });
        post({ type: `${prefix}theme`, v: 1, colourScheme: appearanceNow() });
        setReady(asked);
      } else if (type === 'renew') {
        void requestRef.current(item).then((ticket) => {
          if (ticket.ok) post({ type: `${prefix}ticket`, v: 1, ticket: ticket.ticket });
          else setHeld({ key: asked, outcome: outcomeOf(ticket) });
        });
      } else if (type === 'ended') {
        const reason = typeof data.reason === 'string' ? data.reason : 'expired';
        setHeld({ key: asked, outcome: settledAs(ENDED[reason] ?? 'failed') });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [item, key, attempt, framed, hostName, frameRef]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (!item) return { state: 'idle', retry };
  if (outcome?.state === 'live') return { ...outcome, ready: ready === `${key}#${attempt}`, retry };
  if (outcome) return { ...outcome, retry };
  return { state: active ? 'loading' : 'idle', retry };
}
