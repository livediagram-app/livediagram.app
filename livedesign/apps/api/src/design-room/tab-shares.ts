// A tab shared between designs (docs/specs/006-design/tab-design-many-to-many.md), with each design's content in
// its own Durable Object (docs/specs/015-api/api.md "Storage"). The mechanism is @liveworkspace/index-app's
// (tab-shares.ts): every holder keeps its own copy under the same tab id, a write is sent to the others from a
// trigger-filled outbox, and the later write wins. This is livedesign's part of it: how a tab taken in is stored,
// what a body keeps beside it, and the images and photo blobs a body may carry.

import { createTabShares } from '@liveworkspace/index-app';
import type { SharedTabsSummary } from '@livedesign/api-schema';
import type { Tab } from '@livedesign/design';
import { photoBlobIdsOf } from '@livedesign/photo-engine';
import { imageRefIdsFromData } from '@liveworkspace/api-kit/image-refs';
import { imageRefReplaceStatements } from '../db/image-refs';
import { componentRefReplaceFromData } from '../db/components';
import { servableImageIds } from '../db/image-grants';
import { heldBlobs, markBlobsHeld, type PhotoBlobMeta } from '../db/photo-blobs';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { tabWriteStatements } from '../db/tabs';
import type { DesignEnv } from '../types';
import { sharedTabComponents, takeSharedTabComponents } from './component-share';

export type { ShareAnswer, ShareMessage, SharedTabCopy } from '@liveworkspace/index-app';

type ShareExtra = { images?: unknown; photos?: unknown; components?: unknown };

// The photo blobs a body's photo layers name.
function photoIdsOfData(data: string): string[] {
  try {
    return [...photoBlobIdsOf(JSON.parse(data) as { photos?: unknown })];
  } catch {
    return [];
  }
}

function isBlobMeta(b: unknown): b is PhotoBlobMeta {
  const m = b as PhotoBlobMeta | null;
  return (
    typeof m?.id === 'string' &&
    typeof m.type === 'string' &&
    typeof m.size === 'number' &&
    m.size >= 0
  );
}

export const designShares = createTabShares<DesignEnv>({
  db: (env) => env.DESIGN_DB,
  linkTable: 'design_tabs',
  itemColumn: 'design_id',
  // A tab taken in is stored as any new tab is: body, place, stats, image references, saved time.
  insertTab: (env, designId, tab, orderIndex) =>
    tabWriteStatements(
      env,
      designId,
      { ...(JSON.parse(tab.data) as Omit<Tab, 'id' | 'name'>), id: tab.id, name: tab.name },
      orderIndex,
      { advance: true },
    ),
  // A later body keeps what a local write keeps beside it.
  bodyTaken: (env, designId, tab, now) => {
    const { stats } = tabStatsOfData(tab.data);
    return [
      env.DESIGN_DB.prepare('UPDATE tabs SET element_count = ? WHERE id = ?').bind(
        stats.elementCount,
        tab.id,
      ),
      tabStatsStatement(env, tab.id, stats, now),
      ...imageRefReplaceStatements(env, tab.id, imageRefIdsFromData(tab.data)),
      ...componentRefReplaceFromData(env, tab.id, tab.data),
      env.DESIGN_DB.prepare('UPDATE design SET saved_at = ? WHERE id = ?').bind(now, designId),
    ];
  },
  // What travels with the body, as with a copy:
  // - the images it places that the sending design may serve, granted to the holder taking it in
  //   (docs/specs/009-elements/images.md "Placement grants"), so an id pasted in reaches no image its sender could
  //   not show;
  // - the photo blobs its photo layers name that the sending tab holds a ref to (docs/specs/031-photo/photo-store.md),
  //   recorded as the holder's own refs (its marker first), so a photo shows in every design holding the tab and its
  //   bytes stay while any of them uses it;
  // - the mains its instances use (component-share.ts), each upserted where the holder's copy is older or absent.
  extra: {
    read: async (env, designId, tab) => {
      const out: ShareExtra = {};
      const placed = imageRefIdsFromData(tab.data);
      if (placed.length > 0) {
        const images = [...(await servableImageIds(env, designId, placed))];
        if (images.length > 0) out.images = images;
      }
      const named = photoIdsOfData(tab.data);
      if (named.length > 0) {
        const photos = await heldBlobs(env, tab.id, named);
        if (photos.length > 0) out.photos = photos;
      }
      const components = await sharedTabComponents(env, tab.data);
      if (components.length > 0) out.components = components;
      return out.images || out.photos || out.components ? out : undefined;
    },
    apply: async (env, designId, tab, extra, now) => {
      const { images, photos, components } = extra as ShareExtra;
      const statements: D1PreparedStatement[] = [
        ...takeSharedTabComponents(env, tab.data, components),
      ];
      const placed = new Set(imageRefIdsFromData(tab.data));
      const granted = (Array.isArray(images) ? images : []).filter(
        (id): id is string => typeof id === 'string' && placed.has(id),
      );
      if (granted.length > 0) {
        statements.push(
          env.DESIGN_DB.prepare(
            'INSERT OR IGNORE INTO image_grants (image_id, created_at) SELECT value, ? FROM json_each(?)',
          ).bind(now, JSON.stringify(granted)),
        );
      }
      const named = new Set(photoIdsOfData(tab.data));
      const blobs = (Array.isArray(photos) ? photos : []).filter(
        (b): b is PhotoBlobMeta => isBlobMeta(b) && named.has(b.id),
      );
      if (blobs.length > 0) {
        // A blob with a ref always has this design's marker: written before the ref, as recordBlobs does.
        await markBlobsHeld(
          env,
          designId,
          blobs.map((b) => b.id),
        );
        statements.push(
          env.DESIGN_DB.prepare(
            `INSERT INTO photo_blob_refs (tab_id, blob_id, created_at, content_type, byte_size)
             SELECT ?1, value ->> '$.id', ?2, value ->> '$.type', value ->> '$.size' FROM json_each(?3) WHERE true
             ON CONFLICT (tab_id, blob_id) DO UPDATE SET created_at = excluded.created_at`,
          ).bind(tab.id, now, JSON.stringify(blobs)),
        );
      }
      return statements;
    },
  },
});

// How many of the design's tabs are shared with other designs, and with how many designs: what taking it offline
// leaves in those (the "Shared-tab notice").
export async function sharedTabsSummary(
  env: DesignEnv,
  designId: string,
): Promise<SharedTabsSummary> {
  const { tabs, items } = await designShares.count(env, designId);
  return { tabs, designs: items };
}
