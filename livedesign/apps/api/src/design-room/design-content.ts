// The design-level reads and writes of a design's own SQLite (docs/specs/015-api/api.md "Storage"): the tab outline
// a design read carries, its slide deck, the design row a create makes, and a copy's export and import. Runs inside
// the design's Durable Object, on `env.DESIGN_DB`.

import { remapTabLinks, type Element } from '@livedesign/design';
import { redactTabDataAuthors } from '../comments';
import { imageGrantImportStatement, servableImageIds } from '../db/image-grants';
import { imageRefAddStatements } from '../db/image-refs';
import { blobRefsOfTabs, markBlobsHeld, type PhotoBlobMeta } from '../db/photo-blobs';
import { tabStatsOfData, tabStatsStatement } from '../db/tab-stats';
import { imageRefIdsFromData } from '../image-refs/extract';
import { rowToTabSummary, type TabRow } from '../tab-row';
import type { DesignEnv, TabSummaryDTO } from '../types';

// What the design knows of itself (design-schema.ts): its name, owner, team, provenance and creation intent. Null
// until the design is started, by a create or by its first open with a grant (startDesign).
export type DesignMeta = {
  name: string;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  opensIn: string | null;
  tabKind: string | null;
  createdAt: number;
  thumbRenderedAt: number | null;
};

// What a design read takes from the design: its tabs in order (no body), its slide deck, and what it knows of
// itself.
export type DesignOutline = {
  tabs: TabSummaryDTO[];
  // The slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised JSON, or null for none.
  presentation: string | null;
  // The design's last save.
  savedAt: number;
  meta: DesignMeta | null;
};

type DesignHeadRow = {
  presentation: string | null;
  saved_at: number;
  created_at: number;
  name: string;
  owner_id: string;
  team_id: string | null;
  source: string | null;
  opens_in: string | null;
  tab_kind: string | null;
  thumb_rendered_at: number | null;
};

const DESIGN_HEAD_COLS =
  'presentation, saved_at, created_at, name, owner_id, team_id, source, opens_in, tab_kind, thumb_rendered_at';

function metaOf(head: DesignHeadRow | null): DesignMeta | null {
  if (!head || !head.created_at) return null;
  return {
    name: head.name,
    ownerId: head.owner_id,
    teamId: head.team_id,
    source: head.source,
    opensIn: head.opens_in,
    tabKind: head.tab_kind,
    createdAt: head.created_at,
    thumbRenderedAt: head.thumb_rendered_at,
  };
}

export async function readDesignOutline(env: DesignEnv, designId: string): Promise<DesignOutline> {
  const [tabs, design] = await env.DESIGN_DB.batch([
    env.DESIGN_DB.prepare(
      `SELECT t.id, dt.design_id, t.name, dt.order_index, '' AS data, t.updated_at, dt.folder
         FROM design_tabs dt
         JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.design_id = ?
        ORDER BY dt.order_index ASC`,
    ).bind(designId),
    env.DESIGN_DB.prepare(`SELECT ${DESIGN_HEAD_COLS} FROM design WHERE id = ?`).bind(designId),
  ]);
  const head = (design?.results?.[0] ?? null) as DesignHeadRow | null;
  return {
    tabs: ((tabs?.results ?? []) as TabRow[]).map(rowToTabSummary),
    presentation: head?.presentation ?? null,
    savedAt: head?.saved_at ?? 0,
    meta: metaOf(head),
  };
}

// What the design knows of itself, alone (no tabs): for the doors that only need its owner or name.
export async function readDesignMeta(env: DesignEnv, designId: string): Promise<DesignMeta | null> {
  const head = await env.DESIGN_DB.prepare(`SELECT ${DESIGN_HEAD_COLS} FROM design WHERE id = ?`)
    .bind(designId)
    .first<DesignHeadRow>();
  return metaOf(head ?? null);
}

