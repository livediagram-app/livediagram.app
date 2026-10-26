# Folder content previews

Status: shipped, in the shared Explorer ([`@liveworkspace/explorer`](../../../../packages/explorer/README.md))

A folder card in the Explorer's card grid previews what it directly holds: a centred 2x2 mosaic of up to four
tiles, the design snapshots first (newest first), then its subfolders' glyphs, the last tile a muted `+N` when
more are left out, and the [empty state](../004-interface-design/empty-states.md)'s art for an empty folder. The
list view keeps its count badge. It is the shared Explorer's `FolderMosaic`
(`packages/explorer/src/explorer/FolderMosaic.tsx` at the repo root), over the index's `FolderPreview`.

livedesign's part is the snapshots: each tile is the design's own preview, served by liveworkspace's previews
service from the design's tabs ([Design SVG snapshots](../006-design/design-snapshots.md),
[previews.md](../../../../liveworkspace/docs/previews.md)), so a folder tile and a design card show the same image.
