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

## Kept by a rule

A snapshot an Automations rule reverts to ([Snapshot steps](../026-plan/automations.md#snapshot-steps)) is kept
beside the latest five, marked **Kept by a Rule** in History with no Delete, while any rule of the plan names it (at
most five). A rule's Take Snapshot is an ordinary snapshot by Automation with the rule's name.

## Roles

As the platform spec's table, through this app's edit gate on the whole plan ([Share roles](share-roles.md)): an
Editor of the whole plan takes, reverts and deletes; a tab-scoped link, a Participant and a Viewer see nothing (404);
an API token is refused (403).

## With Pro on

What is kept follows the plan's **owner's** tier, whoever takes the snapshot
([Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md) "With Pro on"): the latest five, each for
7 days, on Free; the latest 50 with no age limit on Pro and Pro for Teams. The owner is the index's grant's (the team
for a team's plan), and only a tier the subscription service confirmed is applied: an owner the grant does not name,
or a service out of reach, drops nothing. With Pro off the latest five are kept, as always.

## In History

Snapshots live inside **History** in the footer's **Tools** menu ([The footer's Tools menu](../../../../liveworkspace/docs/specs/004-index/footer-tools-menu.md)
"History, with Snapshots in it"; owner, 2026-11-17), there for that Editor once the plan is stored on the server
(never Offline, a workbench frame or a Community visit): **Take Snapshot** over History's timeline and each
snapshot pinned on it, or the snapshots on their own for an Editor through a share link, naming the item
"plan" ([Snapshots](../../../../liveworkspace/docs/specs/014-snapshots/snapshots.md) "In History"). There is no
Snapshots row of its own.

## Where it is built

`/api/projects/<id>/snapshots`, answered inside the plan's Durable Object by `@liveworkspace/snapshots` through this app's door
(`liveplanner/apps/api/src/plan-room/plan-snapshots.ts`): its export, its content replace, its gate and the room's close.
