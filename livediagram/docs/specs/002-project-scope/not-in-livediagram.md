# Not in livediagram

Status: **approved, built** (Work Tracker #650, owner, 2026-11-07 and 2026-11-09; folds in the cancelled #619 and
#351).

livehuddle is the meeting product: people meet in Spaces, walk as characters and sit together
([livehuddle's purpose](../../../../livehuddle/docs/specs/001-project-vision/purpose.md)). livediagram is for diagrams,
drawing and workshops. Everything below used to be in both and **now lives in livehuddle alone**; livehuddle's specs
are the ones to read and change.

## Why

The owner (2026-11-07): livediagram should not keep its own Spaces now that livehuddle is the meeting product. On
2026-11-09 the owner widened it to Avatar mode itself, to everything whose purpose depends on a character walking, and
to the shared code only Spaces use: "things like avatar mode are no longer used anywhere but livehuddle, so they don't
need to be in shared packages either". One home for each tool means one copy to fix.

## What moved to livehuddle

| What                                                                                                                                                                                    | livehuddle's spec                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avatar mode: the character, walking, the camera follow, the Avatar button and character sheet, Behaviour and its keys, speech bubbles, pushing, statuses, the "While walking" key list | [Avatar mode](../../../../livehuddle/docs/specs/008-canvas/avatar-mode.md)                                                                                                                                                                                                                                                                      |
| The Avatar tour and its Settings row (Getting Started > Avatar Tour, `avatarTourSeen`)                                                                                                  | [Avatar tour](../../../../livehuddle/docs/specs/008-canvas/avatar-tour.md)                                                                                                                                                                                                                                                                      |
| Chair, Desk and Sofa                                                                                                                                                                    | [Chair](../../../../livehuddle/docs/specs/009-elements/chair.md)                                                                                                                                                                                                                                                                                |
| The office pieces: Room, Meeting Table, Plant, Bookshelf, Water Cooler, Coffee Machine and Rug                                                                                          | [Office](../../../../livehuddle/docs/specs/009-elements/office.md)                                                                                                                                                                                                                                                                              |
| Fence                                                                                                                                                                                   | [Fence](../../../../livehuddle/docs/specs/009-elements/fence.md)                                                                                                                                                                                                                                                                                |
| Avatar Pad                                                                                                                                                                              | [Avatar Pad](../../../../livehuddle/docs/specs/009-elements/avatar-pad.md)                                                                                                                                                                                                                                                                      |
| Turning furniture (`chairFacing`, Rotate Left / Right on furniture)                                                                                                                     | [Furniture facing](../../../../livehuddle/docs/specs/009-elements/furniture-facing.md)                                                                                                                                                                                                                                                          |
| The Spaces templates: Virtual Office, Coworking Space, Team Pod and All-Hands Hall                                                                                                      | [Virtual Office template](../../../../livehuddle/docs/specs/012-collaboration/virtual-office-template.md)                                                                                                                                                                                                                                      |
| The Selection Mode button's Avatar option, and walking into a Portal or onto a Reaction Pad                                                                                             | [Selection Mode button](../../../../livehuddle/docs/specs/009-elements/mode-button.md), [Portal](../../../../livehuddle/docs/specs/009-elements/portal-element.md)                                                                                                                                                                             |
| The Portal tour and its Settings row (Show Me > Portal, `portal`)                                                                                                                       | [Element tours](../../../../livehuddle/docs/specs/007-editor/element-tours.md)                                                                                                                                                                                                                                                                  |
| The room's `avatar`, `avatar-push` and `avatar-say` presence ops                                                                                                                        | [Avatar mode](../../../../livehuddle/docs/specs/008-canvas/avatar-mode.md) "Presence"                                                                                                                                                                                                                                                           |

## What stays in livediagram

Each of these is fully useful by click in a diagram or a workshop, with no character on the board. Their walk-in or
walk-onto hooks are gone; everything else about them is unchanged.

- **[Portal](../009-elements/portal-element.md)**: click it to jump to its linked portal, on this tab or another.
- **[Reaction Pad](../009-elements/reaction-pad.md)**: press it to throw a burst; a workshop's applause button.
- **[Bring Focus](../012-collaboration/bring-focus.md)**: press it and everyone is offered a jump to it.
- **[Selection Mode button](../009-elements/mode-button.md)**: still hands out Select, Hand, Laser, Spotlight, Eraser,
  Format and Isometric, which are real presenting and editing tools.
- **[Reveal zone](../009-elements/reveal-zone.md)**, **[Link cards](../009-elements/link-cards.md)**, the Session
  strip's Timer and Vote, the [facilitator baton](../012-collaboration/facilitator.md) and
  [Follow-me](../012-collaboration/follow-me-viewport.md).

## Documents that already hold them

A document saved before the move keeps every element exactly as stored: **no migration, nothing dropped**. The stored
schema still parses each retired kind and its fields (`chairFacing`, `roomDoor`, a Selection Mode button's `mode:
'avatar'`), so a save writes them back untouched and livehuddle can still read them.

livediagram draws each one as a **retired placeholder** ([Retired elements](../009-elements/retired-elements.md)): a
calm labelled card naming the piece and saying it moved to livehuddle. It can be selected, moved, resized and deleted
under the ordinary element rules (an Editor's, or a Participant's on what the room lets them move), but never added:
the palette, the templates, search, paste-as-new and the MCP and CLI create paths do not offer the retired kinds, and
the MCP server and the API refuse a create that names one, with a message pointing to livehuddle.

## The room

A peer on an older livediagram client may still send `avatar`, `avatar-push` or `avatar-say`. The room **ignores**
them: they are dropped before relay, without an error frame and without counting against the sender, so an old tab
keeps working and nobody else sees a ghost character. livediagram's own client never sends them and never draws a
peer's character.

## Settings and telemetry

Getting Started > Avatar Tour and Show Me > Portal leave livediagram's Settings. A stored `avatarTourSeen` or
`elementToursSeen.portal` in someone's synced preferences is left where it is and ignored. The telemetry dashboard
marks their series (`AvatarTourSeenOn/Off`, `PortalTourSeenOn/Off`) and every Avatar-mode and furniture series as
retired (docs/specs/017-telemetry/telemetry.md "Retired features"); livehuddle keeps its own.

## Shared code

Code that only livehuddle uses after the move leaves the monorepo's `packages/` for `livehuddle/packages/` (the root
AGENTS.md rule: `packages/` is for code two or more products need). Code that two or more products still use stays.
