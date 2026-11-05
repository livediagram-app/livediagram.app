# Social pieces blueprint

Derived from [Social pieces](../social-pieces.md).

## Files

| File                                                          | Role                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/document/src/office-social.ts`                      | The drawings (`OFFICE_SOCIAL_ART`), `pondParts`, the note and zone types, limits and validators |
| `packages/document/src/office.ts`                             | The kinds join `OfficeKind`; the pond is a sized kind                                           |
| `packages/document/src/participant-content.ts`                | `mergeNoticeNotes`: a Participant adds and removes only its own notes                           |
| `packages/document/src/validate-shape.ts`                     | `noticeNotes`, `clockZones`, `jukeboxSource` validation                                         |
| `../packages/avatar/src/office-geometry.ts`                   | Footprints (`OFFICE_FOOTPRINT`), the fixed seats, `isWallPieceShape`                            |
| `../packages/avatar/src/seats.ts`                             | `PING_PONG_SEATS`, `BENCH_SEATS`, `PICNIC_TABLE_SEATS`, `HAMMOCK_SEATS`                         |
| `../packages/avatar/src/walk.ts`                              | `elementUnderFeet` skips wall pieces                                                            |
| `apps/editor/components/canvas/collab/SocialArt.tsx`          | The live parts drawn over a piece's art: rally, fire, water, screen, jukebox lights             |
| `apps/editor/components/canvas/collab/SocialFaces.tsx`        | The Notice Board's cards and Notes button, the World Clock's dials, the Jukebox's button        |
| `apps/editor/components/canvas/collab/NoticeBoardPopover.tsx` | The note list and add box                                                                       |
| `apps/editor/components/canvas/collab/PondView.tsx`           | The pond at its own size                                                                        |
| `apps/editor/components/canvas/collab/useSocialPieces.ts`     | Which jukebox's area you stand in, the Insert Coin bubble, the audio element                    |
| `apps/editor/lib/minute-clock.ts`                             | The one shared minute timer (`useMinuteNow`)                                                    |
| `apps/editor/lib/jukebox-listening.ts`                        | The viewer's off / on / muted choice (this device), the shared audio element                    |
| `apps/editor/components/palette/SocialMenuSections.tsx`       | `WorldClockMenuSection`, `JukeboxMenuSection`                                                   |
| `apps/editor/app/social-motion.css`                           | The CSS loops, none under reduced motion                                                        |

## Domain and naming

| Term       | Identifier                  | Meaning                                                      |
| ---------- | --------------------------- | ------------------------------------------------------------ |
| Note       | `NoticeNote`, `noticeNotes` | `{ id, title?, text, author, by, at, color? }`, oldest first |
| Zone       | `ClockZone`, `clockZones`   | `{ zone, label }`, up to six                                 |
| Source     | `jukeboxSource`             | An `https` audio address                                     |
| Listening  | `JukeboxListening`          | `'off' \| 'on' \| 'muted'`, per device                       |
| Wall piece | `isWallPieceShape`          | Notice board, world clock: never blocks, never rung          |

## Behaviour and state

- **Pinning**: the popover commits through `commitElements`, so an Editor's pin is an ordinary element update and a
  Participant's passes `guardCommit`, then the room's `applyParticipantOp`, whose `mergeNoticeNotes` keeps stored notes,
  adds incoming notes signed with the sender's adder key that are new, and drops stored notes the sender signed that
  the incoming list left out.
- **The minute**: `useMinuteNow` is a `useSyncExternalStore` over one `setTimeout` to the next whole minute, armed while
  one clock is subscribed and cleared when the last unsubscribes.
- **The jukebox**: `useSocialPieces` (in `useCanvasAvatar`) narrows the elements to jukeboxes, arcades and rooms once
  per element change, then on each move of your feet works out the jukebox whose area holds you and the arcade you
  stand at; an effect sets the one shared `HTMLAudioElement`'s source and plays or pauses it only when that answer,
  the source or your choice changes.
