// Running the status page's checks (liveworkspace/docs/specs/010-site/site.md "Status") and reading them: each service's state,
// each group's, and the page's. Pure apart from `runProbe`, which takes its fetch and clock, so tests drive it.

import {
  judgeAnswer,
  type Probe,
  type Service,
  type ServiceGroup,
  SLOW_MS,
  TIMEOUT_MS,
} from '@liveworkspace/status';

// The same thresholds as the status Worker's (@liveworkspace/status), so the two judge alike.
export { SLOW_MS, TIMEOUT_MS };

// A service's state, always shown as an icon and a word, never colour alone.
//  - up: answered as expected, in time.
//  - reached: another site answered, but the browser can't read what it said (see `reach` probes).
//  - slow: answered as expected, after more than SLOW_MS.
//  - down: no answer within TIMEOUT_MS, a network error, or an answer it shouldn't give.
//  - checking: the first round hasn't come back yet.
//  - skipped: not checked here, with the reason.
export type ServiceState = 'up' | 'reached' | 'slow' | 'down' | 'checking' | 'skipped';

// After a round, Check now rests this long before it runs another: every round asks every service at once.
export const CHECK_COOLDOWN_MS = 30_000;
// How many past checks each service keeps for its strip: this visit's only, in memory.
export const HISTORY_MAX = 30;

export type CheckResult = {
  state: Exclude<ServiceState, 'checking' | 'skipped'>;
  // How long the answer took, or until the check gave up.
  ms: number;
  // When the check finished (epoch ms).
  at: number;
  // What the answer was, for the row: "HTTP 200", "Reached", "Timed out", "HTTP 500".
  detail: string;
};

export type Clock = () => number;

/** Run one check. Never throws: a failure is a `down` result. */
export async function runProbe(
  probe: Probe,
  fetchImpl: typeof fetch,
  now: Clock = () => performance.now(),
  wall: Clock = Date.now,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = now();
  const done = (state: CheckResult['state'], detail: string): CheckResult => ({
    state,
    ms: Math.max(0, Math.round(now() - started)),
    at: wall(),
    detail,
  });
  try {
    const res = await fetchImpl(probe.url, {
      method: probe.method,
      mode: probe.kind === 'reach' ? 'no-cors' : 'cors',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    });
    // Drain any body so the connection is free for the next check (HEAD and OPTIONS have none).
    if (probe.kind === 'read' && probe.method === 'GET') void res.body?.cancel().catch(() => {});
    if (probe.kind === 'read') {
      const wrong = judge(probe, res.status, res.headers.get('Content-Type'));
      if (wrong) return done('down', wrong);
    }
    const answered =
      probe.kind === 'reach'
        ? done('reached', 'Reached')
        : done('up', probe.says ?? `HTTP ${res.status}`);
    return answered.ms > SLOW_MS ? { ...answered, state: 'slow' } : answered;
  } catch (err) {
    const timedOut =
      controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
    return done('down', timedOut ? 'Timed out' : 'No answer');
  } finally {
    clearTimeout(timer);
  }
}

// What is wrong with a readable answer (as the row's detail), or null when it is the one expected: the shared rules,
// in words.
function judge(
  probe: Extract<Probe, { kind: 'read' }>,
  status: number,
  contentType: string | null,
): string | null {
  const wrong = judgeAnswer(probe, status, contentType);
  if (wrong === 'status') return `HTTP ${status}`;
  if (wrong === 'not_json') return `HTTP ${status}, not JSON`;
  return null;
}

export type ServiceView = {
  state: ServiceState;
  latest: CheckResult | null;
  history: readonly CheckResult[];
  // For a derived service: which check stood for it, for the detail line.
  via?: string;
};

const ANSWERED = new Set<ServiceState>(['up', 'reached', 'slow']);

