# Empty project clean-up

Status: shipped

## What

A project that has held nothing for 30 days moves to the
[Trash](trash.md) on its own. From there the Trash's usual 30 days apply, so it
can still be restored, and it is removed for good only after both clocks have
run. An empty project gives its owner nothing, but every one of them is a row
the database keeps, lists and sweeps; letting them go keeps the Explorer and
the database clean without anyone having to tidy up.

## Which projects

A project is **empty** when none of its tabs holds an element or a form. A Form tab's form is
stored on its tab beside the elements, not as elements ([Forms](../030-forms/forms.md)), so a tab holding a form keeps its
project too, even a form with no questions yet. A project with
no tabs at all is empty too. Nothing else counts as content: a name, extra
blank tabs, a tab's settings (background, grid), a share link, a star or a
folder never keep a project. Comments and actions live on elements, so an
empty project has none. A tab shared with another project
([Tab ↔ project many-to-many](../006-project/tab-project-many-to-many.md))
counts in every project that holds it: if it has elements, an article or a form,
none of those projects is empty.

A project is **stale** when it was created at least 30 days ago and has not
been saved for 30 days. Saving an empty project (renaming a tab, changing a
tab's settings, clearing its last element) starts the 30 days again, so a
project someone is still working with is never taken from under them.

Every project on the server is covered: a guest's, an account's and a team
library's, the same rule for each. A team project goes to its team's Trash,
where any joined member can restore it, as it would if a teammate deleted it.
[Offline Mode](../006-project/offline-mode.md) projects live only in the
browser, cost the server nothing, and are never touched.

## The sweep

The api worker's daily `0 3 * * *` cron, the one that already purges the Trash,
moves every live project that is both empty and stale to the Trash. The check
and the move are one statement, so a project saved a moment before the sweep
is not moved. The sweep is capped per run, oldest first, so a backlog drains
over a few days. It logs how many it moved.

The move stamps the project's Trash time with **the moment of the sweep**,
never its creation or last save. The Trash's purge counts from that time, so an
automatically moved project always waits the full 30 days in the Trash, the
same as one a person deleted: the sweep never hands the purge a project it
removes at once. In all, an empty project is removed for good no sooner than
60 days after its last save.

Nothing announces the move: no email, no toast, no Timeline card. An empty
project holds nothing to lose, the Trash lets anyone bring it back, and the
Trash's help article explains the rule.

## In the Trash

An automatically moved project is marked with why it is there, and the Trash
says so on its row: "Moved here {d MMM} because it was empty" in place of
"Deleted {d MMM}", followed by the days left as usual. Opening one by URL shows
the deleted card, worded for what happened: no one deleted it, so someone who
may restore it reads **In the Trash** and "This project is in the Trash", then
that it was empty for 30 days and so moved there. A share-link visitor, who
learns no reason, reads the usual "This project was deleted".

A person deleting a project leaves it unmarked. The mark is a reason, not an
author: it records no one, so it adds nothing to erase on account deletion.

## Restore

Restoring an automatically moved project works like any restore, and counts as
a save: its 30 stale days start again from the restore, so it is not moved
straight back by the next sweep. A project a person deleted restores exactly
as it was, its last-saved time untouched.

## The API

`GET /api/trash` rows carry `reason`: `deleted` (a person, a script or an AI
tool deleted it) or `empty` (the sweep moved it). The MCP server's
`list_trash` carries the same field ([MCP server](../015-api/mcp-server.md)).
Offline Mode's local Trash rows are always `deleted`.

## Decided trade-offs

- **The Trash, not a hard delete.** Removing empty projects outright would be
  simpler, but a rule applied without anyone asking should always be
  reversible. The Trash already is.
- **Last save, not creation, sets the clock.** Creation alone would move a
  project whose owner cleared it yesterday to start over. Since a project is
  saved when it is created, "saved over 30 days ago" also means "created over
  30 days ago".
- **No room broadcast.** A person deleting a project tells its open sessions
  at once. The sweep does not: a project untouched for 30 days rarely has one,
  and one that does stops at its next save, which answers `project_trashed`,
  the same fallback the Trash already relies on when the room is unreachable.
- **No telemetry event.** Telemetry counts what people do; the sweep is not a
  person. Its log line counts it, and the Trash's `Restored` event already
  says whether anyone comes back for what it moved.
