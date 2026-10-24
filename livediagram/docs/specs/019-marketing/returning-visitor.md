# Returning visitor

Status: retired (the hero fan, October 2026; the recent-diagrams note after it)

## What

The landing page's hero always ends in the fan of template cards ([Marketing site](marketing-site.md), "Hero"),
with its Shuffle button, for every visitor, signed in or not, new or returning. It never shows the visitor's own
recent work: the hero is for starting something new, and the Explorer is where their work is.

Until October 2026 a browser with at least three recent items saw its four most recent on that fan instead, with a
card to Explorer Home (and before that, **Welcome back**). That went, so every app's hero is the same.

## The recent-diagrams note (retired)

The landing page read those recent items from a note the editor left in the browser, since the static marketing
site never calls the api: up to six diagrams under `livediagram:recent-diagrams:v1` in `localStorage`, and their
snapshot SVGs in Cache Storage (`livediagram-recent-thumbs-v2`, before that `-v1`). The editor refreshed it every
time it listed your documents, and fetched a thumbnail for each one that changed. With the hero fan gone nothing
read it, so the editor no longer writes it, and the api's `GET /api/documents?include=team-recent`, which fed
it your teams' documents, went with the move of the library to the liveworkspace index.

- **Forgotten on sign-out:** a browser can still hold a note from an earlier visit, with an account's diagram
  names and previews in it. Signing out (and deleting the account) removes the note and both thumbnail caches
  before the session ends, so the next person on a shared computer never finds them. The storage names stay in
  `@livediagram/api-schema` for that alone.

The `/new` page's Jump Back In card is not this note: it reads the index directly
([New document route](../007-editor/new-document-route.md#jump-back-in-recent-documents-card)).

## Performance

Listing your documents no longer writes `localStorage` or fetches thumbnails into Cache Storage, so the editor's
document list is one index read and nothing else. Sign-out costs one `localStorage` removal and two Cache Storage
deletes.
