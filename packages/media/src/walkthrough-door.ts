// Each canvas app's door onto its walkthroughs (liveworkspace/docs/specs/006-media/walkthroughs.md "Each app's door"):
// `/api/walkthroughs` on the app's api, for its own editor. The app binds only what is its own (its media owner for
// the caller, whether the caller is a person in their own editor, and its grant on the item); the rest is here, once,
// so the four doors can't drift.
//
//   GET    /api/walkthroughs?d=              the item's walkthroughs
//   GET    /api/walkthroughs?mine=1          the caller's own, on every item (the Explorer's library)
//   POST   /api/walkthroughs?d=              start one (an Editor)
//   PUT    /api/walkthroughs/:id/media?d=    its media, streamed (the Editor who started it)
//   GET    /api/walkthroughs/:id?d=          one, with its events
//   GET    /api/walkthroughs/:id/media?d=    its media
//   DELETE /api/walkthroughs/:id?d=          delete (its recorder, or an Editor)
//   PATCH  /api/walkthroughs/:id?d=          rename: { title } (its recorder, or an Editor)
//   PUT    /api/walkthroughs/:id/share?d=    its public link on (its recorder, or an Editor)
//   DELETE /api/walkthroughs/:id/share?d=    and off

import { WALKTHROUGH_CEILING_MS } from './tier-limits';
import {
  parseWalkthroughStart,
  WALKTHROUGH_MAX_MS,
  WALKTHROUGH_MEDIA_MAX_BYTES,
  WALKTHROUGH_START_MAX_BYTES,
  walkthroughMediaType,
  type Walkthrough,
  type WalkthroughLibraryEntry,
  type WalkthroughSummary,
} from './walkthrough';
import type { WalkthroughCalls, WalkthroughResult } from './walkthrough-client';

/** The caller's hold on the item, as the app's grant says it. */
export type WalkthroughAccess = {
  level: 'view' | 'participate' | 'edit';
  // A tab-scoped link, a Community visit or an item in the Trash: no walkthroughs (they can travel across tabs, and
  // a Community post's visitors are the public).
  closed: boolean;
  // The item's owner as a subscription scope (`itemPayerScope` of the grant), for the service to read its tier beside
  // the recorder's with Pro on (walkthroughs.md "With Pro on"). Left out, the recorder's own tier applies.
  itemOwner?: string | null;
};

export type WalkthroughDoorInput = {
  method: string;
  // The path below `/api/walkthroughs`, split: `[]`, `[id]` or `[id, 'media']`.
  path: readonly string[];
  // `?d=`: the item the walkthroughs belong to.
  itemId: string | null;
  // The caller's media owner, or null for a caller with no identity (a link visitor).
  owner: string | null;
  // A person in their own editor: not an API token, not a workbench session. Only a person records.
  person: boolean;
  // The caller's hold on the item, or null for none; a Response is the app's own refusal, answered as it is.
  access: (itemId: string) => Promise<WalkthroughAccess | null | Response>;
  // The service's calls, or null when this deploy has no media key.
  calls: WalkthroughCalls | null;
  // Whether Pro is on in this deployment (`proEnabled(env.PRO_ENABLED)`). False: the door holds the legacy length
  // itself and asks the service for no limits, exactly as before Pro. True, or left out by an app that has not said:
  // a recorder's list asks the service what they may record, and a start up to the longest any tier records passes
  // the door for the service to decide. The service knows whether Pro is on, and with it off answers no limits and
  // holds the legacy length with the same refusal, so a door that has not said is right either way.
  pro?: boolean;
  request: Request;
  // The app's own JSON answer (its CORS headers on it), and the headers for the media's bytes.
  json: (body: unknown, init?: ResponseInit) => Response;
  corsHeaders: HeadersInit;
};

const UNAVAILABLE = 'walkthroughs_unavailable';

export function walkthroughSummary(
  { item: _item, ready: _ready, ...walkthrough }: Walkthrough,
  mine: boolean,
  canDelete: boolean,
): WalkthroughSummary {
  return { ...walkthrough, mine, canDelete };
}

