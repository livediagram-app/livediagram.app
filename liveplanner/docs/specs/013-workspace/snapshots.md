# Snapshots

Status: built (Work Tracker 948)

Manual save points of the whole plan, built once for every app. The platform spec,
[Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md), is the source of truth for what a
snapshot is, the five kept, Revert and its automatic snapshot, the generation fence, the roles, the dialog and the
API. This spec says only what is liveplanner's own. (Not the previews in `006-*`, which are drawings of a plan.)

## What a snapshot holds here

The plan as its own export file, the `.liveplanner` envelope (`exportProjectFile`, plan-room/project-file.ts): every tab with its folder, and what else that file carries.

## What a revert puts back

- **Every tab**, with its id, order and folder, written as a save writes it (its revision moves forward); a tab made
  since is deleted, and one removed since comes back.
- **Cards, card types and Sheets** come back too. A card in both keeps its id, key, comment threads and
  History and takes the snapshot's type, rank and fields (its revision moves forward); a card made since is
  removed as a card delete removes it; a card removed since comes back with its key. The card type catalogue
  becomes the snapshot's, and every Sheet becomes the snapshot's, cells and layout.
- **Kept as they are**: the cards' comment threads (conversation, not content; a thread on a card the revert
  removes goes as that card's delete takes it) and the Automations rules (set-up). The plan's name stays.

## Roles

As the platform spec's table, through this app's edit gate on the whole plan ([Share roles](share-roles.md)): an
Editor of the whole plan takes, reverts and deletes; a tab-scoped link, a Participant and a Viewer see nothing (404);
an API token is refused (403).

## In the editor

The **Snapshots** button sits in the footer's tool cluster, after Automations, just before Settings, drawn for that Editor once the plan is
stored on the server (never in This Browser, a workbench frame or a Community visit). Its dialog is the shared one,
naming the item "plan".

## Where it is built

`/api/projects/<id>/snapshots`, answered inside the plan's Durable Object by `@liveworkspace/snapshots` through this app's door
(`liveplanner/apps/api/src/plan-room/plan-snapshots.ts`): its export, its content replace, its gate and the room's close.
