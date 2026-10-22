// Workbench calls (docs/specs/013-workspace/workbench-embeds.md, blueprint "Routes"). Redemption is
// credential-free (the ticket is the bearer); the page's own end presents the session it ends; the
// pairing calls are the signed-in person's, through apiHeaders like every account route.
import type {
  InvalidTicketReason,
  WorkbenchPairing,
  WorkbenchPairingRequestView,
  WorkbenchPairingsResponse,
  WorkbenchSessionResponse,
} from '@livediagram/api-schema';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk, expectOkOrNull } from './core';

// How a redemption ended: a session, a refusal the page shows as such (the ticket was used, expired
// or unknown, or its document is gone), or a failure it shows as a load error.
export type WorkbenchRedeemOutcome =
  | { kind: 'opened'; session: WorkbenchSessionResponse }
  | { kind: 'refused'; status: number; reason: InvalidTicketReason | null }
  | { kind: 'failed'; status: number };

const REFUSED_STATUSES = new Set([400, 401, 404, 410]);

async function invalidTicketReason(res: Response): Promise<InvalidTicketReason | null> {
  try {
    const body = (await res.json()) as { reason?: unknown };
    const r = body.reason;
    return r === 'expired' || r === 'used' || r === 'unknown' ? r : null;
  } catch {
    return null;
  }
}

export async function apiRedeemWorkbenchTicket(ticket: string): Promise<WorkbenchRedeemOutcome> {
  let res: Response;
  try {
    res = await apiFetch(`${API_BASE}/workbench/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    });
  } catch {
    return { kind: 'failed', status: 0 };
  }
  if (res.status === 201) {
    return { kind: 'opened', session: (await res.json()) as WorkbenchSessionResponse };
  }
  if (REFUSED_STATUSES.has(res.status)) {
    const reason = res.status === 401 ? await invalidTicketReason(res) : null;
    return { kind: 'refused', status: res.status, reason };
  }
  return { kind: 'failed', status: res.status };
}

// Best-effort: the session also ends by expiry. Never throws, so a page refusing a session can always
// call it on the way out.
export async function apiEndWorkbenchSession(secret: string): Promise<void> {
  try {
    const res = await apiFetch(`${API_BASE}/workbench/sessions/current`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) console.warn('[workbench] session-end-refused', { status: res.status });
  } catch {
    // apiFetch reported the network failure; the session expires on its own.
  }
}

export async function apiReadPairingRequest(
  ownerId: string,
  code: string,
): Promise<WorkbenchPairingRequestView | null> {
  const res = await apiFetch(`${API_BASE}/workbench/pairing-requests/${code}`, {
    headers: await apiHeaders(ownerId),
  });
  const body = await expectOkOrNull<{ request: WorkbenchPairingRequestView }>(
    res,
    'read pairing request',
  );
  return body?.request ?? null;
}

export type PairingAnswerOutcome = 'approved' | 'declined' | 'answered' | 'expired' | 'missing';

const ANSWER_REFUSALS: Record<number, PairingAnswerOutcome> = {
  404: 'missing',
  409: 'answered',
  410: 'expired',
};

export async function apiAnswerPairingRequest(
  ownerId: string,
  code: string,
  answer: 'approve' | 'decline',
): Promise<PairingAnswerOutcome> {
  const res = await apiFetch(`${API_BASE}/workbench/pairing-requests/${code}/${answer}`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  if (res.ok) return answer === 'approve' ? 'approved' : 'declined';
  const refusal = ANSWER_REFUSALS[res.status];
  if (refusal) return refusal;
  // Not ok, so this throws the ApiError (status and code) every other refusal reads as.
  return expectOk<PairingAnswerOutcome>(res, 'answer pairing request');
}

export async function apiListWorkbenchPairings(ownerId: string): Promise<WorkbenchPairing[]> {
  const res = await apiFetch(`${API_BASE}/workbench/pairings`, {
    headers: await apiHeaders(ownerId),
  });
  const { pairings } = await expectOk<WorkbenchPairingsResponse>(res, 'list workbench pairings');
  return pairings;
}

export async function apiUnpairWorkbench(ownerId: string, pairingId: string): Promise<void> {
  await apiDelete(`${API_BASE}/workbench/pairings/${pairingId}`, ownerId, {
    action: 'unpair workbench',
    allow404: false,
  });
}
