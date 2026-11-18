import {
  currentServiceState,
  STATUS_TIMEOUT_MS,
  type ServiceState,
  type ServiceStatus,
  type ServiceStatusReason,
} from '@livediagram/api-schema';

// What a live status badge says (docs/specs/009-elements/live-status.md "The badge"): the state's word, the name
// assistive technology reads, and the tooltip's title and detail (the reason, when it was checked, the host).

export type ServiceStatusCopy = {
  state: ServiceState;
  word: string;
  label: string;
  title: string;
  detail: string;
};

const WORDS: Record<ServiceState, string> = {
  up: 'Up',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'Unknown',
};

const REASONS: Record<Exclude<ServiceStatusReason, 'http_status'>, string> = {
  reported: 'The service reports it',
  timeout: `No answer in ${STATUS_TIMEOUT_MS / 1000} seconds`,
  unreachable: "Couldn't connect",
  unresolved: "The address doesn't resolve",
  redirect: 'This address redirects: use the address it moves to',
  refused: "This address can't be checked",
  too_many_sources: 'Too many status links in this document',
};

function reasonWords(status: ServiceStatus): string | null {
  const { reason } = status;
  if (reason === undefined) return null;
  if (reason === 'http_status') {
    return status.httpStatus === undefined
      ? 'Answered with an error'
      : `Answered ${status.httpStatus}`;
  }
  return REASONS[reason];
}

/** "Checked just now", "Checked 40 seconds ago", "Checked 2 minutes ago". */
export function checkedAgo(checkedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - checkedAt) / 1000));
  if (seconds < 10) return 'Checked just now';
  if (seconds < 60) return `Checked ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return `Checked ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function serviceStatusCopy(
  status: ServiceStatus,
  url: string,
  now: number,
): ServiceStatusCopy {
  const state = currentServiceState(status, now);
  // The room stopped checking (or the clock moved past three rounds): its last word no longer stands.
  const stale = state === 'unknown' && status.state !== 'unknown';
  const word = WORDS[state];
  const why = stale ? 'Not checked recently' : reasonWords(status);
  const too = status.reason === 'too_many_sources';
  const parts = [why, too ? null : checkedAgo(status.checkedAt, now), hostOf(url)].filter(
    (p): p is string => p !== null,
  );
  return {
    state,
    word,
    label: `Live status: ${word}`,
    title: word,
    detail: parts.join(' · '),
  };
}
