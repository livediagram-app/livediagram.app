// What an error says, in every app (liveworkspace/docs/specs/022-interface-design/error-words.md): what happened, then
// what to do, by class. A surface's own words for a code win; these are what it falls back to, so being offline,
// signed out or without access never reads as the same "Something went wrong".

export type ErrorKind =
  | 'offline'
  | 'unreachable'
  | 'signed_out'
  | 'no_access'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export type ErrorWords = {
  kind: ErrorKind;
  message: string;
  /** Whether trying again can help: false for signed out, no access and gone, whose fix is elsewhere. */
  canRetry: boolean;
};

export type ErrorWordsOptions = {
  /** The surface runs the read again by itself on reconnect, so Offline says so rather than asking. */
  retriesItself?: boolean;
};

const WORDS: Readonly<Record<ErrorKind, { message: string; canRetry: boolean }>> = {
  offline: { message: 'You’re offline. Reconnect, then try again.', canRetry: true },
  unreachable: {
    message: 'Couldn’t connect. Check your connection and try again.',
    canRetry: true,
  },
  signed_out: { message: 'You’ve been signed out. Sign in again to carry on.', canRetry: false },
  no_access: {
    message: 'You don’t have access to that. Ask its owner for access.',
    canRetry: false,
  },
  not_found: {
    message: 'That’s no longer there. It may have been moved or deleted.',
    canRetry: false,
  },
  conflict: {
    message: 'That changed somewhere else just now. Refresh to see the latest, then try again.',
    canRetry: true,
  },
  rate_limited: {
    message: 'Too many tries just now. Wait a minute and try again.',
    canRetry: true,
  },
  server: { message: 'Something went wrong on our side. Try again in a moment.', canRetry: true },
  unknown: { message: 'Something went wrong. Try again.', canRetry: true },
};

const OFFLINE_RETRIES_ITSELF = 'You’re offline. It tries again when you reconnect.';

// The codes servers and clients across the platform answer with, by class. `offline` is the clients' own for a request
// that threw; whether the browser is really offline decides between Offline and Unreachable.
const CODES: Readonly<Record<string, ErrorKind>> = {
  offline: 'unreachable',
  network: 'unreachable',
  signed_out: 'signed_out',
  unauthorized: 'signed_out',
  unauthenticated: 'signed_out',
  forbidden: 'no_access',
  no_access: 'no_access',
  not_found: 'not_found',
  conflict: 'conflict',
  rate_limited: 'rate_limited',
  too_many_requests: 'rate_limited',
  server_error: 'server',
  internal: 'server',
  internal_error: 'server',
  unavailable: 'server',
};

// The messages a browser's fetch rejects with when no answer came (Chromium, WebKit, Firefox, React Native).
const NETWORK_MESSAGES = [
  'Failed to fetch',
  'Load failed',
  'NetworkError',
  'Network request failed',
];

function browserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function kindOfStatus(status: number): ErrorKind {
  if (status === 0) return 'unreachable';
  if (status === 401) return 'signed_out';
  if (status === 403) return 'no_access';
  if (status === 404 || status === 410) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  if (status >= 500 && status <= 599) return 'server';
  return 'unknown';
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  return NETWORK_MESSAGES.some((m) => error.message.includes(m));
}

function classify(error: unknown): ErrorKind {
  if (typeof error === 'string') return CODES[error] ?? 'unknown';
  if (typeof error === 'number') return kindOfStatus(error);
  if (isNetworkFailure(error)) return 'unreachable';
  if (error && typeof error === 'object') {
    const {
      code,
      error: named,
      status,
    } = error as {
      code?: unknown;
      error?: unknown;
      status?: unknown;
    };
    const coded = typeof code === 'string' ? code : typeof named === 'string' ? named : null;
    const byCode = coded === null ? undefined : CODES[coded];
    if (byCode) return byCode;
    if (typeof status === 'number') return kindOfStatus(status);
  }
  return 'unknown';
}

/** The class of an error: a code, a status, a thrown error or a refusal result (`{ status, error }`). */
export function errorKindOf(error: unknown): ErrorKind {
  const kind = classify(error);
  // A request that got no answer (or a gateway's) while the browser says it is offline: that is the reason to give.
  // An error with no class stays unknown, so a real fault never reads as the connection.
  if (browserOffline() && (kind === 'unreachable' || kind === 'server')) return 'offline';
  return kind;
}

/** What an error says and whether trying again can help. */
export function errorWords(error: unknown, options: ErrorWordsOptions = {}): ErrorWords {
  const kind = errorKindOf(error);
  const words = WORDS[kind];
  const message =
    kind === 'offline' && options.retriesItself ? OFFLINE_RETRIES_ITSELF : words.message;
  return { kind, message, canRetry: words.canRetry };
}

/** The words alone. */
export function errorMessage(error: unknown, options?: ErrorWordsOptions): string {
  return errorWords(error, options).message;
}

/** An action's own lead ("Couldn’t rename “Roadmap”.") and why; the lead and "Try again." when the reason is unknown. */
export function failedBecause(lead: string, error: unknown): string {
  const { kind, message } = errorWords(error);
  return `${lead} ${kind === 'unknown' ? 'Try again.' : message}`;
}

/**
 * A package's own words for a code first, then the class's. The clients' `offline` (a request that threw) takes the
 * Offline words while the browser is offline, over a map's "couldn’t reach" line.
 */
export function ownErrorWords(
  own: Readonly<Record<string, string>>,
  code: string,
  status?: number,
): string {
  if (code === 'offline' && browserOffline()) return WORDS.offline.message;
  return own[code] ?? errorMessage({ code, status });
}

/** The code for a refusal whose body named none, from its status. */
export function errorCodeForStatus(status: number): string {
  switch (kindOfStatus(status)) {
    case 'signed_out':
      return 'signed_out';
    case 'no_access':
      return 'forbidden';
    case 'not_found':
      return 'not_found';
    case 'conflict':
      return 'conflict';
    case 'rate_limited':
      return 'rate_limited';
    case 'server':
      return 'server_error';
    default:
      return 'failed';
  }
}

/** Runs `run` once the browser is back online (at once when it already is); returns the unsubscribe. */
export function whenBackOnline(run: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!browserOffline()) {
    run();
    return () => {};
  }
  const onOnline = () => {
    window.removeEventListener('online', onOnline);
    run();
  };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}
