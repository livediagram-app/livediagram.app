# Tabs and plans

Each tab belongs to exactly one plan. A plan's content is its own Durable Object ([API](../015-api/api.md) "Storage"),
so a tab lives in that plan's database and nowhere else. Two plans never hold the same tab, and an edit in one plan
never shows in another.

(This file's name is from when a tab could be linked into several projects at once through a `project_tabs` table
in one shared database. That went when each plan moved into its own Durable Object.)

## Storage

In the plan's SQLite (`apps/api/src/plan-room/plan-schema.ts`):

- `tabs` holds each tab's body: `id, name, data, updated_at, element_count, rev` ([Per-tab storage](per-tab-storage.md)).
- `plan_tabs` holds where each tab sits in the plan: `plan_id, tab_id, order_index, added_at, folder`. Order and
  folder ([Tab folders](tab-folders.md)) live here, never in `tabs.data`. Every row names the same plan, since the
  database holds one; the column stays so the content code reads the same as it did over a shared database.

Reading a plan's tabs joins the two in `order_index` order.

## Tab lifecycle

- **Create a tab**: the editor's first save of a new tab id (`PUT /api/projects/:id/tabs/:tabId`) writes one `tabs`
  row and one `plan_tabs` row.
- **Delete a tab**: `DELETE /api/projects/:id/tabs/:tabId` removes the `plan_tabs` row and the `tabs` row with it
  (`deleteTabRow`, `apps/api/src/db/tabs.ts`), and the plan's sheets settle in the same batch. A tab-scoped share
  link can't delete its own tab, and a token can't delete a plan's last tab.
- **Delete a plan**: it moves to the index's Trash and no tab is touched. It is purged 30 days later, or at once on
  Delete permanently, Empty Trash or `?permanent=true`: the index drops its rows and asks liveplanner to drop the
  content (`DELETE /api/internal/items/:id`), which empties the plan's Durable Object. Take Offline
  ([Offline Mode](offline-mode.md)) and closing an account take the same purge.

## Add to Plan

The tab menu's **Add to Plan** row opens a centred modal (`AddTabToProjectDialog`, `TabOrganiseDialogs.tsx`): a
filterable tile grid of the person's other plans, each tile showing that plan's cached snapshot
([Project SVG snapshots](project-snapshots.md), the same `ProjectThumbnail` the Explorer uses) over its name, so
they pick by recognising the canvas.

Picking a plan **copies** the active tab into it (`linkActiveTabTo` in `hooks/persistence/useTabActions.ts`):

- The copy gets a fresh tab id and fresh element ids (`remintTabElements`), and is saved into the destination with
  the ordinary tab save (`apiCopyTabTo`, `apps/editor/lib/api/tabs.ts`).
- From then on the two tabs are independent: an edit on either side stays on that side.
- A tab that is still loading is not copied (it would land empty); the editor says to try again in a moment.
- The toast reads "<tab> added to <plan>", or "Could not add <tab> to <plan>." when the save fails.

The row lists no plans, and so is disabled, in an offline plan, in a workbench and on a plan the person doesn't own
(an Editor on someone else's link) (`addToProjectTargets`, `apps/editor/lib/add-to-project-targets.ts`). Offline
plans are never destinations.

## Copying a whole plan

`POST /api/projects/:id/copy` asks the index to copy the item, and the index asks liveplanner to copy the content
into the new plan's Durable Object (`plan-content.ts`). Each tab gets a fresh id, and any tab or element link, and
any Tab Window's tab, in a copied body is pointed at its copy (`remapTabLinks`, `@liveplanner/project`). Order and
folder are copied with it.

## Shared-tab notice

`GET /api/projects/:id/shared-tabs` still answers, for anyone who may edit the plan (400 with no caller, 403
without an edit grant), and always says `{ sharedTabs: { tabs: 0, projects: 0 } }`, since no tab is in another
plan. The Take Offline confirmation still asks it (`fetchSharedTabsNotice`, `apps/editor/lib/shared-tabs-notice.ts`,
waiting at most 1500 ms) and, with nothing shared, adds no sentence.

## Cross-references

- [API app](../015-api/api.md): the routes and the plan's storage.
- [Per-tab storage](per-tab-storage.md): the tab body row.
- [Tab folders](tab-folders.md): folders on the tab bar, kept on `plan_tabs`.