// What a create or a first open writes about the design (startDesign, upsertDesignMeta). A started design keeps its
// owner, team, provenance and intent; only its name and last save move after.
export type DesignStart = {
  name: string;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  opensIn: string | null;
  tabKind: string | null;
  savedAt: number;
  createdAt: number;
  // A create's slide deck (a copy's or an import's), serialised; a started design keeps its own.
  presentation?: string | null;
};

// Start the design (docs/specs/015-api/api.md "Storage"), or on a design already started rename it and move its
// last save. On a genuine start the slide deck the create carries goes in too; a started design keeps its deck.
export async function initDesign(env: DesignEnv, designId: string, d: DesignStart): Promise<void> {
  await env.DESIGN_DB.prepare(
    `INSERT INTO design (id, presentation, saved_at, created_at, name, owner_id, team_id, source, opens_in, tab_kind)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (id) DO UPDATE SET
       presentation = CASE WHEN design.created_at = 0 THEN COALESCE(design.presentation, excluded.presentation)
                           ELSE design.presentation END,
       saved_at = excluded.saved_at,
       name = excluded.name,
       created_at = CASE WHEN design.created_at = 0 THEN excluded.created_at ELSE design.created_at END,
       owner_id = CASE WHEN design.created_at = 0 THEN excluded.owner_id ELSE design.owner_id END,
       team_id = CASE WHEN design.created_at = 0 THEN excluded.team_id ELSE design.team_id END,
       source = CASE WHEN design.created_at = 0 THEN excluded.source ELSE design.source END,
       opens_in = CASE WHEN design.created_at = 0 THEN COALESCE(excluded.opens_in, design.opens_in)
                       ELSE design.opens_in END,
       tab_kind = CASE WHEN design.created_at = 0 THEN COALESCE(excluded.tab_kind, design.tab_kind)
                       ELSE design.tab_kind END`,
  )
    .bind(
      designId,
      d.presentation ?? null,
      d.savedAt,
      d.createdAt,
      d.name,
      d.ownerId,
      d.teamId,
      d.source,
      d.opensIn,
      d.tabKind,
    )
    .run();
}

