// The splitter's hooks (SplitHooks in @liveworkspace/migration), wired to the products' real code:
// - upgradeTab: livediagram's stored-tab upgrades without its Pages and Plan drops (migrateStoredTabKeepingRetired);
// - pageRects: the old site's page layout (./page-geometry);
// - imageOwner: the snapshot's `images` row, its owner through the owner map, named as the media service names it;
// - newId: a name-based UUID of the seed (./ids), so the same snapshot plans the same ids;
// - keptByOf: which app keeps each old document's id, from the plan's first pass;
// - ownerOf: the owner map.
// partUrl and itemPersonId are left to the splitter's own (the apps' real addresses; liveplanner's person hash).
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { migrateStoredTabKeepingRetired } from '@livediagram/document';
import type { MigrationApp, SplitHooks } from '@liveworkspace/migration';
import { mediaOwnerOf, uuidFromSeed } from './ids.ts';
import type { OwnerMap } from './owner-map.ts';
import { pageRects } from './page-geometry.ts';

export function upgradeTab(body: Record<string, unknown>): Record<string, unknown> {
  // The upgrades read and keep every field; an old body may lack any of them.
  return migrateStoredTabKeepingRetired(
    body as Parameters<typeof migrateStoredTabKeepingRetired>[0],
  );
}

/** The media owner of an old image: its uploader through the owner map, as livediagram's api names them. */
export class ImageOwners {
  private readonly stmt: StatementSync;
  private readonly owners: OwnerMap;
  private readonly cache = new Map<string, string | null>();

  constructor(db: DatabaseSync, owners: OwnerMap) {
    this.stmt = db.prepare('SELECT owner_id FROM images WHERE id = ?');
    this.owners = owners;
  }

  of(imageId: string): string | null {
    const known = this.cache.get(imageId);
    if (known !== undefined) return known;
    const row = this.stmt.get(imageId) as { owner_id: string } | undefined;
    const owner = row ? mediaOwnerOf(this.owners.ownerOf(row.owner_id)) : null;
    // Bounded: an image's owner is asked once per placing document, and the cache is cleared between documents'
    // batches by its size.
    if (this.cache.size > 50_000) this.cache.clear();
    this.cache.set(imageId, owner);
    return owner;
  }
}

export function makeHooks(options: {
  owners: OwnerMap;
  images: ImageOwners;
  keptBy?: ReadonlyMap<string, MigrationApp>;
}): SplitHooks {
  const { owners, images, keptBy } = options;
  return {
    newId: (seed) => uuidFromSeed(seed),
    ownerOf: (old) => owners.ownerOf(old),
    upgradeTab,
    pageRects,
    imageOwner: (id) => images.of(id),
    ...(keptBy ? { keptByOf: (id: string) => keptBy.get(id) ?? null } : {}),
  };
}
