# Tab ↔ design many-to-many

## Status

Shipped. One tab can sit in several of a person's designs at once: **Add to Design** puts the active tab into
another design, and an edit to it in either reaches the other. Each design's content lives in its own
SQLite-backed Durable Object ([API app, Storage](../015-api/api.md#storage)), so every design holding a shared tab
keeps its own copy of it under the same tab id, and the designs keep their copies in step. The mechanism is
shared with livediagram, liveplanner and livedesigns (`@liveworkspace/index-app` `tab-shares.ts` and `tab-link.ts`);
`apps/api/src/design-room/tab-shares.ts` is livedesign's part of it: how a tab taken in is stored, what a body
keeps beside it, and the images it carries.

## Data model

In each design's own SQLite (`apps/api/src/design-room/design-schema.ts`):

```sql
CREATE TABLE design_tabs (
  design_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  folder      TEXT,
  PRIMARY KEY (design_id, tab_id),
  FOREIGN KEY (design_id) REFERENCES design (id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
);

-- The OTHER designs holding each shared tab.
CREATE TABLE tab_shares (
  tab_id      TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  design_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, design_id)
) WITHOUT ROWID;

-- What this design owes the other holders: a tab's body, a join, a leave.
CREATE TABLE share_outbox (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, tab_id TEXT NOT NULL,
  to_design TEXT NOT NULL, member TEXT NOT NULL DEFAULT '',
  UNIQUE (kind, tab_id, to_design, member)
);
```

`design_tabs` holds the tab's place in its design: `order_index`, and the per-design `folder`
([Tab folders](tab-folders.md)). Both stay per design, so each design can order and file a shared tab its own
way. `tabs` holds the body ([Per-tab storage](per-tab-storage.md)).

## Keeping the copies in step

- **A write** to a shared tab (a save, a rename, an agent's changeset) fills `share_outbox` with a
  `body` key per other holder, from a trigger on `tabs`, so no write path can forget it. The room's alarm sends
  them a few seconds after the design goes quiet (`FLUSH_IDLE_MS`), each a `receiveShares` call to the holder's
  Durable Object carrying the tab's current name and body, its write time, and the holders the sender knows. It is
  not held to the outbox push's once a minute: it is a call between designs, not a push to the index.
- **The later write wins.** A holder takes a body only when it is later than its own copy, by write time, then (two
  holders writing in the same millisecond) by content, so every holder settles on the same one. A copy taken in
  updates the tab's stats, image references and the design's outbox push as a local write does.
- **No echo.** A holder taking a copy sends it on only to holders the sender did not list; that is also how a
  holder that joined a moment ago hears of a write made by one that has not yet heard of it.
- **Images.** A body carries the images it places that the sending design may serve, and the design taking it
  in is granted those ([Images, Placement grants](../009-elements/images.md)), as a copy is.
- **Photos.** A body carries the photo blobs its photo layers use ([Photo store](../031-photo/photo-store.md)), and the design taking it
  in records them as its own references, so a photo shows in every design holding the tab and its blob is kept while
  any of them uses it.
- **Joining.** `POST /api/designs/:target/tabs/:tabId/link` with `{ from }` runs in the target's object. It reads
  the tab and its holders from `from` (`sharedTabCopy`), stores the copy at the end of the target's tab order, dated
  as the copy, then has `from` record the join (`shareJoined`): `from` lists the target, sends the other holders a
  `join`, and sends the target the tab again if it changed meanwhile.
- **Leaving.** Removing the tab from one design (`deleteTabRow`) sends the other holders a `leave` and drops
  nothing of theirs. Purging a design (the [Trash](../013-workspace/trash.md) purge, Take Offline, account
  deletion) sends each holder of each of its shared tabs a `leave` first. A holder that misses one answers `gone`
  the next time it is sent the tab, and is dropped then; so is any holder that no longer holds it.
- **Trash.** Trashing a design changes none of this: its shared tabs stay in step until it is purged.
- **Failures.** A send that fails stays in `share_outbox` and is retried a minute later.

Cross-design realtime is not part of this: a design open in another window shows another holder's write on
reload, as it always did.

### Shared-tab notice

`GET /api/designs/:id/shared-tabs` answers `{ sharedTabs: { tabs, designs } }`: how many of the design's tabs
are also in other designs, and how many designs, read from its `tab_shares`
(`sharedTabsSummary`, `apps/api/src/design-room/tab-shares.ts`). The Take Offline confirmation
(`fetchSharedTabsNotice`, `apps/editor/lib/shared-tabs-notice.ts`, waiting at most 1.5 s for it) adds a sentence
saying those tabs stay in the other designs. Delete asks nothing: it moves the design to the Trash, where its
shared tabs stay in step, and Undo brings it back. It answers exactly the callers who may delete the design, in the DELETE's order: 400 with no
caller, 404 when missing, 403 otherwise.

## Add to Design

The tab menu's **Add to Design** row opens `AddTabToDesignDialog`, a filterable tile grid of the caller's other
designs with their snapshot previews ([Design SVG snapshots](design-snapshots.md)). Picking one calls
`apiLinkTab` (`apps/editor/lib/api/tabs.ts`), the link route above with this design as `from`. The route answers
`{ tab }` as the target now holds it; a repeat answers the tab as it is. It is the caller's to make on both sides
(`linkSharedTab`, `mayLinkTabs`): they must edit the target and `from` as their own, an edit grant from the index on
each (the request's for the target, one fetched for `from`) that no share link gave and no tab scope narrows, and not
from a workbench session; and `from` must hold the tab. So nobody links a tab they cannot edit, or into a design
they cannot edit: 403 otherwise, 404 for a tab or `from` that is not there, 400 with no `from` or `from` the target
itself, 409 (`too_many_holders`) when the tab is already in 20 designs (`MAX_TAB_HOLDERS`). The row is offered for the designs `addToDesignTargets` lists
(`apps/editor/lib/add-to-design-targets.ts`).

### Cost

A save of a shared tab costs what any save does (the trigger's `tab_shares` check is a primary-key read). A tab is
held by at most 20 designs, so one write fans out to at most 19 calls. Sending a 1 MB tab to 19 holders measured
about 54 ms of CPU in the tests, every receiver included (`design-room-store.test.ts`, budget 2 s). Opening a
design costs nothing more for its shared tabs: each holder reads its own copy. Each join tells every earlier
holder, so a tab shared into _n_ designs has sent about n²/2 small `join` messages over its life (171 at the cap);
a drain sends at most 50 messages, and a body goes once per drain however many holders it is for.

## Copies

`POST /api/designs/:id/copy` copies the tab bodies into fresh tab rows of the new design, shared with nothing, in one transaction in
the new design's object (`importDesignCopy`, `apps/api/src/design-room/design-content.ts`), and re-points
any tab or element link, and any Tab Window's tab, from the source tab id to its copy's (`remapTabLinks`,
`@livedesign/design`).

## Cross-references

- [API app](../015-api/api.md): the Storage section and the endpoint table.
- [Per-tab storage](per-tab-storage.md): why a tab body is a row of its own.
