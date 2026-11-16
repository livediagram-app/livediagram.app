// The Library's contract (liveworkspace/docs/specs/006-media/libraries.md): what an item is, its limits, the actor an
// app vouches for, and the pure rules the service, each app's door and the editors share: the kinds an item uses and
// whether an app can draw them, the gallery pictures it places and their copies, who may see and tidy a scope, and the
// ids of the old shape libraries read in place.

import { MEDIA_APPS, type MediaApp } from './apps';
import { isGalleryImageId } from './gallery-id';

// The service's routes, under the media API's `/app`.
export const LIBRARY_PATH = '/library';

export const LIBRARY_SCOPES = ['personal', 'team'] as const;
export type LibraryScope = (typeof LIBRARY_SCOPES)[number];

export const LIBRARY_TITLE_MAX = 200;
export const LIBRARY_FOLDER_MAX = 80;
// Items one scope (a person's Personal library, or one team's) holds.
export const LIBRARY_ITEMS_PER_SCOPE_MAX = 500;
// One item's elements as JSON: a selection of a few hundred elements fits with room to spare.
export const LIBRARY_ITEM_BYTES_MAX = 256 * 1024;
export const LIBRARY_ITEM_ELEMENTS_MAX = 500;
// One item's preview SVG. A larger drawing is not kept, and its tile shows the title alone.
export const LIBRARY_PREVIEW_BYTES_MAX = 16 * 1024;
// An item's width or height, in canvas units.
export const LIBRARY_ITEM_SIDE_MAX = 100_000;
// The apps whose old shape libraries the service reads in place, and how long it waits for each.
export const LIBRARY_LEGACY_APPS: readonly MediaApp[] = ['livediagram.app', 'livehuddle.app'];
export const LIBRARY_LEGACY_TIMEOUT_MS = 3_000;
// The `refs.app` a library item's pictures are kept under, so the unused-image sweep never takes them.
export const LIBRARY_REF_APP = 'library';
// Teams an actor carries: an account is in at most 50.
export const LIBRARY_ACTOR_TEAMS_MAX = 50;

export type LibraryTeamRole = 'admin' | 'member';
export type LibraryTeam = { id: string; name: string; role: LibraryTeamRole };
// Who is asking, as their app vouches: their media owner and the teams their token says they are in.
export type LibraryActor = { owner: string; teams: LibraryTeam[] };

export type LibraryLegacyRef = { app: MediaApp; libraryId: string; itemId: string };

// An item as the list answers it: everything but its elements.
export type LibraryItemSummary = {
  id: string;
  scope: LibraryScope;
  teamId: string | null;
  folder: string;
  title: string;
  width: number;
  height: number;
  kinds: string[];
  preview: string | null;
  app: string;
  createdAt: number;
  updatedAt: number;
  // An old shape library's item, read in place.
  legacy?: { app: MediaApp; libraryId: string };
};

export type LibraryListResponse = {
  items: LibraryItemSummary[];
  // The teams the actor is in, as their app vouched: where they may save.
  teams: LibraryTeam[];
  // Items left out because they use a kind the asking app can't draw.
  hidden: number;
  legacy: {
    // Apps whose old shape libraries couldn't be read this time.
    unavailable: MediaApp[];
    // The asking app's own shape libraries already copied into the Library (their ids), which it leaves out.
    copied: string[];
    // Whether a shape library read in place can be tidied (copied on first write): a signed-in person's only.
    writable: boolean;
  };
};

export type LibrarySaveInput = {
  scope: LibraryScope;
  teamId?: string | null;
  folder: string;
  title: string;
  width: number;
  height: number;
  elements: unknown[];
  preview: string | null;
};

export type LibraryPlaceResponse = { elements: unknown[]; width: number; height: number };

// An old shape library as its app's internal door answers it (each product's shape-libraries.md "API").
export type LegacyShapeLibrary = {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  items: { id: string; title: string; width: number; height: number; elements: unknown[] }[];
  // Each shape drawn as SVG by its app, by item id, when it could be.
  previews?: Record<string, string>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

// A title trimmed, 1 to LIBRARY_TITLE_MAX characters, else null.
export function normaliseLibraryTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  return title.length > 0 && title.length <= LIBRARY_TITLE_MAX ? title : null;
}

