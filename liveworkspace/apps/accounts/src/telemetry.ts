// The accounts Worker's own telemetry (liveworkspace/docs/specs/003-accounts/accounts.md "Onboarding emails",
// liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events"): `Email·Sent·<kind>` for each onboarding email that
// went, the count each app's dashboard has always kept. The kind and the app only, never a recipient.
//
// An event is counted under the app the email speaks for, the one its links go to (livediagram for
// someone who has used no app yet), with that app's own Worker key, so each app's dashboard keeps its
// Emails Sent stack. The same goes for what only accounts sees of teams and API tokens on
// liveworkspace.app (a team made, renamed or closed, an invitation sent, answered or withdrawn, the join
// link on or off, a member's role, a token made or revoked by hand): each is counted under the app the
// person acting signed up through (an email Decline, with no account behind it, under the inviter's),
// looked up only when the batch goes, so the request never waits on it; someone with no app isn't counted.
// Events wait in this isolate until the run that sent them ends, then go as one batch per app: a cron
// run of a few hundred emails is at most four requests. Fire and forget: a failure, a missing key or a
// slow service is logged at most and never holds up or fails a send.
import type { Env } from './env.ts';
import type { SettingsApp } from './settings.ts';

// Where the service lives and how to prove a batch is an app's own (packages/telemetry wire.ts).
const TELEMETRY_KEY_HEADER = 'X-Telemetry-Key';
const EVENTS_PATH = '/events';
const BATCH_MAX = 100;
// How long a flush may wait on the service before it gives up.
export const TELEMETRY_TIMEOUT_MS = 2_000;
// The most events one isolate holds between flushes, so a service that never answers can't grow it.
const MAX_WAITING = 1_000;

export type TelemetryEnv = Pick<
  Env,
  | 'TELEMETRY'
  | 'TELEMETRY_URL'
  | 'TELEMETRY_KEY_LIVEDIAGRAM'
  | 'TELEMETRY_KEY_LIVEPLANNER'
  | 'TELEMETRY_KEY_LIVEDOCUMENTS'
  | 'TELEMETRY_KEY_LIVEDESIGN'
>;

// Each app's key, named per app as the telemetry Worker names them.
const KEYS: Record<SettingsApp, keyof TelemetryEnv> = {
  'livediagram.app': 'TELEMETRY_KEY_LIVEDIAGRAM',
  'liveplanner.app': 'TELEMETRY_KEY_LIVEPLANNER',
  'livedocuments.app': 'TELEMETRY_KEY_LIVEDOCUMENTS',
  'livedesign.app': 'TELEMETRY_KEY_LIVEDESIGN',
};

type WireEvent = { category: string; action: string; type?: string };

// The app an event is counted under, or how to find it when the batch goes (null: not counted).
export type EventApp = SettingsApp | (() => Promise<SettingsApp | null>);

const waiting: { app: EventApp; event: WireEvent }[] = [];

// One event, held until the next flush; nothing is held when no service is configured. It takes the
// Env first, as every Worker's helper of this name does: the dashboards' emitter scan reads its calls
// (liveworkspace/apps/site/app/telemetry/platform-emitters.ts), so keep the category, action and type
// literals, or a lookup table, at the call.
export function reportServerEvent(
  env: Partial<TelemetryEnv>,
  category: string,
  action: string,
  type: string | null,
  app: EventApp,
): void {
  if (!env.TELEMETRY_URL || waiting.length >= MAX_WAITING) return;
  waiting.push({ app, event: type === null ? { category, action } : { category, action, type } });
}

// Sends what is waiting, one batch per app (in chunks of the service's batch size), all at once and
// each bounded by the timeout. Never throws. An app with no key configured is skipped.
export async function flushServerEvents(env: Partial<TelemetryEnv>): Promise<void> {
  const taken = waiting.splice(0);
  if (taken.length === 0 || !env.TELEMETRY_URL) return;
  const apps = await Promise.all(
    taken.map(({ app }) => (typeof app === 'function' ? app().catch(() => null) : app)),
  );
  const byApp = new Map<SettingsApp, WireEvent[]>();
  for (const [i, { event }] of taken.entries()) {
    const app = apps[i];
    if (!app) continue;
    const list = byApp.get(app) ?? [];
    list.push(event);
    byApp.set(app, list);
  }
  const url = env.TELEMETRY_URL.replace(/\/+$/, '') + EVENTS_PATH;
  const sends: Promise<void>[] = [];
  for (const [app, events] of byApp) {
    const key = env[KEYS[app]];
    if (typeof key !== 'string' || !key) continue;
    for (let i = 0; i < events.length; i += BATCH_MAX) {
      sends.push(post(env, url, key, { app, events: events.slice(i, i + BATCH_MAX) }));
    }
  }
  await Promise.all(sends);
}

// After a request: sends what it reported (a team email, say) once the response has gone, so the
// person never waits on the telemetry service. Nothing to send costs nothing.
export function flushServerEventsAfter(
  env: Partial<TelemetryEnv>,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
): void {
  if (waiting.length > 0) ctx.waitUntil(flushServerEvents(env));
}

async function post(
  env: Partial<TelemetryEnv>,
  url: string,
  key: string,
  batch: { app: SettingsApp; events: WireEvent[] },
): Promise<void> {
  try {
    const request = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [TELEMETRY_KEY_HEADER]: key },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(TELEMETRY_TIMEOUT_MS),
    });
    // The telemetry Worker's service binding when there is one: a Worker's fetch to another Worker's
    // route on its own zone isn't routed to it.
    const response = await (env.TELEMETRY ? env.TELEMETRY.fetch(request) : fetch(request));
    await response.body?.cancel();
  } catch (error) {
    console.warn('[telemetry] batch not sent', error);
  }
}

// For tests: what is waiting, without taking it.
export function waitingServerEvents(): readonly { app: EventApp; event: WireEvent }[] {
  return waiting;
}
