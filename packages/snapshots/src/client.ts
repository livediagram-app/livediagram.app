// The editor's side of snapshots (liveworkspace/docs/specs/013-snapshots/blueprints/snapshots.md SN19 to SN21): the
// fence's browser half, which every app binds into its api core so every request about an item names the last
// generation it saw, the reload a revert asks for, and the calls the dialog makes.

import {
  SNAPSHOT_FENCED_HEADER,
  SNAPSHOT_GENERATION_HEADER,
  type SnapshotListResponse,
  type SnapshotRevertResponse,
  type SnapshotSummary,
  type SnapshotTakeResponse,
} from './wire';

export type SnapshotFence = {
  /** The request with the generation known for its item on it (unchanged when none is known). */
  stamp: (input: string, init: RequestInit | undefined) => RequestInit | undefined;
  /** Keeps the generation a response names for its item; reloads on a fenced write's refusal. */
  note: (response: Response) => void;
  /** The generation known for an item (0 for none). */
  generationOf: (itemId: string) => number;
};

/** The item id a URL path names under `/api/<collection>/<id>`, or null. */
export function itemIdOf(collection: string, url: string): string | null {
  let path: string;
  try {
    path = new URL(url, 'http://localhost').pathname;
  } catch {
    return null;
  }
  const parts = path.split('/');
  // '', 'api', collection, id, ...
  if (parts[1] !== 'api' || parts[2] !== collection) return null;
  const id = parts[3];
  return id ? decodeURIComponent(id) : null;
}

let reloading = false;

/** SN20: reload the page once, after someone reverted the item this editor shows. */
export function reloadAfterRevert(reload: () => void = () => window.location.reload()): void {
  if (reloading) return;
  reloading = true;
  reload();
}

/** Tests only: allow another reload. */
export function resetRevertReload(): void {
  reloading = false;
}

/** SN19: the fence for one app's item collection (`projects`, `documents`, `designs`). */
export function createSnapshotFence(
  collection: string,
  onReverted: () => void = reloadAfterRevert,
): SnapshotFence {
  const known = new Map<string, number>();
  return {
    stamp(input, init) {
      const id = itemIdOf(collection, input);
      // Nothing until this page has read the item: its first answer says the generation, 0 before any revert.
      const generation = id === null ? undefined : known.get(id);
      if (generation === undefined) return init;
      const headers = new Headers(init?.headers);
      headers.set(SNAPSHOT_GENERATION_HEADER, String(generation));
      return { ...init, headers };
    },
    note(response) {
      const raw = response.headers.get(SNAPSHOT_GENERATION_HEADER);
      if (raw === null) return;
      const id = itemIdOf(collection, response.url);
      const generation = Number(raw);
      if (id !== null && Number.isSafeInteger(generation)) {
        if (generation > (known.get(id) ?? -1)) known.set(id, generation);
      }
      // A write refused by the fence: this page holds the item from before a revert.
      if (response.status === 409 && response.headers.get(SNAPSHOT_FENCED_HEADER) === '1')
        onReverted();
    },
    generationOf: (itemId) => known.get(itemId) ?? 0,
  };
}

/** What the dialog's calls are made with: the app's api core. */
export type SnapshotsApiDeps = {
  apiFetch: (input: string, init?: RequestInit) => Promise<Response>;
  apiHeaders: (opts: { body?: boolean }) => Promise<HeadersInit>;
  /** The item's route, e.g. `https://…/api/projects/<id>`. */
  itemUrl: string;
};

/** A refusal, with the server's message for the dialog. */
export class SnapshotsApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = 'SnapshotsApiError';
    this.status = status;
    this.code = code;
  }
}

async function refusalOf(res: Response): Promise<SnapshotsApiError> {
  let code: string | null = null;
  let message = 'Something went wrong. Try again.';
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string') code = body.error;
    if (typeof body.message === 'string') message = body.message;
  } catch {
    // Not JSON: the generic message.
  }
  return new SnapshotsApiError(res.status, code, message);
}

export type SnapshotsApi = {
  list: () => Promise<SnapshotListResponse>;
  take: (name: string) => Promise<SnapshotSummary>;
  remove: (id: string) => Promise<void>;
  revert: (id: string) => Promise<SnapshotRevertResponse['reverted']>;
};

/** SN21: the four calls. */
export function snapshotsApi(deps: SnapshotsApiDeps): SnapshotsApi {
  const base = `${deps.itemUrl}/snapshots`;
  async function call(path: string, method: string, body?: unknown): Promise<Response> {
    const res = await deps.apiFetch(`${base}${path}`, {
      method,
      headers: await deps.apiHeaders({ body: body !== undefined }),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw await refusalOf(res);
    return res;
  }
  return {
    list: async () => (await (await call('', 'GET')).json()) as SnapshotListResponse,
    take: async (name) =>
      ((await (await call('', 'POST', { name })).json()) as SnapshotTakeResponse).snapshot,
    remove: async (id) => {
      await call(`/${encodeURIComponent(id)}`, 'DELETE');
    },
    revert: async (id) =>
      (
        (await (
          await call(`/${encodeURIComponent(id)}/revert`, 'POST', {})
        ).json()) as SnapshotRevertResponse
      ).reverted,
  };
}
