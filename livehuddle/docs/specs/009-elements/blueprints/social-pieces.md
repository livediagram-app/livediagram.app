# Social pieces blueprint

Derived from [Social pieces](../social-pieces.md).

## Files

| File                                                          | Role                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/document/src/office-social.ts`                      | The drawings (`OFFICE_SOCIAL_ART`), `pondParts`, the note and zone types, limits and validators |
| `packages/document/src/office.ts`                             | The kinds join `OfficeKind`; the pond is a sized kind                                           |
| `packages/document/src/participant-content.ts`                | `mergeNoticeNotes`: a Participant adds and removes only its own notes                           |
| `packages/document/src/element-deltas.ts`                     | The `notice-pin` and `notice-unpin` deltas, applied on every screen and in the store            |
| `packages/document/src/validate-shape.ts`                     | `noticeNotes`, `clockZones`, `jukeboxSource` validation                                         |
| `../packages/avatar/src/office-geometry.ts`                   | Footprints (`OFFICE_FOOTPRINT`), the fixed seats, `isWallPieceShape`                            |
| `../packages/avatar/src/seats.ts`                             | `PING_PONG_SEATS`, `BENCH_SEATS`, `PICNIC_TABLE_SEATS`, `HAMMOCK_SEATS`                         |
| `../packages/avatar/src/walk.ts`                              | `elementUnderFeet` skips wall pieces                                                            |
| `apps/editor/components/canvas/collab/SocialArt.tsx`          | The live parts drawn over a piece's art: rally, fire, water, screen, jukebox lights             |
| `apps/editor/components/canvas/collab/SocialFaces.tsx`        | The Notice Board's cards and Notes button, the World Clock's dials, the Jukebox's button        |
| `apps/editor/lib/piece-control.ts`                            | `pieceControlProps`, `isPieceControlPress`: a face's control keeps its press from the canvas    |
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

- **Pinning**: the popover sends one delta through the editor's `applyElementDelta` (`useElementDeltas`), never a
  history commit: `{ kind: 'notice-pin', note }` or `{ kind: 'notice-unpin', noteId, by }`. `applyElementDelta`
  (`element-deltas.ts`) applies it on the sender, every receiver and the store: only on a notice board that is not
  locked, a pin only when the note passes `isNoticeNote`, its id is new and the board holds fewer than `NOTES_MAX`, an
  unpin only when the note's `by` matches. `mergeIncomingElement` keeps the receiver's `noticeNotes`,
  `elementChangeIsDeltaOnly` leaves them out of its comparison (so a notes-only change sends no `el` update), and
  `graftLiveTabState` carries them over an undo or redo. The room's ledger (`collab-ledger.ts`) records each pin and
  unpin, so an Editor's save snapshotted before a pin merges it.
- **The room's rule**: `notice-pin` and `notice-unpin` are participation deltas (`PARTICIPATION_DELTA_KINDS`); the op
  gate (`room-op-gate.ts`) relays a Participant's only when `answersAsSelf` finds the note's (or the unpin's) `by`
  equal to the session's adder key, then schedules the room's answers write, which folds the ledger's notes into the
  stored tab (`mergeLedgerAnswersIntoTab`), applying each against the stored board. A Viewer's is dropped.
  `mergeNoticeNotes` stays on the participant content rule, as defence against an older screen's `el` update.
- **The minute**: `useMinuteNow` is a `useSyncExternalStore` over one `setTimeout` to the next whole minute, armed while
  one clock is subscribed and cleared when the last unsubscribes.
- **The jukebox**: `useSocialPieces` (in `useCanvasAvatar`) narrows the elements to jukeboxes, arcades and rooms once
  per element change, then on each move of your feet works out the jukebox whose area holds you and the arcade you
  stand at; an effect sets the one shared `HTMLAudioElement`'s source and plays or pauses it only when that answer,
  the source or your choice changes.
