'use client';

// The workbench page's handshake (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench
// page", steps 1 to 3): read the ticket and clear the fragment, redeem it, check the document, then
// bind to the workbench: `hello` to the session's origin and nothing else until a valid `hello-ack`
// from the parent at that origin within WORKBENCH_HANDSHAKE_MS (I8). Every failure after a session
// exists revokes it. Runs once per page load, whatever React does with effects.
import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { WORKBENCH_HANDSHAKE_MS, type HelloAckMessage } from '@livediagram/api-schema';
import { apiEndWorkbenchSession, apiRedeemWorkbenchTicket } from '@/lib/api/workbench';
import { createWorkbenchPort, type WorkbenchPort } from '@/lib/workbench/workbench-port';
import { debugLog } from '@/lib/debug-log';
import { takeTicketFromAddress } from './workbench-fragment';
import {
  INITIAL_WORKBENCH_PHASE,
  workbenchTransition,
  type WorkbenchEvent,
  type WorkbenchPhase,
} from './workbench-machine';

// The origin's host only (WB37): no scheme, no port.
export const originHostOf = (origin: string): string => new URL(origin).hostname;

function waitForAck(port: WorkbenchPort): Promise<HelloAckMessage | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, WORKBENCH_HANDSHAKE_MS);
    const unsubscribe = port.subscribe((message) => {
      if (message.type !== 'livediagram:hello-ack') return;
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
  });
}

// Resolves the bound port, or null when the page ends refused, failed or unbound.
export async function runWorkbenchHandshake(
  win: Window,
  dispatch: (event: WorkbenchEvent) => void,
): Promise<WorkbenchPort | null> {
  const { ticket, documentId } = takeTicketFromAddress(win.location, win.history);
  dispatch({ type: 'read', ticket, documentId });
  if (ticket === null) {
    console.warn('[workbench] redeem-failed', { status: null, reason: 'no-ticket' });
    return null;
  }

  const outcome = await apiRedeemWorkbenchTicket(ticket);
  if (outcome.kind === 'failed') {
    console.warn('[workbench] redeem-failed', { status: outcome.status });
    dispatch({ type: 'redeem-failed' });
    return null;
  }
  if (outcome.kind === 'refused') {
    console.warn('[workbench] redeem-failed', { status: outcome.status, reason: outcome.reason });
    dispatch({ type: 'redeem-refused' });
    return null;
  }
  const { session } = outcome;
  dispatch({ type: 'redeemed', session });
  if (session.documentId !== documentId) {
    console.warn('[workbench] redeem-failed', { status: 201, reason: 'mismatch' });
    void apiEndWorkbenchSession(session.session);
    win.parent.postMessage({ type: 'livediagram:ended', v: 1, reason: 'refused' }, session.origin);
    return null;
  }

  if (win.parent === win) {
    console.warn('[workbench] handshake-failed', { framed: false });
    void apiEndWorkbenchSession(session.session);
    dispatch({ type: 'unanswered' });
    return null;
  }
  const port = createWorkbenchPort(session.origin, win);
  const acked = waitForAck(port);
  port.send({ type: 'livediagram:hello', v: 1 });
  const ack = await acked;
  if (ack === null) {
    console.warn('[workbench] handshake-failed', { framed: true });
    port.close();
    void apiEndWorkbenchSession(session.session);
    dispatch({ type: 'unanswered' });
    return null;
  }
  debugLog('[workbench] handshake-ok', { originHost: originHostOf(session.origin) });
  dispatch({ type: 'acked', name: ack.name });
  return port;
}

export function useWorkbenchHandshake(win?: Window): {
  phase: WorkbenchPhase;
  port: WorkbenchPort | null;
  dispatch: Dispatch<WorkbenchEvent>;
} {
  const [phase, dispatch] = useReducer(workbenchTransition, INITIAL_WORKBENCH_PHASE);
  const [port, setPort] = useState<WorkbenchPort | null>(null);
  // A ticket is single use: the handshake must never run twice, whatever React does with effects.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runWorkbenchHandshake(win ?? window, dispatch).then(setPort);
  }, [win]);
  return { phase, port, dispatch };
}
