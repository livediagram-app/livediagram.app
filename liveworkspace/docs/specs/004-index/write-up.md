# Write It Up

**Write It Up** writes something from an item as a page in a knowledgebase, as the person (Work Tracker 1371): a done
card's decision from a plan, an article that explains a process. It is the one click behind two
[suggestions](../016-notifications/suggestions.md), and goes through the knowledgebase's own door the way a call's
summary does ([Start a Call Here](./item-calls.md) "After the call").

## Where it goes

The item's default knowledgebase, the first of:

1. One connected to the item, either way.
2. The newest of the item's team.
3. For an item with no team, the person's own newest.

Always one the person can edit; otherwise there is none, and the suggestion is not offered. A knowledgebase writes
nothing up into itself.

## The routes

- `GET /items/:id/write-up` answers `{knowledgebase: {id, title} | null}`.
- `POST /items/:id/write-up` with `{knowledgebase, title, body}` writes the page and answers `201 {page: {title, link}}`.

Both need an account in person (never a guest, an app or an export acting for someone) with **Edit** on the item: a
Participant or a Viewer of it writes nothing up. The POST is limited as kits are (`KIT_RUN_LIMITER`, its own key).

## The page

Made by the knowledgebase's door (`kb_page`), as a rule's step is, under the rule name **Write It Up**, from the item:
written as the person, never verified, its Owner the person. Its title is 1 to 200 characters; its body Markdown of 1 to
20,000 (`WRITE_UP_BODY_MAX`), cut at a line where longer, ending "From <title> (<app>): <link>" with the item's own
address, never a share code. A door that refuses answers `422 write_up_refused` with its reason.

## Telemetry

Counted by the suggestion that asked (`UI·Used·SuggestWriteUp`, `UI·Used·SuggestAddToKnowledgebase`); the index logs
`[index] write-up written` and `[index] write-up not written` with the door's code, never a title or words.
