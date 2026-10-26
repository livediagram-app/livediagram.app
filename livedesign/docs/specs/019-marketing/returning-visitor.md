# Returning visitor

Status: shipped

## What

The landing page's hero always ends in the fan of template cards ([Marketing site](marketing-site.md), "Hero"),
with its Shuffle button, for every visitor, signed in or not, new or returning. It never shows the visitor's own
recent work: the hero is for starting something new, and the Explorer is where their work is. Every app's hero is
the same in this.

## The recent-designs note

The editor writes no note of recent designs for the landing page, and the api's design list offers no
`?include=team-recent`. A browser may still hold a note an older build left: up to six recent designs in
`localStorage` under `livedesign:recent-designs:v1`, and their snapshot SVGs in Cache Storage
(`livedesign-recent-thumbs-v2` and `-v1`). **Signing out** (and deleting the account) clears the note and both
caches before the session ends (`apps/live/lib/recent-designs-snapshot.ts` `forgetRecentDesigns`), so the next person
on a shared computer never sees the account's design names; Repair clears the note too
([Load recovery](../007-editor/load-recovery.md)).

## Performance

Nothing on the landing page. Sign-out costs one `localStorage` removal and two Cache Storage deletes.
