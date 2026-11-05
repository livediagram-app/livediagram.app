# Screen and Room Sign blueprint

Derived from [Screen and Room Sign](../screen-and-room-sign.md). Knocking is [Knock](../../012-collaboration/blueprints/knock.md).

## Files

| File                                                    | Role                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/meeting-pieces.ts`               | Kinds, sizes, `meetingPieceRoom`, `isScreenUrl`, `screenVideoTarget`, `SCREEN_ART`, `ROOM_SIGN_ART`, the sign's words |
| `packages/document/src/svg-render-meeting.ts`           | Export: `screenSvg`, `roomSignSvg`                                                                                    |
| `packages/document/src/shape-factory.ts`                | Default sizes, aspect lock, no label                                                                                  |
| `packages/document/src/validate-shape.ts`               | `screenUrl` validation                                                                                                |
| `packages/document/src/office.ts`                       | `PLACED_KINDS`: both are placed pieces                                                                                |
| `packages/document/src/behaviour-shapes.ts`             | In the Behaviours family, no settings `…`                                                                             |
| `apps/editor/lib/office/useMeetingPieces.ts`            | Each piece's room and who is in it, published on presence change; Knock; the pod door toast                           |
| `apps/editor/lib/office/meeting-live.ts`                | The pieces' store: per-element snapshots, value-compared, so only a changed face re-renders                           |
| `apps/editor/components/calls/useCanvasCall.ts`         | Runs `useMeetingPieces` beside the call, with the same rooms (`roomZones`)                                            |
| `apps/editor/components/canvas/collab/ScreenView.tsx`   | The Screen's face: share, video poster or idle; press to open                                                         |
| `apps/editor/components/canvas/collab/ScreenPlayer.tsx` | The large video player (the maximised panel's shell)                                                                  |
| `apps/editor/components/canvas/collab/RoomSignView.tsx` | The sign's face, its minute clock and Knock button                                                                    |
| `apps/editor/components/canvas/PieceArt.tsx`            | Routes both kinds to their views (canvas and placement preview)                                                       |
| `apps/editor/components/palette/ScreenMenuSection.tsx`  | Video Link, Set, Clear                                                                                                |
| `apps/editor/hooks/canvas/useDataShapeSetters.ts`       | `setScreenUrlSelected`                                                                                                |
| `apps/editor/components/palette/space-categories.tsx`   | The **Meeting** category (`collab-meeting`, tile group `meeting`)                                                     |
| `apps/editor/components/palette/palette-tile-defs.tsx`  | The two tiles; glyphs in `palette-icons-meeting.tsx`                                                                  |

## Domain and naming

| Term          | Identifier                                    | Meaning                                                          |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Meeting piece | `MeetingPieceKind`, `isMeetingPieceShape`     | `screen`, `room-sign`                                            |
| Piece's room  | `meetingPieceRoom(el, zones)`                 | Innermost zone holding its centre, else nearest within 64 px     |
| Video Link    | `ShapeElement.screenUrl`, `screenVideoTarget` | A YouTube, Vimeo or Loom address, through the embeds' own parser |
| Snapshot      | `ScreenLive`, `SignLive`                      | Who is inside (Screen); name, status, count, since (Sign)        |

## How the Screen picks a share

`ScreenLive.inside` lists who stands in its room, nearest first (`SELF_MEDIA_ID` for you). The face reads the call's
received streams (`useCallMedia`) and shows the first person in that list with a `screen` stream. It never asks for a
subscription of its own, so the call's bubble rules and caps are the only thing deciding what arrives.

## Performance

- `useMeetingPieces` filters the board for pieces once per board change; with none it publishes an empty map and
  stops. With some, each presence change zones the walkers once (`zonesOfWalkers`, walkers × rooms).
- `setMeetingLive` keeps an unchanged snapshot's object and emits nothing when nothing changed, so a step inside a
  room wakes no face unless the Screen's nearest-first order or a sign's count changed.
- The sign's clock is a 30 second interval, only while In Use.
