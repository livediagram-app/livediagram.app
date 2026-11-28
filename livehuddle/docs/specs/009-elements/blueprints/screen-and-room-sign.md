# Screen and Room Sign blueprint

Derived from [Screen and Room Sign](../screen-and-room-sign.md). Knocking is [Knock](../../012-collaboration/blueprints/knock.md).

## Files

| File                                                             | Role                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/meeting-pieces.ts`                        | Kinds, sizes, `meetingPieceRoom`, `isScreenUrl`, `screenVideoTarget`, `SCREEN_ART`, `ROOM_SIGN_ART`, the sign's words; `SCREEN_MIN`/`SCREEN_MAX`, `clampScreenBox`, `ScreenSource`, `screenSourcePatch`, `screenFile`, `withScreenFile` (a call's file on a template's Screens) |
| `packages/document/src/svg-render-meeting.ts`                    | Export: `screenSvg`, `roomSignSvg`                                                                                                                                                                                                                                              |
| `packages/document/src/shape-factory.ts`                         | Default sizes, aspect lock, no label                                                                                                                                                                                                                                            |
| `packages/document/src/validate-shape.ts`                        | `screenUrl` validation; `liveItem`, `liveName`, `liveTab` (element-model's live embed checks, no `livePoster`)                                                                                                                                                                  |
| `packages/document/src/placed-kinds.ts`                          | `isFixedSizeElement`: a Screen keeps its resize handles                                                                                                                                                                                                                         |
| `packages/document/src/office.ts`                                | `PLACED_KINDS`: both are placed pieces                                                                                                                                                                                                                                          |
| `packages/document/src/behaviour-shapes.ts`                      | In the Behaviours family, no settings `…`                                                                                                                                                                                                                                       |
| `apps/editor/lib/office/useMeetingPieces.ts`                     | Each piece's room and who is in it, published on presence change; Knock; Walk In; the pod door toast                                                                                                                                                                            |
| `apps/editor/lib/office/meeting-live.ts`                         | The pieces' store: per-element snapshots, value-compared, so only a changed face re-renders                                                                                                                                                                                     |
| `apps/editor/components/calls/useCanvasCall.ts`                  | Runs `useMeetingPieces` beside the call, with the same rooms (`roomZones`)                                                                                                                                                                                                      |
| `apps/editor/components/canvas/collab/ScreenView.tsx`            | The Screen's face: share, file, video poster or idle; press to open                                                                                                                                                                                                             |
| `apps/editor/components/canvas/collab/ScreenFileFace.tsx`        | A file on the panel: the title card, the wall frame (in the room, `SCREEN_FRAME_LAYOUT_WIDTH` scaled), the status chip                                                                                                                                                          |
| `apps/editor/components/canvas/collab/ScreenFileOverlay.tsx`     | The file opened large: frame taking the pointer, Show This Tab on the Screen, Open in its app, the lock card                                                                                                                                                                    |
| `apps/editor/components/canvas/collab/ScreenFileOverlayHost.tsx` | The overlay with the editor's role and `setScreenSourceOf`, read only while open                                                                                                                                                                                                |
| `apps/editor/components/canvas/collab/screen-words.ts`           | Every Screen word the face, overlay, menu, reader and dialog say                                                                                                                                                                                                                |
| `apps/editor/components/dialogs/ScreenSourceDialog.tsx`          | Show on the Screen: File (the workbench's `LiveEmbedChooser`, no role, no poster) and Video; its host                                                                                                                                                                           |
| `apps/editor/components/dialogs/screen-source-panel.ts`          | The dialog's and the overlay's lazy panels (`lazyPanel`), preloaded by their openers                                                                                                                                                                                            |
| `apps/editor/lib/office/screen-picker-store.ts`                  | Which Screen Show on the Screen is open for, and on which source                                                                                                                                                                                                                |
| `apps/editor/components/canvas/collab/ScreenPlayer.tsx`          | The large video player (the maximised panel's shell)                                                                                                                                                                                                                            |
| `apps/editor/components/canvas/collab/RoomSignView.tsx`          | The sign's face, its minute clock and Knock button                                                                                                                                                                                                                              |
| `apps/editor/components/canvas/collab/RoomSignReader.tsx`        | The sign's reader: header chip, figures, Who's Inside, Knock and Walk In (`signActions`)                                                                                                                                                                                        |
| `apps/editor/components/canvas/collab/room-sign-clock.ts`        | `useMinuteClock` and `useKnockedRecently`, shared by the face and the reader                                                                                                                                                                                                    |
| `apps/editor/components/canvas/collab/ReaderShell.tsx`           | The reader's dialog; its `subtitle` and `footer` slots carry the sign's chip and actions                                                                                                                                                                                        |
| `apps/editor/components/canvas/PieceArt.tsx`                     | Routes both kinds to their views (canvas and placement preview)                                                                                                                                                                                                                 |
| `apps/editor/components/palette/ScreenMenuSection.tsx`           | What it shows now, Choose (or Change), Clear                                                                                                                                                                                                                                    |
| `apps/editor/hooks/canvas/useDataShapeSetters.ts`                | `setScreenSourceSelected`, `setScreenSourceOf`                                                                                                                                                                                                                                  |
| `apps/editor/hooks/canvas/boxed-drag-resolve.ts`                 | `resizedElement` clamps a Screen with `clampScreenBox`                                                                                                                                                                                                                          |
| `apps/editor/components/palette/space-categories.tsx`            | The **Meet** category (`collab-meeting`, tile group `meeting`)                                                                                                                                                                                                                  |
| `apps/editor/components/palette/palette-screen-presets.tsx`      | `SCREEN_PRESET_TILES`: the Screen tile's five sizes (Monitor, Small, Medium, Large, Cinema), its `variants`; also the Type section's choices (`piece-type-tiles.ts`)                                                                                                            |
| `packages/document/src/piece-variants.ts`                        | `SCREEN_VARIANTS` (`medium` first, absent) and their boxes in `PIECE_VARIANT_SIZES`; `piece-type.ts` retypes a Screen keeping its back on its wall (`mountedFace`, `wall-mounted.ts`)                                                                                           |
| `apps/editor/components/palette/palette-tile-defs.tsx`           | The two tiles; glyphs in `palette-icons-meeting.tsx`                                                                                                                                                                                                                            |

## Domain and naming

| Term          | Identifier                                      | Meaning                                                                |
| ------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Meeting piece | `MeetingPieceKind`, `isMeetingPieceShape`       | `screen`, `room-sign`                                                  |
| Piece's room  | `meetingPieceRoom(el, zones)`                   | Innermost zone holding its centre, else nearest within 64 px           |
| Video Link    | `ShapeElement.screenUrl`, `screenVideoTarget`   | A YouTube, Vimeo or Loom address, through the embeds' own parser       |
| Screen's file | `liveItem`, `liveName`, `liveTab`, `screenFile` | A live embed's link, its name, the tab it opens on                     |
| Snapshot      | `ScreenLive`, `SignLive`                        | Who is inside (Screen); name, status, count, since, pod, people (Sign) |
| Walk In       | `RoomWalker`, `setRoomWalker`, `useRoomWalker`  | `placePoints` and `walkThereRoute` (lib/wayfinding), leg by leg        |

## How the Screen picks a share

`ScreenLive.inside` lists who stands in its room, nearest first (`SELF_MEDIA_ID` for you). The face reads the call's
received streams (`useCallMedia`) and shows the first person in that list with a `screen` stream. It never asks for a
subscription of its own, so the call's bubble rules and caps are the only thing deciding what arrives.

## A file on the Screen

The face asks `useLiveEmbedSlot` for a place only while `ScreenLive.inside` holds `SELF_MEDIA_ID`, the Screen is not
open large, and no answer stands without a frame; `useLiveEmbedFrame` then asks a ticket with the viewer's own bearer
(`tabId` from `liveTab`) on livehuddle's address, which the router forwards (`EMBED_TICKETS_ROUTE`). The panel's size
is measured once and on resize (`ResizeObserver`), never per frame, and the frame is laid out 1280 wide and scaled.
The overlay's frame opens on the Screen's tab as it opened, so a new Show This Tab never reloads it; it hears the
frame's `<app>:ready` and `<app>:tab` for the tab it shows.

## Performance

- A file's frame is a whole app: one only for someone standing in the room, inside the page's `LIVE_EMBEDS_MAX` (3),
  released 2 s after the Screen leaves the view, and given up while the Screen is open large. The dialog's and the
  overlay's code load on demand (`lazyPanel`), fetched as a pointer comes over their openers.

- `useMeetingPieces` filters the board for pieces once per board change; with none it publishes an empty map and
  stops. With some, each presence change zones the walkers once (`zonesOfWalkers`, walkers × rooms).
- `setMeetingLive` keeps an unchanged snapshot's object and emits nothing when nothing changed, so a step inside a
  room wakes no face unless the Screen's nearest-first order or a sign's count changed.
- The sign's clock is a 30 second interval, only while In Use.
- A sign's `people` (id, name, colour, you) are compared by value in `sameLive`, so the reader and the face wake when
  someone comes or goes, never on a step inside the room. Building them is one small array per sign per presence
  change (walkers in that room).
- Walk In is published once per entering and leaving Avatar mode (`setRoomWalker`), and reads the board only when
  pressed.