// A folder trimmed, 0 to LIBRARY_FOLDER_MAX characters (empty is the scope's top), else null.
export function normaliseLibraryFolder(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const folder = value.trim();
  return folder.length <= LIBRARY_FOLDER_MAX ? folder : null;
}

export function isLibrarySide(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= LIBRARY_ITEM_SIDE_MAX
  );
}

// The kinds a set of elements uses: each element's `type`, once each, sorted.
export function elementKinds(elements: readonly unknown[]): string[] {
  const kinds = new Set<string>();
  for (const el of elements) {
    if (isRecord(el) && typeof el.type === 'string' && el.type !== '') kinds.add(el.type);
  }
  return [...kinds].sort();
}

// Whether an app that draws `appKinds` can place an item using `kinds`.
export function fitsKinds(kinds: readonly string[], appKinds: ReadonlySet<string>): boolean {
  return kinds.every((kind) => appKinds.has(kind));
}

// The gallery pictures a set of elements places: each image element's, once each, in order.
export function libraryImageIds(elements: readonly unknown[]): string[] {
  const ids = new Set<string>();
  for (const el of elements) {
    if (isRecord(el) && el.type === 'image' && isGalleryImageId(el.imageId)) ids.add(el.imageId);
  }
  return [...ids];
}

// The elements with each image element's picture swapped for its copy in `copies`; the rest unchanged.
export function withLibraryImageIds(
  elements: readonly unknown[],
  copies: ReadonlyMap<string, string>,
): unknown[] {
  if (copies.size === 0) return [...elements];
  return elements.map((el) => {
    if (!isRecord(el) || el.type !== 'image' || typeof el.imageId !== 'string') return el;
    const copy = copies.get(el.imageId);
    return copy ? { ...el, imageId: copy } : el;
  });
}

// A team's own gallery owner, where a team library's pictures are copied.
export function teamMediaOwner(teamId: string): string {
  return `team:${teamId}`;
}

const LEGACY_PREFIX = 'legacy~';

// An old shape library's item, as the Library names it.
export function legacyItemId(ref: LibraryLegacyRef): string {
  return `${LEGACY_PREFIX}${ref.app}~${ref.libraryId}~${ref.itemId}`;
}

// The shape library and item an id names, or null for any other id.
export function parseLegacyItemId(id: string): LibraryLegacyRef | null {
  if (!id.startsWith(LEGACY_PREFIX)) return null;
  const [app, libraryId, itemId, ...rest] = id.slice(LEGACY_PREFIX.length).split('~');
  if (rest.length > 0 || !app || !libraryId || !itemId) return null;
  if (!(MEDIA_APPS as readonly string[]).includes(app)) return null;
  return { app: app as MediaApp, libraryId, itemId };
}

const isId = (v: unknown, max = 200): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

// The actor a request carries, checked for shape: an owner and up to LIBRARY_ACTOR_TEAMS_MAX teams. Null otherwise.
export function parseLibraryActor(value: unknown): LibraryActor | null {
  if (!isRecord(value) || !isId(value.owner) || !Array.isArray(value.teams)) return null;
  if (value.teams.length > LIBRARY_ACTOR_TEAMS_MAX) return null;
  const teams: LibraryTeam[] = [];
  for (const t of value.teams) {
    if (!isRecord(t) || !isId(t.id) || typeof t.name !== 'string') return null;
    if (t.role !== 'admin' && t.role !== 'member') return null;
    teams.push({ id: t.id, name: t.name.slice(0, 120), role: t.role });
  }
  return { owner: value.owner, teams };
}

// The team of an actor's, or null when they are not in it.
export function actorTeam(actor: LibraryActor, teamId: string | null): LibraryTeam | null {
  return actor.teams.find((t) => t.id === teamId) ?? null;
}

// Whether the actor may see (and so place from, and save to) a scope.
export function canUseScope(
  actor: LibraryActor,
  scope: LibraryScope,
  scopeId: string | null,
): boolean {
  return scope === 'personal' ? scopeId === actor.owner : actorTeam(actor, scopeId) !== null;
}

// Whether the actor may tidy a scope: its owner for Personal, an admin for a team.
export function canTidyScope(
  actor: LibraryActor,
  scope: LibraryScope,
  scopeId: string | null,
): boolean {
  return scope === 'personal'
    ? scopeId === actor.owner
    : actorTeam(actor, scopeId)?.role === 'admin';
}