export async function handleWalkthroughDoor(input: WalkthroughDoorInput): Promise<Response> {
  const { method, path, itemId, owner, calls, request, json } = input;
  const refuse = (error: string, status: number, extra: Record<string, unknown> = {}) => {
    console.warn('[walkthroughs] door refused', { error, status });
    return json({ error, ...extra }, { status });
  };
  // A refusal from the service, passed on as it came, except one about this app's key or the service itself.
  const passOn = <T>(result: WalkthroughResult<T>, status = 200, shape?: (value: T) => unknown) => {
    if (result.ok) return json(shape ? shape(result.value) : result.value, { status });
    if (result.status === 401 || result.status >= 500) {
      console.error('[walkthroughs] media service answered', { status: result.status });
      return json({ error: UNAVAILABLE }, { status: 503 });
    }
    return json(result.body, { status: result.status });
  };

  const id = path[0];
  const route =
    path.length === 0
      ? 'list'
      : path.length === 1
        ? 'one'
        : path.length === 2 && path[1] === 'media'
          ? 'media'
          : path.length === 2 && path[1] === 'share'
            ? 'share'
            : null;
  if (!route || (route !== 'list' && !id)) return refuse('not_found', 404);
  const allowed: Record<typeof route, readonly string[]> = {
    list: ['GET', 'POST'],
    one: ['GET', 'DELETE', 'PATCH'],
    media: ['GET', 'PUT'],
    share: ['PUT', 'DELETE'],
  };
  if (!allowed[route].includes(method)) return refuse('not_found', 404);
  // Only a route that is one gets this far, so a path the door doesn't serve answers 404 whether or not the
  // service is there.
  if (!calls) return json({ error: UNAVAILABLE }, { status: 503 });
  // The caller's own, across the app (the Explorer's Walkthroughs library): theirs to watch and delete, so no grant
  // is read; an item they can no longer open still lists, and its media answers 404 as the door's media route does.
  if (
    route === 'list' &&
    method === 'GET' &&
    !itemId &&
    new URL(request.url).searchParams.get('mine') === '1'
  ) {
    if (owner === null || !input.person) return refuse('forbidden', 403);
    return passOn(await calls.listOwned(owner), 200, (value) => ({
      walkthroughs: value.walkthroughs.map(({ walkthrough }): WalkthroughLibraryEntry => ({
        ...walkthroughSummary(walkthrough, true, true),
        item: walkthrough.item,
      })),
      // With Pro on, the person's own tier and count (walkthroughs.md "The Explorer's Walkthroughs").
      ...(value.limits ? { limits: value.limits } : {}),
    }));
  }
  if (!itemId) return refuse('missing_item', 400);

  const access = await input.access(itemId);
  if (access instanceof Response) return access;
  if (!access || access.closed) return refuse('not_found', 404);
  const editor = access.level === 'edit';
  // Only a person, as themselves, in their own editor records.
  const recorder = editor && input.person && owner !== null;

  if (route === 'list' && method === 'GET') {
    // Only someone who may record is told what they may record, and nothing is asked for where Pro is known off.
    const listed =
      input.pro !== false && recorder && owner !== null
        ? await calls.list(itemId, { owner, itemOwner: access.itemOwner ?? null })
        : await calls.list(itemId);
    return passOn(listed, 200, (value) => ({
      walkthroughs: value.walkthroughs.map(({ walkthrough, owner: by }) => {
        const mine = owner !== null && by === owner;
        return walkthroughSummary(walkthrough, mine, mine || editor);
      }),
      canRecord: recorder,
      ...(value.limits ? { limits: value.limits } : {}),
    }));
  }

  if (route === 'list') {
    if (!recorder || owner === null) return refuse('forbidden', 403);
    const length = Number(request.headers.get('Content-Length') ?? '0');
    if (length > WALKTHROUGH_START_MAX_BYTES) return refuse('events_too_large', 413);
    const text = await request.text().catch(() => null);
    if (text === null || text.length > WALKTHROUGH_START_MAX_BYTES) {
      return refuse('events_too_large', 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return refuse('invalid_body', 400);
    }
    // The item is the one the grant was checked on, whatever the body says.
    const parsed = parseWalkthroughStart(
      { ...(body as object), item: itemId },
      input.pro === false ? WALKTHROUGH_MAX_MS : WALKTHROUGH_CEILING_MS,
    );
    if (!parsed.ok)
      return refuse(parsed.refusal.body.error, parsed.refusal.status, parsed.refusal.body);
    return passOn(
      input.pro !== false && access.itemOwner
        ? await calls.start(owner, parsed.start, access.itemOwner)
        : await calls.start(owner, parsed.start),
      201,
    );
  }

  if (route === 'media' && method === 'PUT') {
    if (!recorder || owner === null) return refuse('forbidden', 403);
    const type = walkthroughMediaType(request.headers.get('Content-Type'));
    const length = Number(request.headers.get('Content-Length') ?? '0');
    if (!type) return refuse('media_mismatch', 400);
    if (!Number.isInteger(length) || length <= 0) return refuse('media_mismatch', 400);
    if (length > WALKTHROUGH_MEDIA_MAX_BYTES) {
      return refuse('file_too_large', 413, { limitBytes: WALKTHROUGH_MEDIA_MAX_BYTES });
    }
    if (!request.body) return refuse('media_mismatch', 400);
    // Streamed through: the bytes are never held whole here.
    return passOn(
      await calls.upload(owner, id!, { body: request.body, type, length }),
      200,
      (value) => ({ walkthrough: walkthroughSummary(value.walkthrough, true, true) }),
    );
  }

  if (route === 'media') {
    const media = await calls.media(id!, itemId);
    if (!media?.body) return refuse('not_found', 404);
    const headers = new Headers(input.corsHeaders);
    headers.set('Content-Type', media.contentType);
    if (media.length !== null) headers.set('Content-Length', String(media.length));
    // Its bytes never change under its id; who may hear them is checked on every request.
    headers.set('Cache-Control', 'private, max-age=86400');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(media.body, { headers });
  }

  if (method === 'GET') {
    const read = await calls.read(id!);
    if (!read || (read.ok && read.value.walkthrough.item !== itemId)) {
      return refuse('not_found', 404);
    }
    return passOn(read, 200, (value) => {
      const mine = owner !== null && value.owner === owner;
      return {
        walkthrough: walkthroughSummary(value.walkthrough, mine, mine || editor),
        events: value.events,
      };
    });
  }

  // Rename, share and delete: an Editor on any on the item; anyone else only their own, which the service checks.
  const by = editor ? { item: itemId } : owner !== null ? { owner } : null;
  if (!by) return refuse('forbidden', 403);
  const shaped = (value: { walkthrough: Walkthrough }) => ({
    walkthrough: walkthroughSummary(value.walkthrough, 'owner' in by, true),
  });
  if (route === 'share') return passOn(await calls.share(id!, by, method === 'PUT'), 200, shaped);
  if (method === 'PATCH') {
    const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
    if (typeof body?.title !== 'string' || !body.title.trim()) return refuse('invalid_title', 400);
    return passOn(await calls.rename(id!, by, body.title), 200, shaped);
  }
  return passOn(await calls.remove(id!, by));
}
