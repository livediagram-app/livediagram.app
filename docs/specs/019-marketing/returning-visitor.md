# Returning visitor

Status: shipped

## What

The landing page's hero asks "What are you making today?" and, under its search, offers five starting
points (**Or try**; [Marketing site](marketing-site.md), "Hero"): that is for someone new, picking a way
in. Somebody who already has a diagram mostly wants to get back to it. For them that row becomes **Pick up
where you left off**: their **four most recent diagrams**, each a tile that opens it, and a link beside
them to **Explorer Home** ([Explorer Home](../013-workspace/explorer-home.md)) for everything else. Until
October 2026 this was **Welcome back**, the first window of the hero's old stage, with six tiles.

A **returning visitor** is a browser whose recent-diagrams snapshot (below) holds at least one diagram.
Everyone else, including a returning person in a fresh browser, sees Or try as before.

## The recent-diagrams snapshot

The marketing site is static and fast; it does not load Clerk and does not call the api. So it never asks
the server who you are. Instead **the editor leaves a note** in the browser for the landing page to read,
on the same origin (the router serves `/` and `/explorer` from one host).

- **What:** up to six diagrams, newest save first: id, name, last saved time, the mode it opens in, and
  the team whose library holds it (null for your own). Stored in `localStorage` under
  `livediagram:recent-diagrams:v1` as `{ v: 1, diagrams: [{ id, name, savedAt, mode, teamName }] }`. A
  note written before `teamName` reads as your own diagrams.
- **Which:** your documents and your teams', merged by save: the personal library the editor lists for
  you (`GET /api/documents` plus this browser's Offline Mode documents) and, from the same request
  (`?include=team-recent`), the twelve newest documents in the libraries of the teams you have
  **joined** (never one you are only invited to; [Team shared documents](../013-workspace/team-shared-documents.md)).
  Twelve is the note's six twice over, so a few hidden from Recent still leave six. Most recently saved
  first, leaving out **empty** documents (nothing drawn, nothing to come back to) and any you have
  **hidden from Recent** ([Hide from Recent](../013-workspace/hide-from-recent.md)). The /new page's Jump
  back in card shows the same merge. Documents shared with you by link are not in it: they open through
  their link, which the note does not hold.
- **When:** every time the editor lists your documents (the Explorer, the editor, the /new page), so it
  is as fresh as your last visit to the app, and again at once when you hide a diagram from Recent or
  return one to it. With none left to show, the note is removed.
- **Thumbnails:** each diagram's snapshot SVG ([Document snapshots](../006-document/document-snapshots.md))
  is kept beside the note in the browser's Cache Storage (`livediagram-recent-thumbs-v1`), keyed by id
  and save time, fetched by the editor through its authenticated client when a listed diagram's entry is
  missing, and pruned to the six in the note. A diagram the server has no snapshot for (one it could
  not draw) is remembered as having none, so it is not asked for again until it is saved, and shows its
  tile's placeholder. An Offline Mode document is remembered as having none without asking: its rows
  never send a request ([Offline Mode](../006-document/offline-mode.md#local-only-badge--explorer)); a request that failed outright (no network) is simply asked again on
  the next list. The landing page reads them from the cache, never the
  network, and shows them as `<img>` (an SVG image runs no script).
- **Forgotten on sign-out:** signing out clears the note and the thumbnails before Clerk signs out, so
  the landing page it returns to (and the next person on a shared computer) never shows the account's
  diagrams. Deleting the account does the same.

## Pick up where you left off (the hero's row)

- **Where:** in place of the hero's Or try pills, under the search, on the same dark band.
- **Heading:** "Pick up where you left off" (small, quiet, above the tiles).
- **Tiles:** up to four, in a row on a wide window and two by two below `lg`, each a compact card the height of
  a button row: a small thumbnail beside the diagram's name (one line, truncated) over how long since it was saved
  ("2 hours ago"). The thumbnail takes the diagram's own background colour, as the Explorer's cards do; with no
  thumbnail, a quiet placeholder with the diagram's mode glyph. Hovering a tile lifts it and brightens its border.
  Fewer than four diagrams shows only those. The row's box is held open from first paint only for a returning
  visitor (`.hero-recent-slot`), so someone new gets no empty gap.
- **Team mark:** a diagram from a team's library has the team icon (the Explorer's team mark) before its
  name; your own diagrams have none.
- **Pressing a tile** opens the diagram (`/document/<id>`).
- **Explorer Home link** after the tiles: "Open Explorer Home ›", to `/explorer/home`.
- **Keyboard and screen readers:** real links in reading order, the row a labelled list.

## No flash, no shift

The static HTML is the same for everyone (Or try). A tiny inline script in the `<head>` checks for the
note before first paint and marks `<html data-returning>`; while marked, the Or try pills are hidden
(their space kept), so a returning visitor never sees them flash before their diagrams. After hydration
the hero reads the note and draws the tiles in the same box; nothing below moves (no layout shift), and
the headline, the page's largest paint, is untouched. Thumbnails fade in as the cache answers.

## Performance

No new request on the landing page: one `localStorage` read and at most four Cache Storage reads, after
hydration. The landing page loads no Clerk, no api client. The editor's side costs one `localStorage`
write per document list, and a thumbnail fetch only for a recent diagram whose save time changed. The
team documents ride the editor's existing document list (no new request): one more query on the api,
which reads each joined team document's first-tab count to skip the empty ones and draws the full
summary for the twelve it keeps, so it grows with the size of your teams' libraries (about 1 ms at
1,000 team documents, 9 ms at 10,000, measured on SQLite).

## Appearance

The tiles sit on the hero's dark band in either appearance; the
thumbnails are the diagrams as their theme draws them, as in the Explorer.
