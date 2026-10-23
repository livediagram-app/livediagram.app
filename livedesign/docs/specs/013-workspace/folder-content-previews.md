# Folder content previews

Status: shipped, in the shared Explorer
([`@liveworkspace/explorer`](../../../../packages/explorer/README.md)).

## What

A folder card in the Explorer's card grid ([Design SVG snapshots](../006-design/design-snapshots.md)) previews what is inside
it: a small mosaic of up to four tiles — the design snapshots the folder
holds, plus its subfolders — instead of one generic blue folder glyph.

Every folder card looked identical before this. Design cards had carried a
real SVG snapshot since [Design SVG snapshots](../006-design/design-snapshots.md), so a grid mixing the two showed the designs
and hid the folders: the only thing distinguishing "Testing" from "Testing
Two" was the name and a count badge. The whole point of the card view over
the list view is recognition-by-sight, and folders were exempt from it.

## The mosaic

- **Up to four tiles**, laid out as a centred 2x2 (one tile centres, two sit
  side by side, three leave the last row half-filled). Each tile is a small
  white sheet — border, rounded, subtle shadow — so the group reads as
  "papers in a folder", not as one big flat preview that would be mistaken
  for a design card.
- Every tile is **half the preview box's width and height** whatever the
  count, so a one-design folder and a four-design folder line up across the
  grid instead of each inventing its own scale.
- **Designs first**, newest first (the pane's own order), then subfolders
  fill any remaining slot. Designs are the part you can recognise by sight;
  a subfolder can only ever contribute its glyph, so it earns a slot only
  once the informative tiles run out.
- **More than four items** turns the last tile into a muted `+N`, counting
  everything not shown. Silently truncating would make a 30-design folder
  look like a 4-design one.
- **An empty folder shows the empty state's art.** There is nothing to preview, so the card shows the folder on
  the [empty state](../004-interface-design/empty-states.md)'s floating badge over its pulsing rings and faint
  page motif, at the compact size, as the editor's Explorer shows an empty folder: the card reads as waiting
  for its first design rather than as a broken preview. The art's motion is the empty state's own, looping on the
  compositor (transform and opacity only) and still under reduced motion.

Design tiles reuse `DesignThumbnail` unchanged, so a folder tile is the
same cached SVG snapshot as the design card's — same lazy
`IntersectionObserver` fetch, same offline illustration ([Offline Mode](../006-design/offline-mode.md)), same
generic glyph while loading or when a design has no snapshot. Nothing new
is fetched until the folder card is near the viewport, and the api worker's
R2 render cache is shared with the design cards, so opening a folder you
just previewed re-serves the same bytes.

## Direct children only

The mosaic previews what the folder DIRECTLY contains, matching the count
badge beside the name and what opening the folder actually shows. It does
not recurse into subfolders to find designs to display: a folder whose
children are all folders shows folder tiles, which is the true answer to
"what is in here". Recursing would preview things one click further away
than the card claims to describe.

## Scope: the card grid only

- The **list view** keeps its count badge. Four snapshots don't fit a 2-line
  row, and the list view exists for density.
- The **editor's Explorer** is unchanged for the same reason
  as [Folder location on Recent rows](recent-folder-chip.md): a ~256 px rail has no room for a mosaic.
- The **team library** grid ([Team shared designs](team-shared-designs.md)) gets it for free — it renders the same
  `CardView`.

## Where it lives

In the shared Explorer package: the mosaic is its [`FolderMosaic`](../../../../packages/explorer/src/explorer/FolderMosaic.tsx), including the
subfolder and `+N` tiles, drawn by the folder card. What a folder holds comes from the index (its `FolderPreview`,
read by the package's `useFolderPreviews`), so nothing new is drawn: the tiles are the same snapshots the items' own
cards show.
