// The editor's calls to its own api's walkthrough door (liveworkspace/docs/specs/006-media/walkthroughs.md "Each app's
// door"), through the app's own fetch so the item's grant and the caller's identity ride along as on every other
// call. Saving is two steps: the events start the walkthrough, then its media follows as a stream of its own.

import {
  walkthroughRefusalMessage,
  type WalkthroughEvents,
  type WalkthroughLimits,
  type WalkthroughSummary,
} from '@liveworkspace/media/walkthrough';
import type { UploadProgress } from './upload-progress';

export type WalkthroughApiDeps = {
  // The api's base (`/api` or the api's origin and `/api`).
  base: string;
  // The app's fetch: adds the item's grant and the caller's bearer. `uploadProgress` is told the bytes sent as they
  // go: the app's funnel then sends that request by XMLHttpRequest, same headers, grant and failure report.
  fetch: (
    url: string,
    init?: RequestInit,
    opts?: { uploadProgress?: UploadProgress },
  ) => Promise<Response>;
};

// `limits`: with Pro on, what the caller may record on this item, as the server worked it out (walkthroughs.md "With
// Pro on"). Absent with Pro off, where the recorder keeps the lengths it always had.
export type WalkthroughList = {
  walkthroughs: WalkthroughSummary[];
  canRecord: boolean;
  limits?: WalkthroughLimits;
};

export type SaveInput = {
  title: string;
  author: string | null;
  media: Blob;
  mediaType: string;
  events: WalkthroughEvents;
};

export type SaveResult =
  | { ok: true; walkthrough: WalkthroughSummary }
  // `error` is the api's refusal code, when it gave one, so a limit can be told from any other failure.
  | { ok: false; message: string; error?: string };

export type WalkthroughApi = {
  /** The item's walkthroughs, or null where there are none to have (no service, no access). */
  list: () => Promise<WalkthroughList | null>;
  // `onProgress` hears the media part's bytes sent as they go.
  save: (
    input: SaveInput,
    onStage?: (stage: 'events' | 'media') => void,
    onProgress?: UploadProgress,
  ) => Promise<SaveResult>;
  read: (
    id: string,
  ) => Promise<{ walkthrough: WalkthroughSummary; events: WalkthroughEvents } | null>;
  media: (id: string) => Promise<Blob | null>;
  remove: (id: string) => Promise<boolean>;
  /** Rename one: the walkthrough as it now is, or null when it couldn't be. */
  rename: (id: string, title: string) => Promise<WalkthroughSummary | null>;
  /** Its public link on or off: the walkthrough as it now is (`shareCode`), or null when it couldn't be. */
  share: (id: string, on: boolean) => Promise<WalkthroughSummary | null>;
};

const bodyOf = async (res: Response): Promise<Record<string, unknown>> => {
  const body: unknown = await res.json().catch(() => null);
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
};

export function walkthroughApi(
  { base, fetch }: WalkthroughApiDeps,
  itemId: string,
): WalkthroughApi {
  const d = `d=${encodeURIComponent(itemId)}`;
  const at = (path = '') => `${base}/walkthroughs${path}?${d}`;
  const of = (id: string, rest = '') => at(`/${encodeURIComponent(id)}${rest}`);
  const failed = async (res: Response) => {
    const body = await bodyOf(res);
    return {
      ok: false as const,
      message: walkthroughRefusalMessage(body),
      ...(typeof body.error === 'string' ? { error: body.error } : {}),
    };
  };
  const safely = async <T>(work: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await work();
    } catch (err) {
      console.warn('[walkthroughs] request failed', err);
      return fallback;
    }
  };

  return {
    list: () =>
      safely(async () => {
        const res = await fetch(at());
        return res.ok ? ((await res.json()) as WalkthroughList) : null;
      }, null),

    save: async (input, onStage, onProgress) => {
      try {
        onStage?.('events');
        const started = await fetch(at(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: input.title,
            author: input.author,
            mediaType: input.mediaType,
            mediaBytes: input.media.size,
            events: input.events,
          }),
        });
        if (!started.ok) return await failed(started);
        const { walkthrough } = (await started.json()) as { walkthrough: WalkthroughSummary };
        onStage?.('media');
        const put = await fetch(
          of(walkthrough.id, '/media'),
          {
            method: 'PUT',
            headers: { 'Content-Type': input.mediaType },
            body: input.media,
          },
          onProgress ? { uploadProgress: onProgress } : undefined,
        );
        if (!put.ok) {
          // The started one would wait for the daily sweep; deleting it now frees its place at once.
          void fetch(of(walkthrough.id), { method: 'DELETE' }).catch(() => undefined);
          return await failed(put);
        }
        return {
          ok: true,
          walkthrough: ((await put.json()) as { walkthrough: WalkthroughSummary }).walkthrough,
        };
      } catch (err) {
        console.warn('[walkthroughs] save failed', err);
        return { ok: false, message: walkthroughRefusalMessage({}) };
      }
    },

    read: (id) =>
      safely(async () => {
        const res = await fetch(of(id));
        return res.ok
          ? ((await res.json()) as { walkthrough: WalkthroughSummary; events: WalkthroughEvents })
          : null;
      }, null),

    media: (id) =>
      safely(async () => {
        const res = await fetch(of(id, '/media'));
        return res.ok ? await res.blob() : null;
      }, null),

    remove: (id) => safely(async () => (await fetch(of(id), { method: 'DELETE' })).ok, false),

    rename: (id, title) =>
      safely(async () => {
        const res = await fetch(of(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        return res.ok
          ? ((await res.json()) as { walkthrough: WalkthroughSummary }).walkthrough
          : null;
      }, null),

    share: (id, on) =>
      safely(async () => {
        const res = await fetch(of(id, '/share'), { method: on ? 'PUT' : 'DELETE' });
        return res.ok
          ? ((await res.json()) as { walkthrough: WalkthroughSummary }).walkthrough
          : null;
      }, null),
  };
}
