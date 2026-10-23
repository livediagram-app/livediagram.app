# Tab ↔ project many-to-many

## Why

Originally every `tabs` row carried a single `project_id` FK — one tab belonged to one project. That worked for the editor's "tabs are folders inside a project" mental model, but it forecloses a category of features the user has flagged for the next phase:

- **Copy a tab between projects** without duplicating the content (so an edit in one tab propagates to the other).
- **A reference tab** that lives in several projects at once — e.g. a glossary, a shared timeline, an architecture diagram that's part of two product lines' workspaces.
- **Change log without per-project scoping** (paired with item #14; the change log itself was removed on 2026-10-03, see [Collaboration](../012-collaboration/README.md)): once a tab can live in multiple projects, attributing a change to a single `(project_id, tab_id)` pair stops being meaningful. The change should be on the tab; consumers join through the link table when they care which projects it surfaces in.

The migration sequences as items #13 → #14 → #15 → #16 in the post-prototype haul. #13 adds the link table; #14 drops the now-redundant `change_log.project_id`; #15 denormalises participant metadata out of `change_log`; #16 ages out old `change_log` rows on a cron. (`change_log` has since gone, with the Activity panel.)

## Data model

New table:

```sql
CREATE TABLE project_tabs (
  project_id  TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  order_index INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (project_id, tab_id),
  FOREIGN KEY (project_id) REFERENCES diagrams(id) ON DELETE CASCADE,
  FOREIGN KEY (tab_id)     REFERENCES tabs(id)     ON DELETE CASCADE
);

CREATE INDEX project_tabs_by_project ON project_tabs(project_id, order_index);
CREATE INDEX project_tabs_by_tab     ON project_tabs(tab_id);
```

`order_index` lives on the link, not on the tab — two projects that share a tab can order it independently. `added_at` lets us surface "added to this project on date X" later. A nullable `folder` column on this table ([Tab folders](tab-folders.md)) exists for the same reason: tab-folder membership is per-project, so a shared tab can be foldered in one project and loose in another.

The link is the only place a tab meets a project. `tabs` holds the body (`id, name, data, updated_at`, [Per-tab storage](per-tab-storage.md)) and no pointer to any project, so nothing cascades from the project a tab was created in: deleting it never destroys the tab in another project.

### Tab lifecycle

- **Create tab** — insert one row into `tabs`, one row into `project_tabs` pointing it at the owning project.
- **Add tab to another project** — `INSERT INTO project_tabs (project_id, tab_id, order_index, added_at) VALUES (?, ?, ?, ?)`. No change to `tabs`. Edits to the tab propagate to every project referencing it.
- **Remove tab from a project** — `DELETE FROM project_tabs WHERE project_id = ? AND tab_id = ?`. If no rows remain referencing the tab, the `tabs` row AND every collaboration-index row keyed by that tab id are dropped in the same call (atomic on the server). When other projects still link the tab, the body stays, so any project that still surfaces the tab still surfaces its content. The server handles it with full knowledge of the link-count.
- **Delete a project** — a delete moves the plan to the index's Trash, touching no tab. It is purged 30 days later, or at once on Delete permanently / Empty Trash / `?permanent=true`: the index drops its rows and asks liveplanner to drop the content (`DELETE /api/internal/items/:id`), which empties the plan's Durable Object. Take Offline ([Offline Mode](offline-mode.md)) and account deletion take the same purge. While a plan waits in the Trash its tabs stay where they are.

### Shared-tab notice

A **shared tab** is a tab linked into more than one project. Removing a project is safe for its shared tabs, but the user cannot see that from the project alone, so the Take Offline confirmation says it first. (A delete asks nothing: it goes to the Trash with an Undo, and a restore brings back the project's links to its tabs.) `GET /api/projects/:id/shared-tabs` answers `{ sharedTabs: { tabs, projects } }`: how many of the project's tabs are also linked elsewhere, and how many distinct other projects hold them. It answers exactly the callers who may delete the project (owner, or a joined member of its team; `mayDeleteProject`), in the DELETE's order: 400 with no caller, 404 when missing, 403 otherwise.

The confirmation reads the counts before it opens (`fetchSharedTabsNotice`, `apps/editor/lib/shared-tabs-notice.ts`) and, when `tabs` is above zero, adds one sentence:

- **Take Offline** ([Offline Mode](offline-mode.md)): _"2 of its tabs are also used in 1 other project; they stay there, and the copies in this browser no longer share edits with them."_

Singular forms read _"1 of its tabs is ... it stays there"_ and _"1 other project"_. An offline project has no shared tabs and makes no request. The read waits at most `SHARED_TABS_NOTICE_TIMEOUT_MS` (1500 ms); when it fails or runs out of time the confirmation opens without the sentence (the api client reports the failure), since the server keeps shared tabs either way and the notice is information, not the safeguard. The counts are read before the dialog renders so its content never changes under the pointer.

## API impact

`GET /api/projects/:id` returns the project with its tab summaries — the join now goes through `project_tabs`:

```sql
SELECT t.id, t.name, dt.order_index
  FROM project_tabs dt
  JOIN tabs t ON t.id = dt.tab_id
 WHERE dt.project_id = ?
 ORDER BY dt.order_index ASC
```

`PUT /api/projects/:id/tabs/:tabId` (tab body write) is unchanged on the surface but the implementation no longer scopes by `project_id` to find the row — the tab id is globally unique. The caller's permission to edit the tab is still gated by their permission on at least one project that contains it (owner of any containing project, OR an edit-role share code for any containing project).

`POST /api/projects/:id/tabs/:tabId/link` adds an existing tab into the target project. Idempotent: same `(project_id, tab_id)` pair returns 200 without duplicating the link row (`ON CONFLICT DO NOTHING`). Auth: caller must own the target project AND own at least one project that already contains the tab (so a stranger can't graft a tab they have no read access to). Returns the resulting tab summary. The tab menu's **Add to Project** row opens a centred modal (`AddTabToProjectDialog`): a filterable tile grid of the caller's other projects, replacing the old in-menu list; each tile shows the destination project's cached snapshot preview ([Project SVG snapshots](project-snapshots.md), the same `ProjectThumbnail` the Explorer rows use, versioned by `savedAt`) over its name, so the user picks by recognising the canvas rather than parsing a list of near-identical names; picking one calls this endpoint. Because only the project's owner can make the link, the row offers no destinations, and so is disabled, on a project the caller doesn't own (an Editor on someone else's link), in an offline project and in a workbench (`addToProjectTargets`, `apps/editor/lib/add-to-project-targets.ts`); it never offers a call that can only fail. Subsequent edits on either side write to the same `tabs.data` row, so changes propagate.

`DELETE /api/projects/:id/tabs/:tabId` now removes the link row first, then drops the underlying `tabs` row only when no other `project_tabs` entries reference it. Unlinking a shared tab from one project leaves the body intact for the others.

`POST /api/projects/:id/copy` (item #9) copies tab bodies into freshly minted tab rows — that doesn't change. The new tab rows get fresh ids and their own `project_tabs` entries pointing at the new project, and any tab / element link, and any Tab Window's tab, in a copied body is re-pointed from the source tab id to its copy's (`remapTabLinks`, `@liveplanner/project`). Cloning vs linking is a deliberate distinction: copy = independent content, link = shared content.

## Cross-references

- [API app](../015-api/api.md) — endpoint dispatch + the underlying schema overview. Updated alongside the migration in #13.
- [Per-tab storage](per-tab-storage.md) — the per-tab storage rationale. Still applies; the link table is orthogonal to where the tab body lives.
