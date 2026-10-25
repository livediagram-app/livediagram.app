# Empty plan clean-up

Status: shipped

## What

A plan that has held nothing for 30 days moves to the
[Trash](trash.md) on its own. From there the Trash's usual 30 days apply, so it
can still be restored, and it is removed for good only after both clocks have
run. An empty plan gives its owner nothing, but every one of them is an
item the index keeps and lists and a Durable Object the platform keeps; letting
them go keeps the Explorer clean without anyone having to tidy up.

## Which plans

A plan is **empty** when none of its tabs holds an element or a form, and it holds no card and no
sheet. A Form tab's form is stored on its tab beside the elements, not as elements
([Forms](../030-forms/forms.md)), so a tab holding a form keeps its plan, even a form with no questions yet. Cards
and sheets are kept beside the tabs, so a plan holding either is never empty. A plan with no tabs at all is empty
too. Nothing else counts as content: a name, extra blank tabs, a tab's settings (background, grid), a share link,
a star or a folder never keep a plan. A tab shared with another plan
([Tab ↔ project many-to-many](../006-project/tab-project-many-to-many.md)) is a copy in every plan that holds it, so it
counts in each: if it has elements or a form, none of those plans is empty.

A plan is **stale** when it was created at least 30 days ago and has not
been saved for 30 days. Saving an empty plan (renaming a tab, changing a
tab's settings, clearing its last element) starts the 30 days again, so a
plan someone is still working with is never taken from under them.

Every plan on the server is covered: a guest's, an account's and a team
library's, the same rule for each. A team plan goes to its team's Trash,
where any joined member can restore it, as it would if a teammate deleted it.
[Offline Mode](../006-project/offline-mode.md) plans live only in the
browser, cost the server nothing, and are never touched.

## The sweep

liveworkspace's index runs it, once for every app, in its daily run (the one that purges the Trash):
`sweepEmpty` in `liveworkspace/apps/index/src/purge.ts`. Each plan's Durable Object pushes its summary to the
index after every save, and the summary carries `hasContent`, whether any tab holds anything (the rule above). The
sweep moves every live plan whose summary says `hasContent: false`, or that never pushed one (its content was
never written), and that has not changed for 30 days, to the Trash with the reason `empty`. The check and the move
are one statement, so a plan saved a moment before is not moved. A team plan goes to its team's Trash. The sweep
moves at most 1,000 items a run, oldest change first, so a backlog drains over a few days, and it logs how many it
moved. The app runs no sweep of its own.

The move stamps the plan's Trash time with **the moment of the sweep**,
never its creation or last save. The Trash's purge counts from that time, so an
automatically moved plan always waits the full 30 days in the Trash, the
same as one a person deleted: the sweep never hands the purge a plan it
removes at once. In all, an empty plan is removed for good no sooner than
60 days after its last save.

Nothing announces the move: no email, no toast, no Timeline card. An empty
plan holds nothing to lose, the Trash lets anyone bring it back, and the
Trash's help article explains the rule.

## In the Trash

An automatically moved plan is marked with why it is there, and the Trash
says so on its row: "Moved here {d MMM} because it was empty" in place of
"Deleted {d MMM}", followed by the days left as usual. Opening one by URL shows
the deleted card, worded for what happened: no one deleted it, so someone who
may restore it reads **In the Trash** and "This plan is in the Trash", then
that it was empty for 30 days and so moved there. A share-link visitor, who
learns no reason, reads the usual "This plan was deleted".

A person deleting a plan leaves it unmarked. The mark is a reason, not an
author: it records no one, so it adds nothing to erase on account deletion.

## Restore

Restoring an automatically moved plan works like any restore. The index remembers the change it was moved for
(`empty_swept_for`), so it is never moved back for that same change: only after it is saved again and then left
empty for 30 days does it go to the Trash again. A plan a person deleted restores exactly as it was, its
last-saved time untouched.

## The API

`GET /api/trash` rows carry `reason`: `deleted` (a person, a script or an AI
tool deleted it) or `empty` (the sweep moved it). The MCP server's
`list_trash` carries the same field ([MCP server](../015-api/mcp-server.md)).
Offline Mode's local Trash rows are always `deleted`.

## Decided trade-offs

- **The Trash, not a hard delete.** Removing empty plans outright would be
  simpler, but a rule applied without anyone asking should always be
  reversible. The Trash already is.
- **Last save, not creation, sets the clock.** Creation alone would move a
  plan whose owner cleared it yesterday to start over. Since a plan is
  saved when it is created, "saved over 30 days ago" also means "created over
  30 days ago".
- **No room broadcast.** A person deleting a plan tells its open sessions
  at once. The sweep does not: a plan untouched for 30 days rarely has one,
  and one that does loses its grant at the next renewal, since the index grants
  nothing on an item in the Trash.
- **No telemetry event.** Telemetry counts what people do; the sweep is not a
  person. Its log line counts it, and the Trash's `Restored` event already
  says whether anyone comes back for what it moved.
