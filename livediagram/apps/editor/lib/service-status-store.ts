import { createContext } from 'react';
import type { ServiceState, ServiceStatus, ServiceStatusReason } from '@livediagram/api-schema';
import { STATUS_URL_MAX } from '@livediagram/document';

// The live service states the document's room sends (docs/specs/009-elements/live-status.md "The badge"; blueprint
// "Presentation and UX"): one store per page, fed by the room's `service-status` op, read by each bound shape's badge.
// It also keeps the badges' clock, so a state turns Unknown once stale without a new message.

// How often the badges' clock moves while any state is held.
export const SERVICE_STATUS_TICK_MS = 15_000;

export type ServiceStatusSnapshot = {
  readonly statuses: Readonly<Record<string, ServiceStatus>>;
  // The clock the badges read the stale rule and "Checked ... ago" against.
  readonly now: number;
};

export type ServiceStatusStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ServiceStatusSnapshot;
  // The room's op's `statuses`, as sent: checked here, never trusted.
  receive: (raw: unknown) => void;
};

const STATES: ReadonlySet<string> = new Set<ServiceState>(['up', 'degraded', 'down', 'unknown']);
const REASONS: ReadonlySet<string> = new Set<ServiceStatusReason>([
  'reported',
  'http_status',
  'timeout',
  'unreachable',
  'unresolved',
  'redirect',
  'refused',
  'too_many_sources',
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function parseStatus(v: unknown): ServiceStatus | null {
  if (!isRecord(v)) return null;
  const { state, checkedAt, reason, httpStatus } = v;
  if (typeof state !== 'string' || !STATES.has(state)) return null;
  if (typeof checkedAt !== 'number' || !Number.isFinite(checkedAt)) return null;
  const status: ServiceStatus = { state: state as ServiceState, checkedAt };
  if (typeof reason === 'string' && REASONS.has(reason)) {
    status.reason = reason as ServiceStatusReason;
  }
  if (typeof httpStatus === 'number' && Number.isInteger(httpStatus))
    status.httpStatus = httpStatus;
  return status;
}

/** A `service-status` op's statuses, each entry checked; anything malformed is dropped. */
export function parseServiceStatuses(raw: unknown): Record<string, ServiceStatus> {
  const out: Record<string, ServiceStatus> = {};
  if (!isRecord(raw)) return out;
  for (const [url, value] of Object.entries(raw)) {
    if (url.length === 0 || url.length > STATUS_URL_MAX) continue;
    const status = parseStatus(value);
    if (status) out[url] = status;
  }
  return out;
}

export function createServiceStatusStore(
  now: () => number = Date.now,
  tickMs: number = SERVICE_STATUS_TICK_MS,
): ServiceStatusStore {
  let snapshot: ServiceStatusSnapshot = { statuses: {}, now: now() };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const emit = () => {
    for (const listener of listeners) listener();
  };
  // One interval while anything is held and someone reads it; none otherwise.
  const syncTimer = () => {
    const wanted = listeners.size > 0 && Object.keys(snapshot.statuses).length > 0;
    if (wanted && timer === null) {
      timer = setInterval(() => {
        snapshot = { ...snapshot, now: now() };
        emit();
      }, tickMs);
    } else if (!wanted && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      syncTimer();
      return () => {
        listeners.delete(listener);
        syncTimer();
      };
    },
    getSnapshot: () => snapshot,
    receive(raw) {
      snapshot = { statuses: parseServiceStatuses(raw), now: now() };
      syncTimer();
      emit();
    },
  };
}

// The page's store, for the canvas's badges; null (no room: a Community post, offline) draws none.
export const ServiceStatusContext = createContext<ServiceStatusStore | null>(null);
