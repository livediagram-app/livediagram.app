// Which images an item may serve, answered in the item's own SQLite (its Durable Object): placement grants
// (liveworkspace/docs/specs/006-media/media.md "References"; an app's images spec, "Placement grants").
//
// A reference alone does not let an item serve an image: an id pasted into an unrelated item must not keep the bytes
// reachable after its reader loses access to the original. An item serves image X when X's owner owns the item, X's
// owner is entitled to place it there right now, or the item holds a grant for X. X's owner is entitled while they
// are a joined member of the item's team, or while they have written to the item since its last push (an edit key in
// its outbox: the index let them edit it). Grants are written only at trusted moments: as the item pushes the images
// its content places (`grantPlaced`, from the outbox drain) while X's owner is entitled, and when a copy carries an
// image its source could serve (`grant`). The live entitlement serves a placement before that push lands; the grant
// keeps serving it after the entitlement ends.
//
// Owners are as the media service names them (a guest's id is a one-way hash there), learned from the service once
// per image and kept in `image_owners`. The app supplies the three things only it knows: how to ask the service who
// owns an image, how the service names a person, and a team's joined people.

import type { SqlExec } from './outbox';

// The two tables, in the item's SQLite. Idempotent.
export const IMAGE_GRANT_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS image_owners (
     image_id TEXT PRIMARY KEY,
     owner_id TEXT NOT NULL
   ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS image_grants (
     image_id TEXT PRIMARY KEY,
     created_at INTEGER NOT NULL
   ) WITHOUT ROWID`,
];

export function ensureImageGrantSchema(sql: SqlExec): void {
  for (const statement of IMAGE_GRANT_SCHEMA) sql.exec(statement);
}

// The slice of SQL the grants use: a Durable Object's `SqlStorage` (`imageGrantSqlOf`) or a D1-shaped facade over
// it (`imageGrantSqlOfD1`).
export type ImageGrantSql = {
  all<T>(query: string, ...bindings: unknown[]): Promise<T[]>;
  run(query: string, ...bindings: unknown[]): Promise<void>;
};

export function imageGrantSqlOf(sql: SqlExec): ImageGrantSql {
  return {
    all: async <T>(query: string, ...bindings: unknown[]) =>
      sql.exec(query, ...bindings).toArray() as T[],
    run: async (query: string, ...bindings: unknown[]) => {
      sql.exec(query, ...bindings);
    },
  };
}

export function imageGrantSqlOfD1(db: Pick<D1Database, 'prepare'>): ImageGrantSql {
  return {
    all: async <T>(query: string, ...bindings: unknown[]) =>
      (
        await db
          .prepare(query)
          .bind(...bindings)
          .all<T>()
      ).results,
    run: async (query: string, ...bindings: unknown[]) => {
      await db
        .prepare(query)
        .bind(...bindings)
        .run();
    },
  };
}

// The item as the grants read it: who owns it and its team, if any.
export type ImageGrantItem = { ownerId: string | null; teamId: string | null };

export type ImageGrantDeps = {
  // The image's owner as the media service names them, or null for an id it does not know (or no service).
  lookupOwner: (imageId: string) => Promise<string | null>;
  // A person (an account id, or a guest's id) as the media service names them.
  mediaOwnerOf: (personId: string) => Promise<string>;
  // A team's joined account ids (invited people are not entitled). Remembered per isolate for `teamTtlMs`.
  teamMembers: (teamId: string) => Promise<Iterable<string>>;
};

export type ImageGrantOptions = {
  // Owner lookups sent to the media service at once.
  lookupsInFlight?: number;
  teamTtlMs?: number;
  // Teams remembered per isolate (oldest dropped first).
  teamsMax?: number;
  now?: () => number;
};

// Edit keys (`<person>@<time>`, the outbox's) to the people they name.
export function editorsOfKeys(keys: readonly string[]): string[] {
  return keys.map((k) => k.slice(0, k.lastIndexOf('@'))).filter((p) => p.length > 0);
}

type EditorKeys = readonly string[] | (() => Promise<readonly string[]>);

export function createImageGrants(deps: ImageGrantDeps, options: ImageGrantOptions = {}) {
  const inFlight = options.lookupsInFlight ?? 6;
  const ttl = options.teamTtlMs ?? 30_000;
  const max = options.teamsMax ?? 200;
  const now = options.now ?? Date.now;
  const teams = new Map<string, { ids: Set<string>; until: number }>();

  async function joinedMembersOf(teamId: string): Promise<Set<string>> {
    const at = now();
    const cached = teams.get(teamId);
    if (cached && cached.until > at) return cached.ids;
    const ids = new Set(await deps.teamMembers(teamId));
    teams.delete(teamId);
    teams.set(teamId, { ids, until: at + ttl });
    while (teams.size > max) {
      const oldest = teams.keys().next().value;
      if (oldest === undefined) break;
      teams.delete(oldest);
    }
    return ids;
  }

  async function editorsOf(keys: EditorKeys): Promise<Set<string>> {
    const list = typeof keys === 'function' ? await keys() : keys;
    return new Set(await Promise.all(editorsOfKeys(list).map((p) => deps.mediaOwnerOf(p))));
  }

  // Each image's owner as the media service names them ('' for an id it does not know), from `image_owners`,
  // asking the service once for each image not met before.
  async function imageOwners(
    sql: ImageGrantSql,
    ids: readonly string[],
  ): Promise<Map<string, string>> {
    const owners = new Map<string, string>();
    if (ids.length === 0) return owners;
    const rows = await sql.all<{ image_id: string; owner_id: string }>(
      'SELECT image_id, owner_id FROM image_owners WHERE image_id IN (SELECT value FROM json_each(?))',
      JSON.stringify(ids),
    );
    for (const row of rows) owners.set(row.image_id, row.owner_id);
    const missing = ids.filter((id) => !owners.has(id));
    if (missing.length === 0) return owners;
    const learned: [string, string][] = [];
    for (let i = 0; i < missing.length; i += inFlight) {
      await Promise.all(
        missing.slice(i, i + inFlight).map(async (id) => {
          const owner = (await deps.lookupOwner(id)) ?? '';
          owners.set(id, owner);
          learned.push([id, owner]);
        }),
      );
    }
    await sql.run(
      `INSERT OR REPLACE INTO image_owners (image_id, owner_id)
       SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?)`,
      JSON.stringify(learned),
    );
    return owners;
  }

  async function grantedOf(sql: ImageGrantSql, ids: readonly string[]): Promise<Set<string>> {
    const rows = await sql.all<{ image_id: string }>(
      'SELECT image_id FROM image_grants WHERE image_id IN (SELECT value FROM json_each(?))',
      JSON.stringify(ids),
    );
    return new Set(rows.map((r) => r.image_id));
  }

  // Of `ids` (owners known), those whose owner is entitled here right now: an editor since the last push, or a
  // joined teammate. The team is read only when there is someone else's image to judge.
  async function entitled(
    item: ImageGrantItem,
    ids: readonly string[],
    owners: Map<string, string>,
    editorKeys: EditorKeys,
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const [editors, members] = await Promise.all([
      editorsOf(editorKeys),
      item.teamId ? joinedMembersOf(item.teamId) : Promise.resolve(new Set<string>()),
    ]);
    return ids.filter((id) => {
      const owner = owners.get(id)!;
      return editors.has(owner) || members.has(owner);
    });
  }

  return {
    imageOwners,

    /**
     * The images of `ids` the item may serve. One read of the grants, one of the owners (the service asked only
     * for an image never met), and the editors and the team only when an image's owner is someone else.
     */
    async servableImageIds(
      sql: ImageGrantSql,
      item: ImageGrantItem,
      ids: readonly string[],
      editorKeys: EditorKeys,
    ): Promise<Set<string>> {
      const servable = new Set<string>();
      if (ids.length === 0) return servable;
      const [owners, granted] = await Promise.all([imageOwners(sql, ids), grantedOf(sql, ids)]);
      const itemOwner = item.ownerId ? await deps.mediaOwnerOf(item.ownerId) : null;
      const others: string[] = [];
      for (const id of ids) {
        const owner = owners.get(id) ?? '';
        if (granted.has(id) || (owner !== '' && owner === itemOwner)) servable.add(id);
        else if (owner !== '') others.push(id);
      }
      for (const id of await entitled(item, others, owners, editorKeys)) servable.add(id);
      return servable;
    },

    /**
     * As the item pushes the images it places: grant each one whose owner is entitled to place it here right now
     * (`editorKeys`: whoever wrote since the last push, and the team's joined people). An image the item's owner
     * owns needs no row. Answers how many it granted.
     */
    async grantPlaced(
      sql: ImageGrantSql,
      item: ImageGrantItem,
      ids: readonly string[],
      editorKeys: EditorKeys,
      at: number,
    ): Promise<number> {
      if (ids.length === 0) return 0;
      const granted = await grantedOf(sql, ids);
      const open = ids.filter((id) => !granted.has(id));
      if (open.length === 0) return 0;
      const owners = await imageOwners(sql, open);
      const itemOwner = item.ownerId ? await deps.mediaOwnerOf(item.ownerId) : null;
      const foreign = open.filter((id) => {
        const owner = owners.get(id) ?? '';
        return owner !== '' && owner !== itemOwner;
      });
      const grants = await entitled(item, foreign, owners, editorKeys);
      await grantImages(sql, grants, at);
      return grants.length;
    },

    /** Grant images outright: a copy's, which its source could serve. */
    grant: grantImages,

    clearCachesForTests(): void {
      teams.clear();
    },
  };
}

export type ImageGrants = ReturnType<typeof createImageGrants>;

async function grantImages(sql: ImageGrantSql, ids: readonly string[], at: number): Promise<void> {
  if (ids.length === 0) return;
  await sql.run(
    'INSERT OR IGNORE INTO image_grants (image_id, created_at) SELECT value, ? FROM json_each(?)',
    at,
    JSON.stringify(ids),
  );
}
