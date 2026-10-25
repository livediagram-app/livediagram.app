# Returning visitor

Status: shipped (the hero fan retired, October 2026)

## What

The landing page's hero always ends in the fan of template cards ([Marketing site](marketing-site.md), "Hero"),
with its Shuffle button, for every visitor, signed in or not, new or returning. It never shows the visitor's own
recent work: the hero is for starting something new, and the Explorer is where their work is.

Until October 2026 a browser with at least three recent items saw its four most recent on that fan instead, with a
card to Explorer Home (and before that, **Welcome back**). That went, so every app's hero is the same.

## The old note

To show that fan without the static landing page loading sign-in code or calling the api, the editor used to leave a
note in the browser: up to six recent designs in `localStorage` under `livedesign:recent-designs:v1`, and their
snapshot SVGs in Cache Storage (`livedesign-recent-thumbs-v2`, and `-v1` before it). With the fan gone nothing read
it, so the editor no longer writes it or fetches the thumbnails, and the api's design list no longer offers the
`?include=team-recent` that fed it.

A browser may still hold a note an older editor left. **Signing out** (and deleting the account) still clears the
note and both caches before the session ends (`apps/live/lib/recent-designs-snapshot.ts` `forgetRecentDesigns`), so
the next person on a shared computer never sees the account's design names; Repair clears the note too
([Load recovery](../007-editor/load-recovery.md)).

## Performance

Nothing on the landing page. The editor no longer writes the note on every design list or fetches a snapshot per
recent design; sign-out costs one `localStorage` removal and two Cache Storage deletes.
