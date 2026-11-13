// The image reference index's SQL (each product's docs/specs/009-elements/images.md, "Reference index"): the
// `image_refs (tab_id, image_id)` table in an api's own SQLite, a projection of the image elements inside
// `tabs.data`, so the share check and the push to the media service never read a tab body. `imageRefIds`
// (./image-refs.ts) says which ids a body places; these write and read the rows. Each api's db/image-refs.ts binds
// its database and, where it reads the index, the table that links its tabs to their item.
//
// Writes are STATEMENTS appended to the batch that writes the body, so the index lands in the same transaction as
// the blob it mirrors.

/** The table that puts a tab in an item (`document_tabs`, `document_id`), named by the api, never by a request. */
export type ImageRefLink = { table: string; item: string };

export function createImageRefWriters<E>(db: (env: E) => D1Database) {
  // Add only: for a write that may have lost a race (a participant swap, the Q&A swap), where deleting could
  // remove a reference the winner wrote.
  function imageRefAddStatements(env: E, tabId: string, ids: string[]): D1PreparedStatement[] {
    if (ids.length === 0) return [];
    return [
      db(env)
        .prepare(
          'INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)',
        )
        .bind(tabId, JSON.stringify(ids)),
    ];
  }

  return {
    // A body replace: drop the tab's references the new body no longer has, then add the ones it does. A save
    // that changes no image writes no row, so it owes no push.
    imageRefReplaceStatements: (env: E, tabId: string, ids: string[]): D1PreparedStatement[] => {
      return [
        db(env)
          .prepare(
            'DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))',
          )
          .bind(tabId, JSON.stringify(ids)),
        ...imageRefAddStatements(env, tabId, ids),
      ];
    },
    imageRefAddStatements,
    // Every reference a tab holds, for a write that drops or replaces the tab wholesale.
    imageRefPruneTabStatement: (env: E, tabId: string): D1PreparedStatement =>
      db(env).prepare('DELETE FROM image_refs WHERE tab_id = ?').bind(tabId),
  };
}

export function createImageRefReaders<E>(db: (env: E) => D1Database, link: ImageRefLink) {
  const { table, item } = link;
  return {
    // Every image the item places, each once: what the media service holds for it after the next push.
    itemImageIds: async (env: E, itemId: string): Promise<string[]> => {
      const { results } = await db(env)
        .prepare(
          `SELECT DISTINCT r.image_id
             FROM ${table} dt JOIN image_refs r ON r.tab_id = dt.tab_id
            WHERE dt.${item} = ?
            ORDER BY r.image_id`,
        )
        .bind(itemId)
        .all<{ image_id: string }>();
      return results.map((r) => r.image_id);
    },
    // Whether the item places image `imageId` (on `onlyTabId` only, for a tab-scoped visitor): the byte
    // endpoint's first question, answered from the item itself so an image placed a moment ago serves at once.
    itemPlacesImage: async (
      env: E,
      itemId: string,
      imageId: string,
      onlyTabId: string | null = null,
    ): Promise<boolean> => {
      const row = await db(env)
        .prepare(
          `SELECT 1 AS present
             FROM ${table} dt JOIN image_refs r ON r.tab_id = dt.tab_id AND r.image_id = ?1
            WHERE dt.${item} = ?2${onlyTabId === null ? '' : ' AND dt.tab_id = ?3'}
            LIMIT 1`,
        )
        .bind(...(onlyTabId === null ? [imageId, itemId] : [imageId, itemId, onlyTabId]))
        .first<{ present: number }>();
      return row !== null;
    },
  };
}
