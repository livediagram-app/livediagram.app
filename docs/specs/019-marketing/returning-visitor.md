# Returning visitor

Status: shipped

## What

The landing page's hero opens on an **overview** of every mode ([Marketing site](marketing-site.md), "Hero"): it is
there for someone new, to see what the canvas does before they pick a way in. Somebody who already has a
diagram has seen that. For them the hero's first window becomes **Welcome back**: their **six most recent
diagrams**, each a tile that opens it, and a link under them to **Explorer Home**
([Explorer Home](../013-workspace/explorer-home.md)) for everything else.

A **returning visitor** is a browser whose recent-diagrams snapshot (below) holds at least one diagram.
Everyone else, including a returning person in a fresh browser, sees the overview as before.

## The recent-diagrams snapshot

The marketing site is static and fast; it does not load Clerk and does not call the api. So it never asks
the server who you are. Instead **the editor leaves a note** in the browser for the landing page to read,
on the same origin (the router serves `/` and `/explorer` from one host).

- **What:** up to six diagrams, newest save first: id, name, last saved time. Stored in `localStorage`
  under `livediagram:recent-diagrams:v1` as `{ v: 1, diagrams: [{ id, name, savedAt }] }`.
- **Which:** the documents the editor lists for you (`GET /api/documents` plus this browser's Offline
  Mode documents), most recently saved first, leaving out **empty** documents (nothing drawn, nothing to
  come back to) and any you have **hidden from Recent** ([Hide from Recent](../013-workspace/hide-from-recent.md)).
  The same order the /new page's Jump back in card uses.
- **When:** every time the editor lists your documents (the Explorer, the editor, the /new page), so it
  is as fresh as your last visit to the app, and again at once when you hide a diagram from Recent or
  return one to it. With none left to show, the note is removed.
- **Thumbnails:** each diagram's snapshot SVG ([Document snapshots](../006-document/document-snapshots.md))
  is kept beside the note in the browser's Cache Storage (`livediagram-recent-thumbs-v1`), keyed by id
  and save time, fetched by the editor through its authenticated client when a listed diagram's entry is
  missing, and pruned to the six in the note. A diagram the server has no snapshot for (offline, or one
  it could not draw) is remembered as having none, so it is not asked for again until it is saved, and
  shows its tile's placeholder; a request that failed outright (no network) is simply asked again on
  the next list. The landing page reads them from the cache, never the
  network, and shows them as `<img>` (an SVG image runs no script).
- **Forgotten on sign-out:** signing out clears the note and the thumbnails before Clerk signs out, so
  the landing page it returns to (and the next person on a shared computer) never shows the account's
  diagrams. Deleting the account does the same.

## Welcome back (the hero's first window)

- Same board and size as the overview (no editor chrome, the canvas paper and dot grid), so the stage,
  its dots and arrows are unchanged. It replaces the overview; it is not an extra window.
- **It never moves on by itself.** The stage does not auto-advance off Welcome back: a returning
  visitor came for their diagrams, so it stays until they move it with the arrows or dots. Once moved,
  the other windows auto-advance as usual, and the stage settles again when it comes back round.
- **Tiles:** three over two on a wide window, two across on a phone (three rows, spread evenly down the tall phone window so no gap gathers above the link), each a 3:2 thumbnail
  over the diagram's name (one line, truncated) and how long since it was saved ("2 hours ago"). The
  thumbnail box takes the diagram's own background colour, as the Explorer's cards do; with no thumbnail,
  a quiet placeholder with the diagram glyph. Hovering a tile lifts it and rings it in brand, as the
  overview's frames do. Fewer than six diagrams shows only those.
- **Pressing a tile** opens the diagram (`/document/<id>`). On a peeking (off-centre) window a press
  centres the window instead, as everywhere on the stage.
- **Explorer Home link** under the tiles: "Open Explorer Home ›", to `/explorer/home`.
- **Heading:** "Welcome back" (in capitals above the tiles, the brand eyebrow style).
- **Label below the stage:** "Welcome back: your recent diagrams, one press away". The headline's word
  cycles freely while it shows, as on the overview.
- **Keyboard and screen readers:** the stage is decorative (`aria-hidden`), so while Welcome back is
  centred a link to Explorer Home sits under the stage, shown when focused, as each mode window's Build
  yours does.

## No flash, no shift

The static HTML is the same for everyone (the overview). A tiny inline script in the `<head>` checks for
the note before first paint and marks `<html data-returning>`; while marked, the overview's frames are
hidden (their space kept), so a returning visitor never sees the overview flash before their diagrams.
After hydration the hero reads the note and draws the tiles; the window's size never changes, so nothing
moves (no layout shift), and the headline, the page's largest paint, is untouched. Thumbnails fade in as
the cache answers.

## Performance

No new request on the landing page: one `localStorage` read and at most six Cache Storage reads, after
hydration. The landing page loads no Clerk, no api client. The editor's side costs one `localStorage`
write per document list, and a thumbnail fetch only for a recent diagram whose save time changed.

## Appearance

The board, tiles, text and link follow light and dark appearance like the rest of the hero; the
thumbnails are the diagrams as their theme draws them, as in the Explorer.
