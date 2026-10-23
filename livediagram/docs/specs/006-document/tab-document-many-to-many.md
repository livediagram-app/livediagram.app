# Tab ↔ document many-to-many

## Status

Shipped. One tab can sit in several of a person's documents at once: **Add to Document** puts the active tab into
another document, and an edit to it in either reaches the other. Each document's content lives in its own
SQLite-backed Durable Object ([API app, Storage](../015-api/api.md#storage)), so every document holding a shared tab
keeps its own copy of it under the same tab id, and the documents keep their copies in step
(`apps/api/src/document-room/tab-shares.ts`).

The migration sequences as items #13 → #14 → #15 → #16 in the post-prototype haul. #13 adds the link table; #14 drops the now-redundant `change_log.document_id`; #15 denormalises participant metadata out of `change_log`; #16 ages out old `change_log` rows on a cron. (Migration 0064 later dropped `change_log` outright along with the Activity panel.)

## Data model

In each document's own SQLite (`apps/api/src/document-room/document-schema.ts`):

```sql
CREATE TABLE document_tabs (
  document_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  folder      TEXT,
  PRIMARY KEY (document_id, tab_id),
  FOREIGN KEY (document_id) REFERENCES document (id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);

-- The OTHER documents holding each shared tab.
CREATE TABLE tab_shares (
  tab_id      TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, document_id)
) WITHOUT ROWID;

-- What this document owes the other holders: a tab's body, a join, a leave.
CREATE TABLE share_outbox (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, tab_id TEXT NOT NULL,
  to_document TEXT NOT NULL, member TEXT NOT NULL DEFAULT '',
  UNIQUE (kind, tab_id, to_document, member)
);
```

`document_tabs` holds the tab's place in its document: `order_index`, and the per-document `folder`
([Tab folders](tab-folders.md)). Both stay per document, so each document can order and file a shared tab its own
way. `tabs` holds the body ([Per-tab storage](per-tab-storage.md)).

## Keeping the copies in step

- **A write** to a shared tab (a save, a rename, a Q&A board vote, an agent's changeset) fills `share_outbox` with a
  `body` key per other holder, from a trigger on `tabs`, so no write path can forget it. The room's alarm sends
  them a few seconds after the document goes quiet (`FLUSH_IDLE_MS`), each a `receiveShares` call to the holder's
  Durable Object carrying the tab's current name and body, its write time, and the holders the sender knows. It is
  not held to the D1 push's once a minute: it is a call between documents, not a D1 write.
- **The later write wins.** A holder takes a body only when it is later than its own copy, by write time, then (two
  holders writing in the same millisecond) by content, so every holder settles on the same one. A copy taken in
  updates the tab's stats, image references and the document's D1 push as a local write does.
- **No echo.** A holder taking a copy sends it on only to holders the sender did not list; that is also how a
  holder that joined a moment ago hears of a write made by one that has not yet heard of it.
- **Joining.** `POST /api/documents/:target/tabs/:tabId/link` with `{ from }` runs in the target's object. It reads
  the tab and its holders from `from` (`sharedTabCopy`), stores the copy at the end of the target's tab order, dated
  as the copy, then has `from` record the join (`shareJoined`): `from` lists the target, sends the other holders a
  `join`, and sends the target the tab again if it changed meanwhile.
- **Leaving.** Removing the tab from one document (`deleteTabRow`) sends the other holders a `leave` and drops
  nothing of theirs. Purging a document (the [Trash](../013-workspace/trash.md) purge, Take Offline, account
  deletion) sends each holder of each of its shared tabs a `leave` first. A holder that misses one answers `gone`
  the next time it is sent the tab, and is dropped then; so is any holder that no longer holds it.
- **Trash.** Trashing a document changes none of this: its shared tabs stay in step until it is purged.
- **Failures.** A send that fails stays in `share_outbox` and is retried a minute later.

Cross-document realtime is not part of this: a document open in another window shows another holder's write on
reload, as it always did.

### Shared-tab notice

`GET /api/documents/:id/shared-tabs` answers `{ sharedTabs: { tabs, documents } }`: how many of the document's tabs
are also in other documents, and how many documents, read from its `tab_shares`
(`sharedTabsSummary`, `apps/api/src/document-room/tab-shares.ts`). The Take Offline and delete confirmations
(`fetchSharedTabsNotice`, `apps/editor/lib/shared-tabs-notice.ts`) add a sentence saying those tabs stay in the
other documents. It answers exactly the callers who may delete the document, in the DELETE's order: 400 with no
caller, 404 when missing, 403 otherwise.

## Add to Document

The tab menu's **Add to Document** row opens `AddTabToDocumentDialog`, a filterable tile grid of the caller's other
documents with their snapshot previews ([Document SVG snapshots](document-snapshots.md)). Picking one calls
`apiLinkTab` (`apps/editor/lib/api/tabs.ts`), the link route above with this document as `from`. The route answers
`{ tab }` as the target now holds it; a repeat answers the tab as it is. It is the caller's to make on both sides:
they must own the target and `from` (`ownsDocument`, so a team document's owner is proven by a verified account
id), and `from` must hold the tab: 403 otherwise, 404 for a tab or `from` that is not there, 400 with no `from`
or `from` the target itself. The row is offered for the documents `addToDocumentTargets` lists
(`apps/editor/lib/add-to-document-targets.ts`).

### Cost

A save of a shared tab costs what any save does (the trigger's `tab_shares` check is a primary-key read). Sending a
1 MB tab to 20 holders measured 62-94 ms of CPU in the tests, every receiver included
(`document-room-store.test.ts`, budget 2 s). Each join tells every earlier holder, so a tab shared into _n_
documents has sent about n²/2 small `join` messages over its life; a drain sends at most 50 messages.

## Copies

`POST /api/documents/:id/copy` copies the tab bodies into fresh tab rows of the new document, shared with nothing, in one transaction in
the new document's object (`importDocumentCopy`, `apps/api/src/document-room/document-content.ts`), and re-points
any tab or element link, and any Tab Window's tab, from the source tab id to its copy's (`remapTabLinks`,
`@livediagram/document`).

## Cross-references

- [API app](../015-api/api.md): the Storage section and the endpoint table.
- [Per-tab storage](per-tab-storage.md): why a tab body is a row of its own.
