# Poster blueprint

Implements [Poster](../poster.md).

| Part                          | Where                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape kind `poster`           | `@livehuddle/document` `shape-kind.ts`, `shape-kinds.ts`, `office.ts` (`OFFICE_KINDS`)                                                                                                                 |
| Default size 56 x 76, no lock | `shape-factory.ts` (`SHAPE_DEFAULT_SIZE`, the `poster` branch); resizable in `placed-kinds.ts`                                                                                                         |
| On a wall                     | `wall-mounted.ts` `WALL_MOUNTED`; `@livehuddle/avatar/office-geometry` `WALL_PIECE_KINDS`                                                                                                              |
| Plain frame (Edit's box)      | `office-team.ts` `POSTER_VIEW` in `OFFICE_TEAM_ART`                                                                                                                                                    |
| Picture fields                | `ShapeElement.imageId` / `credit` (`element-types.ts`, `element-fields.ts`), checked in `validate-shape.ts`                                                                                            |
| Picture helpers               | `poster.ts`: `isPoster`, `posterPicture`, `withPosterPicture`, `withoutPosterPicture`, `isPosterImageId`                                                                                               |
| Agent format                  | `@livehuddle/edit-operations` `element-format.ts` (`poster: ['imageId']`)                                                                                                                              |
| Palette tile                  | `apps/editor/components/palette/tile-defs/meeting-tiles.tsx` `tools:poster`, `PosterIcon`                                                                                                              |
| Who chooses                   | `apps/editor/lib/poster-picture.ts` `choosesPosterPicture(can, readOnly)`                                                                                                                              |
| Picker, fill and clear        | `hooks/canvas/useEditorImages.ts` (`imageContext.posterPicker`, poster branches of `applyImageToElement` / `removeImageFromElement`); `components/dialogs/EditorElementDialogs.tsx` (`currentImageId`) |
| Double click                  | `components/canvas/useBoxedElementGestures.ts`                                                                                                                                                         |
| Toolbar button                | `components/canvas/SelectionPopover.tsx` `onChoosePicture`, wired in `CanvasSelectionToolbars.tsx`                                                                                                     |
| Menu section                  | `components/palette/ElementContentSections.tsx` (Picture), `EditorContextMenu.types.ts` `onChoosePosterPicture`                                                                                        |
| 3D frame                      | `lib/real-3d/models/poster.ts` (`posterSpan`, `POSTER_EYE_Z`), hung by `scene-pieces.ts` `hungFrame`                                                                                                   |
| 3D picture place              | `MeshBuilder.picture` (four corners), laid into `PiecesMesh.posterPictures`                                                                                                                            |
| 3D picture                    | `components/canvas/real-3d/poster-pictures.ts` (quads, textures), `usePosterPictures.ts` (reader, Real3DLayer glue)                                                                                    |

## Data

- `imageId`: a gallery id (at most 128 characters, `POSTER_IMAGE_ID_MAX`) or, in Offline Mode, a `data:image/` URI, as an
  Image element's. The api's reference index already counts a `shape` element's `imageId`
  (`@liveworkspace/api-kit` `image-refs.ts`), so share reads and the sweep need no change.
- `credit`: a search pick's `ImageCredit`; replaced or dropped with each pick, dropped on Remove.

## The picker

The Image element's `ImagePicker` and `imagePickerOpenFor` state, unchanged. `useEditorImages` takes
`choosesPosterPicture` and exposes it as `imageContext.posterPicker`; the double click, the toolbar's Choose / Change
Picture and the menu's Picture section read it, and a fill or clear of a poster without it is a no-op.

## 3D

- The frame: a 2.5 px deep dark box (`0x2b2622`) as wide as the box and `height / RISE` tall as built (so as tall as
  its box once risen), its middle at `POSTER_EYE_Z` (74, a board's middle), kept between `POSTER_FLOOR_Z` (8) and
  `POSTER_TOP_Z` (128, under a wall's 152 x 1.2); a white mat inset 3 px; a pale mount in the opening with a sun of
  eight wedges and two triangle hills (`0xc3ccd8`), the empty look.
- The picture place: the opening, 0.3 px proud of the mount, recorded by `MeshBuilder.picture` and risen with the
  model; `piecesMesh` lays it on the canvas (with a Stage's lift) into `posterPictures`.
- `createPosterPictures`: one `Mesh` per poster (four corners, two triangles, uvs from `coverUvs`), a
  `MeshLambertMaterial` with the texture, polygon offset -2 so it sits on the mount. `set(entries)` after each pieces
  build: new posters made, gone ones released, a changed corner set moves the quad, a changed `imageId` drops the old
  texture and loads the new one (a ticket drops a load that lands late). `move(places)` while a drag carries posters;
  `restore(ids)` when it ends.
- Loading: `apiFetchImageBlobUrl(owner, id, { documentId, shareCode, maxEdge: 1024 })`, decoded to a canvas no larger
  than 1024 px on its longer side (`boundedSize`), a `CanvasTexture` with `NoColorSpace` (the renderer manages no
  colour), the blob URL given back once decoded. A `data:` id is decoded as it is.

## Tests

| What                                           | Where                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Defaults, wall snapping, set / replace / clear | `packages/document/src/poster.test.ts`                           |
| Hook round trip, Participant refused           | `apps/editor/hooks/canvas/useEditorImages.test.ts`               |
| Toolbar button for Editors only                | `apps/editor/components/canvas/CanvasSelectionToolbars.test.tsx` |
| Share roles                                    | `apps/editor/lib/share-roles.test.ts`                            |
| 3D frame with and without a picture            | `apps/editor/lib/real-3d/poster-3d.test.ts`                      |
| Textures: cover, bound, load once, release     | `apps/editor/components/canvas/real-3d/poster-pictures.test.ts`  |