/** Each service's state from the results so far: its own, the one it stands on, or skipped. */
export function viewServices(
  services: readonly Service[],
  history: ReadonlyMap<string, readonly CheckResult[]>,
): Map<string, ServiceView> {
  const own = (id: string): ServiceView => {
    const list = history.get(id) ?? [];
    const latest = list.at(-1) ?? null;
    return { state: latest?.state ?? 'checking', latest, history: list };
  };
  const views = new Map<string, ServiceView>();
  for (const s of services) {
    if (s.check.mode === 'probe') views.set(s.id, own(s.id));
    else if (s.check.mode === 'skipped')
      views.set(s.id, { state: 'skipped', latest: null, history: [] });
  }
  for (const s of services) {
    if (s.check.mode !== 'derived') continue;
    const sources = s.check.from.map((id) => views.get(id) ?? own(id));
    if (s.check.rule === 'same') {
      const src = sources[0]!;
      views.set(s.id, { ...src, via: 'Through the API' });
      continue;
    }
    // `any`: up when any check through it answered; checking until one has; down when every one is.
    const answered = sources.filter((v) => ANSWERED.has(v.state));
    const fastest = answered.toSorted((a, b) => (a.latest?.ms ?? 0) - (b.latest?.ms ?? 0))[0];
    const state: ServiceState = fastest
      ? fastest.state === 'reached'
        ? 'up'
        : fastest.state
      : sources.some((v) => v.state === 'checking')
        ? 'checking'
        : 'down';
    views.set(s.id, {
      state,
      latest: fastest?.latest ?? sources.find((v) => v.latest)?.latest ?? null,
      history: [],
      via: `${answered.length} of ${sources.length} checks answered`,
    });
  }
  return views;
}

// The page's (or a group's) state in one word.
export type Overall = 'checking' | 'operational' | 'slow' | 'outage' | 'major';

export type Summary = {
  overall: Overall;
  // Services checked here (not skipped), and how many of them answered.
  total: number;
  answered: number;
  down: number;
  slow: number;
  // The median answer time of this round's own checks, or null before any.
  medianMs: number | null;
  // When the newest check finished, or null before any.
  lastAt: number | null;
};

/** Summarise services' views: overall, counts and the median answer time. */
export function summarise(
  services: readonly Service[],
  views: ReadonlyMap<string, ServiceView>,
): Summary {
  let total = 0;
  let answered = 0;
  let down = 0;
  let slow = 0;
  let checking = 0;
  let lastAt: number | null = null;
  const times: number[] = [];
  for (const s of services) {
    const v = views.get(s.id);
    if (!v || v.state === 'skipped') continue;
    total++;
    if (v.state === 'checking') checking++;
    else if (v.state === 'down') down++;
    else {
      answered++;
      if (v.state === 'slow') slow++;
    }
    if (s.check.mode === 'probe' && v.latest) {
      if (v.latest.state !== 'down') times.push(v.latest.ms);
      lastAt = Math.max(lastAt ?? 0, v.latest.at);
    }
  }
  const overall: Overall =
    checking === total
      ? 'checking'
      : down > 0
        ? down * 2 >= total
          ? 'major'
          : 'outage'
        : slow > 0
          ? 'slow'
          : checking > 0
            ? 'checking'
            : 'operational';
  return { overall, total, answered, down, slow, medianMs: median(times), lastAt };
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Add a round's results to the history, keeping at most HISTORY_MAX per service. */
export function appendHistory(
  history: ReadonlyMap<string, readonly CheckResult[]>,
  results: ReadonlyMap<string, CheckResult>,
): Map<string, CheckResult[]> {
  const next = new Map<string, CheckResult[]>();
  for (const [id, list] of history) next.set(id, [...list]);
  for (const [id, result] of results) {
    const list = next.get(id) ?? [];
    list.push(result);
    if (list.length > HISTORY_MAX) list.splice(0, list.length - HISTORY_MAX);
    next.set(id, list);
  }
  return next;
}

/** Every probe on the page, run at once. */
export async function runRound(
  groups: readonly ServiceGroup[],
  fetchImpl: typeof fetch,
): Promise<Map<string, CheckResult>> {
  const probes = groups.flatMap((g) =>
    g.services.flatMap((s) => (s.check.mode === 'probe' ? [[s.id, s.check.probe] as const] : [])),
  );
  const results = await Promise.all(probes.map(([, p]) => runProbe(p, fetchImpl)));
  return new Map(probes.map(([id], i) => [id, results[i]!]));
}

export const OVERALL_COPY: Record<Overall, { title: string; line: string }> = {
  checking: { title: 'Checking every service…', line: 'The first answers are on their way.' },
  operational: { title: 'All systems operational', line: 'Every service answered as it should.' },
  slow: {
    title: 'Some services are slow',
    line: 'Everything answered, but not all of it quickly.',
  },
  outage: {
    title: 'Some services are down',
    line: 'Most services answered, but not all of them. Each check runs from your browser, so your own connection can play a part.',
  },
  major: {
    title: 'Major outage',
    line: 'Many services aren’t answering from here. Each check runs from your browser, so check your connection too.',
  },
};
