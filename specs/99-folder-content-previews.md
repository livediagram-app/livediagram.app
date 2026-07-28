# 99 — Folder content previews

Status: shipped

## What

A folder card in the Explorer's card grid (spec/67) previews what is inside
it: a small mosaic of up to four tiles — the diagram snapshots the folder
holds, plus its subfolders — instead of one generic blue folder glyph.

Every folder card looked identical before this. Diagram cards had carried a
real SVG snapshot since spec/67, so a grid mixing the two showed the diagrams
and hid the folders: the only thing distinguishing "Testing" from "Testing
Two" was the name and a count badge. The whole point of the card view over
the list view is recognition-by-sight, and folders were exempt from it.

## The mosaic

- **Up to four tiles**, laid out as a centred 2x2 (one tile centres, two sit
  side by side, three leave the last row half-filled). Each tile is a small
  white sheet — border, rounded, subtle shadow — so the group reads as
  "papers in a folder", not as one big flat preview that would be mistaken
  for a diagram card.
- Every tile is **half the preview box's width and height** whatever the
  count, so a one-diagram folder and a four-diagram folder line up across the
  grid instead of each inventing its own scale.
- **Diagrams first**, newest first (the pane's own order), then subfolders
  fill any remaining slot. Diagrams are the part you can recognise by sight;
  a subfolder can only ever contribute its glyph, so it earns a slot only
  once the informative tiles run out.
- **More than four items** turns the last tile into a muted `+N`, counting
  everything not shown. Silently truncating would make a 30-diagram folder
  look like a 4-diagram one.
- **An empty folder keeps the plain folder glyph.** There is nothing to
  preview, and the glyph is the honest answer.

Diagram tiles reuse `DiagramThumbnail` unchanged, so a folder tile is the
same cached SVG snapshot as the diagram card's — same lazy
`IntersectionObserver` fetch, same offline illustration (spec/76), same
generic glyph while loading or when a diagram has no snapshot. Nothing new
is fetched until the folder card is near the viewport, and the api worker's
R2 render cache is shared with the diagram cards, so opening a folder you
just previewed re-serves the same bytes.

## Direct children only

The mosaic previews what the folder DIRECTLY contains, matching the count
badge beside the name and what opening the folder actually shows. It does
not recurse into subfolders to find diagrams to display: a folder whose
children are all folders shows folder tiles, which is the true answer to
"what is in here". Recursing would preview things one click further away
than the card claims to describe.

## Scope: the card grid only

- The **list view** keeps its count badge. Four snapshots don't fit a 2-line
  row, and the list view exists for density.
- The **editor's floating Explorer panel** is unchanged for the same reason
  as spec/94: a ~256 px rail has no room for a mosaic.
- The **team library** grid (spec/35) gets it for free — it renders the same
  `CardView`, and its own `diagramsByFolder` / `childrenByParent` indexes
  feed the same prop.

## Where it lives

- `apps/live/app/explorer/folder-preview-tiles.ts` — the pure "which tiles,
  in what order, and how many are hidden" selection. Its own module so the
  rule is unit-tested without rendering.
- `apps/live/app/explorer/FolderPreview.tsx` — the mosaic component
  (`FolderPreview`), including the subfolder and `+N` tiles.
- `FolderCard` (`explorer-folder-cards.tsx`) takes a ready-made `preview`
  node and falls back to the folder glyph when it's absent, so it stays
  presentational and knows nothing about thumbnails.
- The contents come from the indexes the explorer already builds client-side
  (`childrenByParent`, `diagramsByFolder`) via a `folderContents` prop wired
  in `ExplorerPane.tsx` and `TeamSharedDiagrams.tsx`. No new API call and no
  per-folder fetch: the Explorer already loads every folder and diagram up
  front.
