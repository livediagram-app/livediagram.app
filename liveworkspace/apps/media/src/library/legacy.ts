// The old shape libraries, read in place (liveworkspace/docs/specs/006-media/libraries.md "The old shape libraries,
// read in place"): livediagram's and livehuddle's draw.io libraries stay in each person's store, and the service reads
// them through each app's internal door, with that app's media key, for a signed-in person. The first tidy of one
// copies it into the person's Personal library, and the copy is what the Library shows from then on.

import {
  LIBRARY_FOLDER_MAX,
  LIBRARY_LEGACY_APPS,
  LIBRARY_LEGACY_TIMEOUT_MS,
  LIBRARY_PREVIEW_BYTES_MAX,
  LIBRARY_TITLE_MAX,
  elementKinds,
  legacyItemId,
  libraryImageIds,
  type LegacyShapeLibrary,
  type LibraryItemSummary,
  type MediaApp,
} from '@liveworkspace/media';
import { appDoor, indexAppOf, type Env } from '../env';
import type { NewRow } from './store';

// Only an account's libraries are read: a guest's media owner is a hash that never leaves its app, and a team has
// none. An account id is `user_…` in every app.
export const isAccountOwner = (owner: string) => owner.startsWith('user_');

const legacyKey = (app: MediaApp, libraryId: string) => `${app}~${libraryId}`;
export { legacyKey };

// One app's shape libraries for an owner, or null when its door failed or isn't configured.
export async function readAppLegacy(
  env: Env,
  app: MediaApp,
  owner: string,
): Promise<LegacyShapeLibrary[] | null> {
  const door = appDoor(env, indexAppOf(app));
  if (!door) return null;
  try {
    const res = await fetch(
      `${door.origin}/api/internal/shape-libraries?owner=${encodeURIComponent(owner)}`,
      {
        headers: { Authorization: `Bearer ${door.key}` },
        signal: AbortSignal.timeout(LIBRARY_LEGACY_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      await res.body?.cancel();
      console.warn('[library] legacy door failed', { app, status: res.status });
      return null;
    }
    const body = (await res.json()) as { libraries?: unknown };
    return Array.isArray(body.libraries) ? (body.libraries as LegacyShapeLibrary[]) : [];
  } catch (error) {
    console.warn('[library] legacy door failed', {
      app,
      reason: error instanceof Error ? error.name : 'fetch_failed',
    });
    return null;
  }
}

const titleOf = (title: unknown, i: number) =>
  (typeof title === 'string' && title.trim() ? title.trim() : `Shape ${i + 1}`).slice(
    0,
    LIBRARY_TITLE_MAX,
  );
// The Personal folder a shape library reads as: its name, cut to a folder's length.
export const legacyFolderOf = (name: unknown) =>
  (typeof name === 'string' ? name.trim() : '').slice(0, LIBRARY_FOLDER_MAX);
const sideOf = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0);

// One shape library's items as Library summaries, in its order.
export function legacySummaries(app: MediaApp, library: LegacyShapeLibrary): LibraryItemSummary[] {
  return (library.items ?? []).map((item, i) => {
    const preview = library.previews?.[item.id] ?? null;
    return {
      id: legacyItemId({ app, libraryId: library.id, itemId: item.id }),
      scope: 'personal',
      teamId: null,
      folder: legacyFolderOf(library.name),
      title: titleOf(item.title, i),
      width: sideOf(item.width),
      height: sideOf(item.height),
      kinds: elementKinds(Array.isArray(item.elements) ? item.elements : []),
      preview: preview && preview.length <= LIBRARY_PREVIEW_BYTES_MAX ? preview : null,
      app,
      createdAt: library.createdAt,
      updatedAt: library.updatedAt,
      legacy: { app, libraryId: library.id },
    };
  });
}

// The caller's view of every other legacy app's shape libraries: the ones not copied yet, and the apps that failed.
export async function readLegacy(
  env: Env,
  callerApp: MediaApp,
  owner: string,
  copied: ReadonlySet<string>,
): Promise<{ items: LibraryItemSummary[]; unavailable: MediaApp[] }> {
  if (!isAccountOwner(owner)) return { items: [], unavailable: [] };
  const apps = LIBRARY_LEGACY_APPS.filter(
    (app) => app !== callerApp && appDoor(env, indexAppOf(app)),
  );
  const answers = await Promise.all(apps.map((app) => readAppLegacy(env, app, owner)));
  const items: LibraryItemSummary[] = [];
  const unavailable: MediaApp[] = [];
  answers.forEach((libraries, i) => {
    const app = apps[i]!;
    if (libraries === null) {
      unavailable.push(app);
      return;
    }
    for (const library of libraries) {
      if (!copied.has(legacyKey(app, library.id))) items.push(...legacySummaries(app, library));
    }
  });
  return { items, unavailable };
}

// The rows a shape library is copied into: every item, fresh ids, in a Personal folder of the library's name.
export function legacyCopyRows(
  app: MediaApp,
  owner: string,
  library: LegacyShapeLibrary,
): NewRow[] {
  return (library.items ?? []).map((item, i) => {
    const elements = Array.isArray(item.elements) ? item.elements : [];
    const preview = library.previews?.[item.id] ?? null;
    return {
      id: crypto.randomUUID(),
      scope: 'personal',
      scope_id: owner,
      folder: legacyFolderOf(library.name),
      title: titleOf(item.title, i),
      width: sideOf(item.width),
      height: sideOf(item.height),
      kinds: JSON.stringify(elementKinds(elements)),
      elements: JSON.stringify(elements),
      images: JSON.stringify(libraryImageIds(elements)),
      preview: preview && preview.length <= LIBRARY_PREVIEW_BYTES_MAX ? preview : null,
      app,
      created_by: owner,
      legacy_ref: `${app}~${library.id}~${item.id}`,
    };
  });
}
