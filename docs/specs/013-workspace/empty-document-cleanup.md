# Empty document clean-up

Status: shipped

## What

A document that has held nothing for 30 days moves to the
[Trash](trash.md) on its own. From there the Trash's usual 30 days apply, so it
can still be restored, and it is removed for good only after both clocks have
run. An empty document gives its owner nothing, but every one of them is a row
the database keeps, lists and sweeps; letting them go keeps the Explorer and
the database clean without anyone having to tidy up.

## Which documents

A document is **empty** when none of its tabs holds an element. A document with
no tabs at all is empty too. Nothing else counts as content: a name, extra
blank tabs, a tab's settings (background, grid), a share link, a star or a
folder never keep a document. Comments and actions live on elements, so an
empty document has none. A tab shared with another document
([Tab ↔ document many-to-many](../006-document/tab-document-many-to-many.md))
counts in every document that holds it: if it has elements, none of those
documents is empty.

A document is **stale** when it was created at least 30 days ago and has not
been saved for 30 days. Saving an empty document (renaming a tab, changing a
tab's settings, clearing its last element) starts the 30 days again, so a
document someone is still working with is never taken from under them.

Every document on the server is covered: a guest's, an account's and a team
library's, the same rule for each. A team document goes to its team's Trash,
where any joined member can restore it, as it would if a teammate deleted it.
[Offline Mode](../006-document/offline-mode.md) documents live only in the
browser, cost the server nothing, and are never touched.

## The sweep

The api worker's daily `0 3 * * *` cron, the one that already purges the Trash,
moves every live document that is both empty and stale to the Trash. The check
and the move are one statement, so a document saved a moment before the sweep
is not moved. The sweep is capped per run, oldest first, so a backlog drains
over a few days. It logs how many it moved.

The move stamps the document's Trash time with **the moment of the sweep**,
never its creation or last save. The Trash's purge counts from that time, so an
automatically moved document always waits the full 30 days in the Trash, the
same as one a person deleted: the sweep never hands the purge a document it
removes at once. In all, an empty document is removed for good no sooner than
60 days after its last save.

Nothing announces the move: no email, no toast, no Timeline card. An empty
document holds nothing to lose, the Trash lets anyone bring it back, and the
Trash's help article explains the rule.

## In the Trash

An automatically moved document is marked with why it is there, and the Trash
says so on its row: "Moved here {d MMM} because it was empty" in place of
"Deleted {d MMM}", followed by the days left as usual. Opening one by URL shows
the usual deleted card; someone who may restore it reads that it was empty for
30 days and so moved to the Trash.

A person deleting a document leaves it unmarked. The mark is a reason, not an
author: it records no one, so it adds nothing to erase on account deletion.

## Restore

Restoring an automatically moved document works like any restore, and counts as
a save: its 30 stale days start again from the restore, so it is not moved
straight back by the next sweep. A document a person deleted restores exactly
as it was, its last-saved time untouched.

## The API

`GET /api/trash` rows carry `reason`: `deleted` (a person, a script or an AI
tool deleted it) or `empty` (the sweep moved it). The MCP server's
`list_trash` carries the same field ([MCP server](../015-api/mcp-server.md)).
Offline Mode's local Trash rows are always `deleted`.

## Decided trade-offs

- **The Trash, not a hard delete.** Removing empty documents outright would be
  simpler, but a rule applied without anyone asking should always be
  reversible. The Trash already is.
- **Last save, not creation, sets the clock.** Creation alone would move a
  document whose owner cleared it yesterday to start over. Since a document is
  saved when it is created, "saved over 30 days ago" also means "created over
  30 days ago".
- **No room broadcast.** A person deleting a document tells its open sessions
  at once. The sweep does not: a document untouched for 30 days rarely has one,
  and one that does stops at its next save, which answers `document_trashed`,
  the same fallback the Trash already relies on when the room is unreachable.
- **No telemetry event.** Telemetry counts what people do; the sweep is not a
  person. Its log line counts it, and the Trash's `Restored` event already
  says whether anyone comes back for what it moved.
