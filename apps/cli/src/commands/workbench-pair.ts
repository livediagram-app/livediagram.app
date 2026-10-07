// `workbench pair` (docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI"): asks to pair the token
// with a workbench's origin, prints the approval link first so a workbench reading stdout can show it (WB24),
// opens the browser only for a person at a terminal (WB25), then waits for the owner's answer as
// `loginWithDevice` waits for the device grant's.

import { workbenchNameOf, workbenchOriginOf } from '@livediagram/agent-verbs';
import { ApiError, type ApiClient } from '@livediagram/api-client';
import {
  DEVICE_SLOW_DOWN_S,
  type WorkbenchPairingRequestCreated,
  type WorkbenchPairingStatusResponse,
} from '@livediagram/api-schema';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { isNetworkFailure } from '../output/failure-of';

// A network failure is retried at the next interval; this many in a row end the wait.
export const PAIR_NETWORK_ATTEMPTS = 3;

export type PairInput = { origin: string; name?: string };
export type Paired = { status: 'paired'; origin: string; name: string | null };

type Pending = Extract<WorkbenchPairingRequestCreated, { status: 'pending' }>;

// How a wait ends without a pairing: exit 4, each with its own code so a workbench reading --json can tell (WB48).
type Ending = 'pairing_declined' | 'pairing_expired' | 'pairing_gone';

const refused = (code: Ending, message: string, hint?: string) =>
  new CliError({ exit: EXIT.auth, code, message, ...(hint ? { hint } : {}) });

// The link, on stdout before anything waits: a workbench running the CLI reads its first line.
async function announce(io: CliIo, request: Pending, json: boolean, log: DebugLog): Promise<void> {
  io.stdout(
    json
      ? `${JSON.stringify({ status: 'pending', pairingUrl: request.pairingUrl, expiresAt: request.expiresAt })}\n`
      : `${request.pairingUrl}\n`,
  );
  if (!io.stdoutIsTTY) {
    log('workbench pair browser skipped');
    return;
  }
  io.stderr(
    `Opening ${request.pairingUrl} in your browser. If it does not open, open it yourself.\n`,
  );
  const opened = await io.openUrl(request.pairingUrl);
  log(`workbench pair browser ${opened ? 'opened' : 'not-opened'}`);
}

// Polls at the answered interval until the owner answers, the request expires, or the host stops answering.
async function waitForAnswer(
  io: CliIo,
  api: ApiClient,
  request: Pending,
  origin: string,
  log: DebugLog,
): Promise<void> {
  const expired = () =>
    refused(
      'pairing_expired',
      'the pairing request expired before it was answered',
      `livediagram workbench pair --origin ${origin}`,
    );
  let interval = request.interval;
  let slowDown = 0;
  let expiresAt = request.expiresAt;
  let failures = 0;
  for (;;) {
    await io.sleep((interval + slowDown) * 1000);
    // A request the host still calls pending one interval past its expiry is over all the same.
    if (io.now() > expiresAt + (interval + slowDown) * 1000) {
      log('workbench pair expired');
      throw expired();
    }
    let answer: WorkbenchPairingStatusResponse;
    try {
      answer = await api.json<WorkbenchPairingStatusResponse>(
        `/workbench/pairing-requests/${encodeURIComponent(request.code)}/status`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        failures = 0;
        slowDown += DEVICE_SLOW_DOWN_S;
        log(`workbench pair slow-down ${interval + slowDown}`);
        continue;
      }
      if (err instanceof ApiError && err.status === 404) {
        log('workbench pair gone');
        throw refused('pairing_gone', 'the pairing request is gone (was the token revoked?)');
      }
      if (!isNetworkFailure(err) || ++failures >= PAIR_NETWORK_ATTEMPTS) throw err;
      log(`workbench pair network-retry ${failures}`);
      continue;
    }
    failures = 0;
    interval = answer.interval;
    expiresAt = answer.expiresAt;
    log(`workbench pair ${answer.status}`);
    if (answer.status === 'approved') return;
    if (answer.status === 'declined')
      throw refused('pairing_declined', 'the pairing was declined in the browser');
    if (answer.status === 'expired') throw expired();
  }
}

export async function pairWorkbench(
  io: CliIo,
  api: ApiClient,
  input: PairInput,
  json: boolean,
  log: DebugLog,
): Promise<Paired> {
  const origin = workbenchOriginOf(input.origin, 'pair', log);
  const name = workbenchNameOf(input.name, log);
  const created = await api.json<WorkbenchPairingRequestCreated>('/workbench/pairing-requests', {
    method: 'POST',
    body: JSON.stringify({ origin, ...(name ? { name } : {}) }),
  });
  if (created.status === 'paired') {
    log('workbench pair paired');
    return { status: 'paired', origin, name: created.pairing.name };
  }
  log('workbench pair pending');
  await announce(io, created, json, log);
  io.stderr('Waiting for approval…\n');
  await waitForAnswer(io, api, created, origin, log);
  // The pairing keeps the request's name, which is the one given here when one was (WB2).
  return { status: 'paired', origin, name };
}
