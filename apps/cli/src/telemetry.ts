// The CLI's usage count (docs/specs/015-api/cli.md "Telemetry", blueprint "Telemetry", CLI41, CLI42): `Cli·Used·<Verb>`
// after a command succeeds, `Error·Api` when the api fails it (5xx or the network, never a 4xx), each one event to
// the active profile's api with no credential, awaited at most TELEMETRY_FLUSH_TIMEOUT_MS. Off by environment or
// config; the first send prints what is counted, once.

import { pascalToken } from '@livediagram/api-schema';
import { ApiError, postEvents } from '@livediagram/api-client';
import type { ConfigFile } from './config/config-file';
import { cacheDir } from './config/paths';
import type { DebugLog } from './debug';
import type { CliIo } from './io';
import { isNetworkFailure } from './output/failure-of';

export const TELEMETRY_FLUSH_TIMEOUT_MS = 300;

export const telemetryNotice = (host: string) =>
  `livediagram counts which commands succeed (the command's name only: never arguments, documents or hosts) and sends the count to ${host}. Turn it off: livediagram telemetry off, or LIVEDIAGRAM_TELEMETRY=0.`;

export type TelemetrySink = { io: CliIo; apiBase: string; log: DebugLog };

// Why the count is off, or null when it is on.
export function telemetryOffReason(io: CliIo, config: ConfigFile): string | null {
  if (io.env.LIVEDIAGRAM_TELEMETRY === '0') return 'env';
  const dnt = io.env.DO_NOT_TRACK;
  if (dnt !== undefined && dnt !== '' && dnt !== '0') return 'do-not-track';
  if (config.telemetry === false) return 'config';
  return null;
}

// One event; telemetry never fails or slows a command beyond the bound.
export async function report(
  category: string,
  action: string,
  type: string,
  sink: TelemetrySink,
): Promise<void> {
  await postEvents(
    sink.apiBase,
    sink.io.fetch,
    [{ category, action, type }],
    {},
    AbortSignal.timeout(TELEMETRY_FLUSH_TIMEOUT_MS),
  );
  sink.log(`telemetry sent ${category}·${action}·${type}`);
}

const statePath = (io: CliIo) => `${cacheDir(io)}/state.json`;

async function noticeOnce(sink: TelemetrySink, host: string): Promise<void> {
  const { io } = sink;
  const state = await io.files.read(statePath(io));
  if (state !== null && state.includes('telemetryNoticeAt')) return;
  io.stderr(`${telemetryNotice(host)}\n`);
  await io.files.mkdir(cacheDir(io), 0o700);
  await io.files.write(statePath(io), JSON.stringify({ telemetryNoticeAt: io.now() }), 0o600);
}

export async function sendCliUsed(
  verbId: string,
  sink: TelemetrySink,
  config: ConfigFile,
  host: string,
): Promise<void> {
  const off = telemetryOffReason(sink.io, config);
  if (off) {
    sink.log(`telemetry skipped ${off}`);
    return;
  }
  // The notice's state file is a convenience: an unwritable cache never fails the command (CLI41).
  await noticeOnce(sink, host).catch((err: unknown) =>
    sink.log(`telemetry notice state unwritten ${String(err)}`),
  );
  await report('Cli', 'Used', pascalToken(verbId), sink);
}

// An api failure as `Error·Api·Http<status>.<Verb>` or `Error·Api·Internal.<Verb>`; nothing for a 4xx or a
// failure that was not the api's.
export async function reportApiFailure(
  err: unknown,
  verbId: string,
  sink: TelemetrySink,
  config: ConfigFile,
): Promise<void> {
  if (telemetryOffReason(sink.io, config)) return;
  const verb = pascalToken(verbId);
  if (err instanceof ApiError && err.status >= 500)
    await report('Error', 'Api', `Http${err.status}.${verb}`, sink);
  else if (isNetworkFailure(err)) await report('Error', 'Api', `Internal.${verb}`, sink);
}

// `telemetry on|off` (blueprint "Telemetry"): off tells the host first, then writes the setting; on writes it, then
// tells the host. Neither counts as a command.
export async function setTelemetry(
  on: boolean,
  sink: TelemetrySink,
  write: () => Promise<void>,
): Promise<{ telemetry: 'on' | 'off' }> {
  if (!on) await report('UI', 'Toggled', 'TelemetryOff', sink);
  await write();
  if (on) await report('UI', 'Toggled', 'TelemetryOn', sink);
  return { telemetry: on ? 'on' : 'off' };
}
