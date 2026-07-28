# 93 — Hide a diagram from Recent

Status: shipped

## What

A per-diagram menu item, **Hide from Recent** / **Show in Recent**, in both
Explorer surfaces (the `/explorer` route and the editor's floating Explorer
panel). A hidden diagram never appears in Recent however recently it was
opened or edited, and behaves exactly as before everywhere else — folders,
search, direct links, sharing, teams.

## Per-user, not per-diagram

Stored as `recentExcludedIds` in the synced `UserPreferences` blob (spec/20).

Recent is **your view of your own work**, so the choice belongs to the viewer,
not the document. On a shared or team diagram, one collaborator tidying their
Recent must not tidy everyone else's. Preferences already do exactly the right
thing here: the same blob syncs to D1 for **guests** (via the per-browser
`X-Owner-Id`) and for **signed-in users** (via the Clerk `sub`), so the choice
follows the account across devices with no migration and no api-schema change.

`recentExcludedIds` is **capped at 60** (`RECENT_EXCLUDED_LIMIT`), newest
first. The api caps the serialised preferences blob at 4 KB; a 36-char UUID
means ~200 ids would blow that on their own, and the failure mode is nasty —
the PUT starts rejecting **every** preference write, not just this one. 60 is
far more than anyone hides by hand and leaves room for the other flags. When
the cap bites it drops the **oldest** exclusion, so the choice just made always
survives.

## Where it is enforced

Both Recent lists filter on it, and both filter **before** the cap so hiding
one diagram promotes the next one in rather than leaving a gap:

- `apps/live/app/explorer/useExplorerPane.ts` — the route's Recent list, and
  the sidebar's **Recent badge count**, which counts what Recent will actually
  show. (It previously counted all sources without re-running the filter,
  which would have made the badge promise rows the pane then dropped.)
- `apps/live/components/panels/useExplorerViewModel.ts` — the editor panel's
  Recent list, alongside the existing "not the currently-open diagram" rule.

Preference ownership moved into `useExplorerState` for the route. It was in
`ExplorerShell`, but the pane needs it too, and two `useState` copies of the
same blob drift the moment either writes.

Both toggles read-modify-write from the **localStorage cache**, not a React
snapshot: the PUT sends the whole blob, so a stale snapshot would silently
clobber sibling flags another tab had written. Same rule `ProfilePane` follows.

## No badge anywhere else

Deliberate. The menu item's label states what the click will do — and by doing
so tells you the current state — right where you would change it. A chip on
every folder row would compete with the existing Offline / Shared / Team /
Private badges, which describe the **diagram**; this describes _your view of_
the diagram, which is a different kind of fact and a rarer one.

## Out of scope

- **Bulk hide / a management list.** Nothing surfaces the hidden set as a
  whole; you un-hide from the diagram's own menu wherever it lives. Worth
  revisiting if the 60 cap ever feels near.
- **Hiding shared-with-you rows.** Those already have **Dismiss**, which
  removes the share outright (a server-side row delete) — a different and
  more destructive action, left alone.
- **Hiding from search or folders.** The issue is explicit that this affects
  Recent only.
