'use client';

// Renewal (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workbench page" step 5, WB14,
// WB38): WORKBENCH_RENEW_LEAD_MS before the session expires the page posts `renew`, then again every
// WORKBENCH_RENEW_RETRY_MS until a ticket lands or the session expires. Any `ticket` while mounted is
// redeemed: one for the bound document and origin swaps the session and ends the old one; anything else
// is logged and the asking goes on. Unrenewed, the session ends `expired` at its expiry.
import { useEffect, useEffectEvent, type Dispatch } from 'react';
import {
  WORKBENCH_RENEW_LEAD_MS,
  WORKBENCH_RENEW_RETRY_MS,
  type WorkbenchSessionResponse,
} from '@livediagram/api-schema';
import { apiEndWorkbenchSession, apiRedeemWorkbenchTicket } from '@/lib/api/workbench';
import { debugLog } from '@/lib/debug-log';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';
import type { WorkbenchEvent, WorkbenchPhase } from './workbench-machine';

async function renewWith(
  ticket: string,
  current: () => WorkbenchSessionResponse | null,
  dispatch: Dispatch<WorkbenchEvent>,
): Promise<void> {
  const outcome = await apiRedeemWorkbenchTicket(ticket);
  if (outcome.kind === 'failed') {
    console.warn('[workbench] renew-failed', { reason: 'unreachable' });
    return;
  }
  if (outcome.kind === 'refused') {
    console.warn('[workbench] renew-failed', { reason: outcome.reason ?? 'refused' });
    return;
  }
  const next = outcome.session;
  const bound = current();
  if (!bound || next.documentId !== bound.documentId || next.origin !== bound.origin) {
    console.warn('[workbench] renew-failed', { reason: 'mismatch' });
    void apiEndWorkbenchSession(next.session);
    return;
  }
  dispatch({ type: 'renewed', session: next });
  void apiEndWorkbenchSession(bound.session);
  debugLog('[workbench] renewed');
}

export function useWorkbenchRenewal({
  phase,
  port,
  dispatch,
}: {
  phase: WorkbenchPhase;
  port: WorkbenchPort | null;
  dispatch: Dispatch<WorkbenchEvent>;
}): void {
  const session = phase.phase === 'mounted' ? phase.session : null;
  const secret = session?.session ?? null;
  const expiresAt = session?.expiresAt ?? null;
  // Read when a redemption lands, so a renewal is checked against the session bound by then.
  const currentSession = useEffectEvent(() => session);

  useEffect(() => {
    if (!port || secret === null || expiresAt === null) return;
    const ask = () => port.send({ type: 'livediagram:renew', v: 1 });
    let retry: ReturnType<typeof setInterval> | undefined;
    const lead = setTimeout(
      () => {
        ask();
        retry = setInterval(ask, WORKBENCH_RENEW_RETRY_MS);
      },
      Math.max(0, expiresAt - WORKBENCH_RENEW_LEAD_MS - Date.now()),
    );
    const expiry = setTimeout(
      () => dispatch({ type: 'ended', reason: 'expired' }),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => {
      clearTimeout(lead);
      clearTimeout(expiry);
      clearInterval(retry);
    };
  }, [port, secret, expiresAt, dispatch]);

  const mounted = session !== null;
  useEffect(() => {
    if (!port || !mounted) return;
    return port.subscribe((message) => {
      if (message.type !== 'livediagram:ticket') return;
      void renewWith(message.ticket, currentSession, dispatch);
    });
  }, [port, mounted, dispatch]);
}
