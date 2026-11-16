// Each app's door onto the Library (liveworkspace/docs/specs/006-media/libraries.md "Each app's door"): `/api/library`
// on the app's api, for its own editor. The app binds only what is its own (the kinds it draws, its element migration
// and check, its server-side SVG renderer, who the caller is and their teams); the rest is here, once, so the three
// apps' doors can't drift.
//
//   GET    /api/library               the list
//   POST   /api/library               save `{ scope, teamId?, folder, title, width, height, elements }`
//   POST   /api/library/:id/place     an item's elements, to place
//   PUT    /api/library/:id           rename `{ title }`
//   PUT    /api/library/folders       rename a folder `{ scope, teamId?, from, to }`
//   DELETE /api/library/:id           delete

import {
  LIBRARY_ITEM_BYTES_MAX,
  LIBRARY_ITEM_ELEMENTS_MAX,
  LIBRARY_PREVIEW_BYTES_MAX,
  isLibrarySide,
  normaliseLibraryFolder,
  normaliseLibraryTitle,
  type LibraryActor,
  type LibraryScope,
} from './library';
import type { LibraryCalls, LibraryResult } from './library-client';

export type LibraryDoorKit = {
  // The element kinds this app draws (its ELEMENT_TYPES).
  kinds: ReadonlySet<string>;
  // The elements this app keeps of a list: each migrated, then checked; the ones that fail are left out.
  clean: (elements: readonly unknown[]) => unknown[];
  // The elements drawn as an SVG by this app's server-side renderer, or null when it can't.
  preview: (elements: readonly unknown[]) => string | null;
};

// An app's kit from its own parts: its kinds, its element migration and check, and its renderer.
export function libraryKitOf(parts: {
  kinds: ReadonlySet<string>;
  migrate: (elements: readonly unknown[]) => readonly unknown[];
  isValid: (element: unknown) => boolean;
  render: (elements: readonly unknown[]) => string;
}): LibraryDoorKit {
  return {
    kinds: parts.kinds,
    clean: (elements) => parts.migrate(elements).filter((el) => parts.isValid(el)),
    preview: (elements) => parts.render(elements),
  };
}

// The actor an app vouches for: its media owner for the caller, and the teams their token says they are in.
export function libraryActorOf(
  owner: string,
  teams: readonly { id: string; name: string; role: string }[] | null | undefined,
): LibraryActor {
  return {
    owner,
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role === 'admin' ? 'admin' : 'member',
    })),
  };
}

export type LibraryDoorInput = {
  method: string;
  // The path below `/api/library`, split: `[]`, `[id]`, `[id, 'place']` or `['folders']`.
  path: readonly string[];
  // Who is asking, or null for no caller (the app answers 401 before this for most routes).
  actor: LibraryActor | null;
  // The service's calls, or null when this deploy has no media key.
  library: LibraryCalls | null;
  kit: LibraryDoorKit;
  // The request's JSON object, or null when it isn't one.
  readBody: () => Promise<Record<string, unknown> | null>;
  // The app's own JSON answer (its CORS headers on it).
  json: (body: unknown, init?: ResponseInit) => Response;
};

const encoder = new TextEncoder();
const bytesOf = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

const SCOPES = new Set<LibraryScope>(['personal', 'team']);

// The scope a body names: `{ scope, teamId }`, or null.
function scopeOf(
  body: Record<string, unknown>,
): { scope: LibraryScope; teamId: string | null } | null {
  const scope = body.scope as LibraryScope;
  if (!SCOPES.has(scope)) return null;
  if (scope === 'personal') return { scope, teamId: null };
  return typeof body.teamId === 'string' && body.teamId !== ''
    ? { scope, teamId: body.teamId }
    : null;
}

export async function handleLibraryDoor(input: LibraryDoorInput): Promise<Response> {
  const { method, path, actor, library, kit, json } = input;
  const refuse = (error: string, status: number) => {
    console.warn('[library] door refused', { error, status });
    return json({ error }, { status });
  };
  if (!actor) return refuse('unauthorized', 401);
  if (!library) return refuse('library_unavailable', 503);
  const answer = <T>(result: LibraryResult<T>, status = 200) =>
    result.ok ? json(result.value, { status }) : json(result.body, { status: result.status });

  if (path.length === 0 && method === 'GET') {
    return answer(await library.list(actor, [...kit.kinds]));
  }

  if (path.length === 0 && method === 'POST') {
    const body = await input.readBody();
    if (!body) return refuse('invalid_body', 400);
    const scope = scopeOf(body);
    const title = normaliseLibraryTitle(body.title);
    const folder = normaliseLibraryFolder(body.folder);
    if (!scope) return refuse('invalid_scope', 400);
    if (!title) return refuse('invalid_title', 400);
    if (folder === null) return refuse('invalid_folder', 400);
    if (!isLibrarySide(body.width) || !isLibrarySide(body.height)) {
      return refuse('invalid_size', 400);
    }
    const raw = body.elements;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIBRARY_ITEM_ELEMENTS_MAX) {
      return refuse('invalid_elements', 400);
    }
    // Saved as this app keeps elements: every one must pass its check, or nothing is saved.
    const elements = kit.clean(raw);
    if (elements.length !== raw.length) return refuse('invalid_elements', 400);
    if (bytesOf(elements) > LIBRARY_ITEM_BYTES_MAX) return refuse('item_too_large', 413);
    let preview: string | null = null;
    try {
      preview = kit.preview(elements);
    } catch (error) {
      console.warn('[library] preview failed', { error: String(error) });
    }
    if (preview !== null && encoder.encode(preview).length > LIBRARY_PREVIEW_BYTES_MAX)
      preview = null;
    const saved = await library.save(actor, {
      ...scope,
      folder,
      title,
      width: body.width,
      height: body.height,
      elements,
      preview,
    });
    if (saved.ok)
      console.info('[library] saved', { scope: scope.scope, elements: elements.length });
    return answer(saved, 201);
  }

  if (path.length === 1 && path[0] === 'folders' && method === 'PUT') {
    const body = await input.readBody();
    if (!body) return refuse('invalid_body', 400);
    const scope = scopeOf(body);
    const from = normaliseLibraryFolder(body.from);
    const to = normaliseLibraryFolder(body.to);
    if (!scope) return refuse('invalid_scope', 400);
    if (from === null || to === null || to === '') return refuse('invalid_folder', 400);
    return answer(await library.renameFolder(actor, { ...scope, from, to }));
  }

  const id = path[0];
  if (!id) return refuse('not_found', 404);

  if (path.length === 2 && path[1] === 'place' && method === 'POST') {
    const placed = await library.place(actor, id);
    if (!placed.ok) return answer(placed);
    // Placed as this app keeps elements: any it can't draw are left out.
    const elements = kit.clean(placed.value.elements);
    return json({ ...placed.value, elements });
  }

  if (path.length !== 1) return refuse('not_found', 404);

  if (method === 'PUT') {
    const body = await input.readBody();
    const title = normaliseLibraryTitle(body?.title);
    if (!title) return refuse('invalid_title', 400);
    return answer(await library.rename(actor, id, title));
  }

  if (method === 'DELETE') return answer(await library.remove(actor, id));

  return refuse('not_found', 404);
}
