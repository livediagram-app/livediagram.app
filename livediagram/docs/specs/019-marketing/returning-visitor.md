# Returning visitor

Status: shipped

## What

The landing page's hero ends in a fan of template cards dealt along its foot ([Marketing site](marketing-site.md),
"Hero"): that is for someone new, picking a way in. Somebody who already works here mostly wants to get back to
their work. So a visitor whose recent-diagrams snapshot (below) holds **at least three diagrams**
(`RECENT_FAN_MIN`) sees **their own documents** on that fan instead: their **four most recent** (fewer if they have
fewer), most recent first, then a card to **Explorer Home** ([Explorer Home](../013-workspace/explorer-home.md)) for
everything else. With fewer than three they see the template fan, exactly as someone new does.

Until October 2026 this was **Welcome back**, the first window of the hero's old stage, with six tiles; for a
short while after, a row of tiles under the hero's search.

A **returning visitor** is a browser whose recent-diagrams snapshot (below) holds at least one diagram.
Everyone else, including a returning person in a fresh browser, sees the templates.

## The recent-diagrams snapshot

The marketing site is static and fast; it loads no sign-in code and does not call the api. So it never asks
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
  never send a request ([Offline Mode](../006-document/offline-mode.md#this-browser-badge--explorer)); a request that failed outright (no network) is simply asked again on
  the next list. The landing page reads them from the cache, never the
  network, and shows them as `<img>` (an SVG image runs no script).
- **Forgotten on sign-out:** signing out clears the note and the thumbnails before the session ends, so
  the landing page it returns to (and the next person on a shared computer) never shows the account's
  diagrams. Deleting the account does the same.

## Their documents on the fan

- **Cards:** the fan's own cards (`components/HeroFanMine.tsx`), in its fan of poses (four cards for three
  documents and Explorer Home, five for four): each document's name, its **preview** (`components/RecentPreview.tsx`:
  its snapshot from this browser's cache, the one the editor leaves on each save, on the diagram's own background
  colour, as the Explorer's cards draw it; with no snapshot, its mode glyph on a quiet tint), and under the preview,
  right-aligned at the card's foot, how long since it was saved ("2 hours ago"). The foot runs off the band, so the
  time is out of sight at rest; pointing at (or focusing) a card straightens it and lifts it 4.25rem, enough to bring
  the time into view (the fan clips only its foot, so the lifted card keeps its title). Pressing one opens the
  document (`/document/<id>`).
- **Explorer Home**, the last card: "Explorer Home" with "Open" at the top right, over a tinted panel ("All your
  documents"), to `/explorer/home`.
- **On a phone** the fan shows three cards, the three most recent documents, and leaves Explorer Home off: the
  band has room for three, and a returning visitor came for their documents.
- **They stay put.** The template fan deals a new card every few seconds; a returning visitor came for these, so
  nothing is swapped. Each card springs in a beat after the one before it when the fan deals.
- **Keyboard and screen readers:** real links, in reading order.

## No flash, no shift

The static HTML is the same for everyone (the template fan's opening hand). The fan is hidden from first paint
once script runs (`<html data-hero-deal>`, the hero fan's head script) until it deals, and it deals whichever hand
fits after hydration: a returning visitor's documents, or a shuffled template hand. The cards are the same size
either way, so nothing moves, and the headline, the page's largest paint, is untouched. Previews fade in as the
cache answers.

## Performance

No new request on the landing page: one `localStorage` read and at most four Cache Storage reads (one per document card), after
hydration. The landing page loads no sign-in code, no api client. The editor's side costs one `localStorage`
write per document list, and a thumbnail fetch only for a recent diagram whose save time changed. The
team documents ride the editor's existing document list (no new request): one more query on the api,
which reads each joined team document's first-tab count to skip the empty ones and draws the full
summary for the twelve it keeps, so it grows with the size of your teams' libraries (about 1 ms at
1,000 team documents, 9 ms at 10,000, measured on SQLite).

## Appearance

The cards are the fan's white cards in either appearance; the
previews are the diagrams as their theme draws them, as in the Explorer.
