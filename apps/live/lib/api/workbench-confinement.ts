// Client confinement for a workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "The editor in a workbench", WB16): the editor in a workbench frame refuses, before sending, every
// request the api's allow-list would refuse (`workbenchRouteVerdict`, the same function the api runs),
// so a gate the editor missed costs nothing on the wire and never reads as a network error. Only a
// request presenting the session (`Authorization: Bearer lvw_...`) is judged.
import {
  apiRouteLabel,
  isWorkbenchSessionFormat,
  readErrorCode,
  workbenchRouteVerdict,
} from '@livediagram/api-schema';

export type WorkbenchConfinement = { documentId: string; ownerId: string };

export class WorkbenchConfinedError extends Error {
  readonly route: string;
  constructor(route: string) {
    super(`workbench confined: ${route}`);
    this.name = 'WorkbenchConfinedError';
    this.route = route;
  }
}

let confinement: WorkbenchConfinement | null = null;
let logged = new Set<string>();

// Set when the editor mounts in a workbench and on every renewal; never cleared when the session
// ends, so a dead bearer keeps refusing locally.
export function setWorkbenchConfinement(next: WorkbenchConfinement | null): void {
  confinement = next;
  logged = new Set();
}

export function getWorkbenchConfinement(): WorkbenchConfinement | null {
  return confinement;
}

function presentsSession(headers: HeadersInit | undefined): boolean {
  const auth = new Headers(headers).get('Authorization');
  return auth !== null && isWorkbenchSessionFormat(auth.replace(/^Bearer /, ''));
}

// `['api', ...]` as the api splits the path, whatever origin or prefix the api base carries.
function segmentsOf(url: string): string[] {
  const parts = new URL(url, 'http://route.invalid').pathname.split('/').filter(Boolean);
  const at = parts.indexOf('api');
  return at === -1 ? parts : parts.slice(at);
}

// The refusal for a request the session may not make, or null to send it.
export function confinementRefusal(
  url: string,
  init: RequestInit | undefined,
): WorkbenchConfinedError | null {
  if (!confinement || !presentsSession(init?.headers)) return null;
  const method = (init?.method ?? 'GET').toUpperCase();
  if (workbenchRouteVerdict(method, segmentsOf(url), confinement) === 'allow') return null;
  const route = apiRouteLabel(method, url);
  if (!logged.has(route)) {
    logged.add(route);
    console.warn('[workbench] request-confined', { method, route });
  }
  return new WorkbenchConfinedError(route);
}

// The api refused the session itself (`401 invalid_session`: revoked, unpaired, purged, expired): the
// workbench page ends (blueprint "The workbench page" step 6). Every response to a request presenting
// the session passes here; listeners hear each refusal.
const refusedListeners = new Set<() => void>();

export function subscribeWorkbenchSessionRefused(listener: () => void): () => void {
  refusedListeners.add(listener);
  return () => refusedListeners.delete(listener);
}

export async function noteWorkbenchResponse(
  init: RequestInit | undefined,
  res: Response,
): Promise<void> {
  if (res.status !== 401 || !presentsSession(init?.headers)) return;
  if ((await readErrorCode(res)) !== 'invalid_session') return;
  refusedListeners.forEach((l) => l());
}
