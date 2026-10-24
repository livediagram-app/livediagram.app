# Returning visitor

Status: shipped (the hero fan retired, October 2026)

## What

The landing page's hero always ends in the fan of template cards ([Marketing site](marketing-site.md), "Hero"),
with its Shuffle button, for every visitor, signed in or not, new or returning. It never shows the visitor's own
recent work: the hero is for starting something new, and the Explorer is where their work is.

Until October 2026 a browser with at least three recent items saw its four most recent on that fan instead, with a
card to Explorer Home (and before that, **Welcome back**). That went, so every app's hero is the same.

The recent snapshot below stays: other pages read it.

## The recent-designs snapshot

The marketing site is static and fast; it loads no sign-in code and does not call the api. So it never asks
the server who you are. Instead **the editor leaves a note** in the browser for the landing page to read,
on the same origin (the router serves `/` and `/explorer` from one host).

- **What:** up to six designs, newest save first: id, name, last saved time, the mode it opens in (always Pages; older notes may name another), and
  the team whose library holds it (null for your own). Stored in `localStorage` under
  `livedesign:recent-designs:v1` as `{ v: 1, designs: [{ id, name, savedAt, mode, teamName }] }`. A
  note written before `teamName` reads as your own designs.
- **Which:** your designs and your teams', merged by save: the personal library the editor lists for
  you (`GET /api/designs` plus this browser's Offline Mode designs) and, from the same request
  (`?include=team-recent`), the twelve newest designs in the libraries of the teams you have
  **joined** (never one you are only invited to; [Team shared designs](../013-workspace/team-shared-designs.md)).
  Twelve is the note's six twice over, so a few hidden from Recent still leave six. Most recently saved
  first, leaving out **empty** designs (nothing drawn, nothing to come back to) and any you have
  **hidden from Recent** ([Hide from Recent](../013-workspace/hide-from-recent.md)). The /new page's Jump
  back in card shows the same merge. Designs shared with you by link are not in it: they open through
  their link, which the note does not hold.
- **When:** every time the editor lists your designs (the Explorer, the editor, the /new page), so it
  is as fresh as your last visit to the app, and again at once when you hide a design from Recent or
  return one to it. With none left to show, the note is removed.
- **Thumbnails:** each design's snapshot SVG ([Design snapshots](../006-design/design-snapshots.md))
  is kept beside the note in the browser's Cache Storage (`livedesign-recent-thumbs-v1`), keyed by id
  and save time, fetched by the editor through its authenticated client when a listed design's entry is
  missing, and pruned to the six in the note. A design the server has no snapshot for (one it could
  not draw) is remembered as having none, so it is not asked for again until it is saved, and shows its
  tile's placeholder. An Offline Mode design is remembered as having none without asking: its rows
  never send a request ([Offline Mode](../006-design/offline-mode.md#this-browser-badge--explorer)); a request that failed outright (no network) is simply asked again on
  the next list. The landing page reads them from the cache, never the
  network, and shows them as `<img>` (an SVG image runs no script).
- **Forgotten on sign-out:** signing out clears the note and the thumbnails before the session ends, so
  the landing page it returns to (and the next person on a shared computer) never shows the account's
  designs. Deleting the account does the same.

## Performance

No new request on the landing page: one `localStorage` read and at most four Cache Storage reads (one per design card), after
hydration. The landing page loads no sign-in code, no api client. The editor's side costs one `localStorage`
write per design list, and a thumbnail fetch only for a recent design whose save time changed. The
team designs ride the editor's existing design list (no new request): one more query on the api,
which reads each joined team design's first-tab count to skip the empty ones and draws the full
summary for the twelve it keeps, so it grows with the size of your teams' libraries (about 1 ms at
1,000 team designs, 9 ms at 10,000, measured on SQLite).
