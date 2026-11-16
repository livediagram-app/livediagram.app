// The internal door livediagram and livehuddle keep for the Library's read in place (liveworkspace/docs/specs/006-media/
// libraries.md "The old shape libraries, read in place"): `GET /api/internal/shape-libraries?owner=<account>`, called
// by the media service with the app's media key. It answers the person's shape libraries as their store holds them,
// with each shape drawn as SVG up to a budget, so the Library can show them in other apps without moving them.

import { LIBRARY_PREVIEW_BYTES_MAX, type LegacyShapeLibrary } from './library';

// The most drawings one answer carries, in bytes of SVG: a person's 100 libraries of 1,000 shapes are never all drawn
// on one list. Shapes past it show their title alone.
export const LEGACY_PREVIEWS_MAX_BYTES = 600_000;
export const LEGACY_DOOR_PATH = '/api/internal/shape-libraries';

type StoredLibrary = Omit<LegacyShapeLibrary, 'previews'>;

export type LegacyDoorInput = {
  request: Request;
  // The app's media key; unset, the door is shut.
  key: string | undefined;
  // The owner's shape libraries, newest first, from their store.
  read: (owner: string) => Promise<StoredLibrary[]>;
  // One shape's drawing, or null when the app can't draw it.
  draw: (item: StoredLibrary['items'][number]) => string | null;
  json: (body: unknown, init?: ResponseInit) => Response;
};

async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i]! ^ ya[i]!;
  return diff === 0;
}

export async function handleLegacyShapeLibrariesDoor(input: LegacyDoorInput): Promise<Response> {
  const { request, key, json } = input;
  if (request.method !== 'GET') return json({ error: 'not_found' }, { status: 404 });
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!key || !token || !(await sameSecret(token, key))) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  const owner = new URL(request.url).searchParams.get('owner') ?? '';
  // Only an account's libraries leave the app: a guest's id is its credential.
  if (!owner.startsWith('user_') || owner.length > 200) {
    return json({ error: 'invalid_owner' }, { status: 400 });
  }
  const libraries = await input.read(owner);
  let budget = LEGACY_PREVIEWS_MAX_BYTES;
  const answered: LegacyShapeLibrary[] = libraries.map((library) => {
    const previews: Record<string, string> = {};
    for (const item of library.items) {
      if (budget <= 0) break;
      let svg: string | null = null;
      try {
        svg = input.draw(item);
      } catch (error) {
        console.warn('[library] legacy preview failed', { error: String(error) });
      }
      if (!svg || svg.length > LIBRARY_PREVIEW_BYTES_MAX) continue;
      budget -= svg.length;
      previews[item.id] = svg;
    }
    return { ...library, previews };
  });
  console.info('[library] legacy door read', { libraries: answered.length });
  return json({ libraries: answered });
}