// A rename (and its save time) on a started design; false when the design is not started.
export async function renameDesign(
  env: DesignEnv,
  designId: string,
  name: string,
  savedAt: number,
): Promise<boolean> {
  const res = await env.DESIGN_DB.prepare(
    'UPDATE design SET name = ?, saved_at = ? WHERE id = ? AND created_at > 0',
  )
    .bind(name, savedAt, designId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// The snapshot cache's freshness stamp (thumbnail.ts).
export async function markThumbRendered(env: DesignEnv, designId: string, now: number): Promise<void> {
  await env.DESIGN_DB.prepare('UPDATE design SET thumb_rendered_at = ? WHERE id = ?')
    .bind(now, designId)
    .run();
}

// docs/specs/014-identity/transactional-email.md (#1) throttle: claim the right to email the owner about a new
// comment, at most once per window. One conditional UPDATE, so a burst of comment saves can't each fire one.
export async function claimCommentNotify(
  env: DesignEnv,
  designId: string,
  now: number,
  cutoff: number,
): Promise<boolean> {
  const res = await env.DESIGN_DB.prepare(
    'UPDATE design SET comment_notified_at = ? WHERE id = ? AND (comment_notified_at IS NULL OR comment_notified_at < ?)',
  )
    .bind(now, designId, cutoff)
    .run();
  return res.meta.changes === 1;
}

// The slide deck (docs/specs/012-collaboration/presentation-mode.md), serialised JSON, or null to clear it. Moves
// the design's last save. False when the design is not started.
export async function setDesignPresentation(
  env: DesignEnv,
  designId: string,
  presentation: string | null,
  savedAt: number,
): Promise<boolean> {
  const res = await env.DESIGN_DB.prepare(
    'UPDATE design SET presentation = ?, saved_at = ? WHERE id = ? AND created_at > 0',
  )
    .bind(presentation, savedAt, designId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// ---------- Copies --------------------------------------------------------------------------------------------

// A design's content as one Durable Object hands it to another for a copy (docs/specs/015-api/api.md "Copies"):
// tabs under fresh ids (their links re-pointed), the slide deck, the images the source may serve that the copy
// carries (as placement grants, docs/specs/009-elements/images.md "Placement grants"), and the photo blobs the
// copied tabs hold. Sent as one RPC message, so a design past the 32 MiB a message may carry cannot be copied this
// way (the follow-up is to stream it in pages).
export type DesignCopy = {
  presentation: string | null;
  // The source's creation intent (docs/specs/013-workspace/default-folders.md): the copy opens as it did.
  opensIn: string | null;
  tabKind: string | null;
  tabs: {
    id: string;
    name: string;
    orderIndex: number;
    folder: string | null;
    data: string;
    elementCount: number | null;
  }[];
  // Images of the copied bodies the source may serve: granted on the copy.
  grants: string[];
  // Whose the copied bodies' images are, as the source learned them (media_images), so the copy need not ask.
  owners: [id: string, owner: string][];
  // Photo blobs the copied tabs hold, by the copy's tab id.
  blobs: (PhotoBlobMeta & { tabId: string })[];
};

// The source side of a copy. `onlyTabId`: a tab-scoped visitor's copy takes that tab only (and no slide deck,
// which spans the design's tabs). `redactAuthorsFor`: anyone but the owner copies the comments as the tab read
// serves them to them.
export async function exportDesignCopy(
  env: DesignEnv,
  designId: string,
  onlyTabId: string | null,
  redactAuthorsFor: string | null,
): Promise<DesignCopy | null> {
  const design = await env.DESIGN_DB.prepare(
    'SELECT presentation, opens_in, tab_kind FROM design WHERE id = ?',
  )
    .bind(designId)
    .first<{ presentation: string | null; opens_in: string | null; tab_kind: string | null }>();
  const tabRows = await env.DESIGN_DB.prepare(
    `SELECT t.id, t.name, dt.order_index, dt.folder, t.data, t.element_count
       FROM design_tabs dt
       JOIN tabs t ON t.id = dt.tab_id
      WHERE dt.design_id = ?${onlyTabId === null ? '' : ' AND dt.tab_id = ?'}
      ORDER BY dt.order_index ASC`,
  )
    .bind(...(onlyTabId === null ? [designId] : [designId, onlyTabId]))
    .all<{
      id: string;
      name: string;
      order_index: number;
      folder: string | null;
      data: string;
      element_count: number | null;
    }>();
  const rows = tabRows.results ?? [];
  // Every fresh tab id minted up front, so a tab or element link on one tab can be re-pointed at its sibling's copy.
  const tabIdMap = new Map(rows.map((row) => [row.id, crypto.randomUUID()]));
  const tabs = rows.map((row) => {
    const remapped = remapTabDataLinks(row.data, tabIdMap);
    return {
      id: tabIdMap.get(row.id)!,
      name: row.name,
      orderIndex: row.order_index,
      folder: row.folder,
      data: redactAuthorsFor !== null ? redactTabDataAuthors(remapped, redactAuthorsFor) : remapped,
      // Link remapping rewrites ids inside elements, never their number, so the count carries over.
      elementCount: row.element_count,
    };
  });
  const placed = [...new Set(rows.flatMap((row) => imageRefIdsFromData(row.data)))];
  const grants = [...(await servableImageIds(env, designId, placed))];
  const owners = await env.DESIGN_DB.prepare(
    'SELECT id, owner_id FROM media_images WHERE id IN (SELECT value FROM json_each(?))',
  )
    .bind(JSON.stringify(placed))
    .all<{ id: string; owner_id: string }>();
  const blobs = (await blobRefsOfTabs(env, [...tabIdMap.keys()])).map((b) => ({
    ...b,
    tabId: tabIdMap.get(b.tabId)!,
  }));
  return {
    presentation: onlyTabId === null ? (design?.presentation ?? null) : null,
    opensIn: design?.opens_in ?? null,
    tabKind: design?.tab_kind ?? null,
    tabs,
    grants,
    owners: owners.results.map((r): [string, string] => [r.id, r.owner_id]),
    blobs,
  };
}

// Re-point the tab / element links inside one tab's stored `data` JSON at the copy's tab ids. The data is only
// parsed when it mentions a tab id, so the common link-free tab is copied byte for byte.
export function remapTabDataLinks(data: string, tabIdMap: Map<string, string>): string {
  // A tab or element link, or a Tab Window's tab: nothing to re-point without one.
  if (!data.includes('"tabId"') && !data.includes('"windowTabId"')) return data;
  try {
    const parsed = JSON.parse(data) as { elements?: Element[] };
    if (!Array.isArray(parsed.elements)) return data;
    return JSON.stringify({ ...parsed, elements: remapTabLinks(parsed.elements, tabIdMap) });
  } catch {
    return data;
  }
}

// The target side of a copy: the design's row and everything the export carried, in one transaction, so a copy
// lands whole or not at all. The photo blobs' markers go first (db/photo-blobs.ts). The collaboration index,
// listing summary and media references follow from the outbox.
export async function importDesignCopy(
  env: DesignEnv,
  designId: string,
  copy: DesignCopy,
  now = Date.now(),
): Promise<void> {
  const db = env.DESIGN_DB;
  // A copy makes a new design: one that already holds content keeps it, and nothing is written. Read and write
  // run back to back in the design's own object, so nothing lands between them.
  const held = await db
    .prepare('SELECT EXISTS (SELECT 1 FROM design_tabs WHERE design_id = ?1) AS held')
    .bind(designId)
    .first<{ held: number }>();
  if (held?.held) throw new Error('design_not_empty');
  await markBlobsHeld(env, designId, [...new Set(copy.blobs.map((b) => b.id))]);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        // created_at stays 0: the copy's first open with a grant starts it, as its new owner (initDesign).
        `INSERT INTO design (id, presentation, saved_at, created_at, opens_in, tab_kind) VALUES (?1, ?2, ?3, 0, ?4, ?5)
         ON CONFLICT (id) DO UPDATE SET presentation = excluded.presentation, saved_at = excluded.saved_at,
           opens_in = excluded.opens_in, tab_kind = excluded.tab_kind`,
      )
      .bind(designId, copy.presentation, now, copy.opensIn ?? null, copy.tabKind ?? null),
  ];
  for (const tab of copy.tabs) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, ?, ?, ?, ?, 1)',
        )
        .bind(tab.id, tab.name, tab.data, now, tab.elementCount ?? null),
      db
        .prepare(
          'INSERT INTO design_tabs (design_id, tab_id, order_index, added_at, folder) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(designId, tab.id, tab.orderIndex, now, tab.folder),
      // From the copied body itself (docs/specs/013-workspace/explorer-details-view.md).
      tabStatsStatement(env, tab.id, tabStatsOfData(tab.data).stats, now),
      // After the link, so the reference triggers queue the copy's images for the media service.
      ...imageRefAddStatements(env, tab.id, imageRefIdsFromData(tab.data)),
    );
  }
  if (copy.owners.length > 0) {
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO media_images (id, owner_id)
           SELECT value ->> '$[0]', value ->> '$[1]' FROM json_each(?)`,
        )
        .bind(JSON.stringify(copy.owners)),
    );
  }
  if (copy.grants.length > 0) stmts.push(imageGrantImportStatement(env, designId, copy.grants, now));
  if (copy.blobs.length > 0) {
    stmts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO photo_blob_refs (tab_id, blob_id, created_at, content_type, byte_size)
           SELECT value ->> '$.tabId', value ->> '$.id', ?1, value ->> '$.type', value ->> '$.size'
             FROM json_each(?2)`,
        )
        .bind(now, JSON.stringify(copy.blobs)),
    );
  }
  await db.batch(stmts);
}
