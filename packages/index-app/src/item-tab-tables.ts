// The tables an item's tabs live in, inside the item's own Durable Object SQLite (each product's
// docs/specs/015-api/api.md "Storage"): `tabs` holds one row per tab, the item's link table (`document_tabs`,
// `design_tabs`, `plan_tabs`) places a tab in the item, and the item's own row (`document`, `design`, `plan`) carries
// its `saved_at`. Each product's `db/tabs.ts` names them for the shared reads and writes (item-tab-reads.ts,
// item-tab-writes.ts, item-tab-order.ts).

export type ItemTabTables = {
  /** The item's own row, whose `saved_at` moves with a tab write: `document`. */
  item: string;
  /** The link table placing a tab in the item, with its order and folder: `document_tabs`. */
  links: string;
  /** The link table's item column: `document_id`. */
  key: string;
};

/** The names, refused unless each is a bare SQL identifier, since they are written into the statements. */
export function checkItemTabTables(tables: ItemTabTables): ItemTabTables {
  if (![tables.item, tables.links, tables.key].every((name) => /^\w+$/.test(name))) {
    throw new Error('item tab tables: not a table or column name');
  }
  return tables;
}
