# 41 — Technology icons

A **Technology** category in the palette: full-colour brand icons for the
infrastructure services people put on system-architecture diagrams (AWS S3,
Lambda, EC2, Azure Functions, Kubernetes, Postgres, ...). They sit beside the
existing **Icons** category but are deliberately a separate surface, because
they are coloured filled marks rather than the single-weight, stroke-tinted line
art the Icons catalogue holds. Mixing them would break the consistent line-art
look of that catalogue.

## Why a separate category, not more entries in Icons

The Icons catalogue (`apps/live/lib/icons.ts`, spec/09) is Feather/Lucide-style:
each glyph is a set of stroke primitives in a 0..24 box, drawn `fill="none"` and
**tinted by the element's stroke colour** so it themes like a line drawing.
Brand service icons are the opposite: fixed multi-colour fills that must NOT be
recoloured (an orange Lambda is only recognisable orange). They need their own
model (raw coloured SVG markup, not stroke prims) and their own render path
(no stroke tint), so they live in their own catalogue and palette tab.

## The element — reuses the `icon` shape kind

A Technology icon is the **same `shape: 'icon'` element** the Icons category
produces — no new element type, no schema migration. `element.iconId` keys the
icon; the only difference is the id resolves in the **tech-icon registry**
instead of the line-art catalogue. The shared `createShape('icon', …)` already
gives icons the two properties this feature needs:

- `aspectLocked` — Technology icons drop **unlocked**: the mark renders at a
  fixed pixel size (see Rendering below), so warping the box can't warp the
  mark, and the lock would only fight resizing the caption room. (Line-art
  icons keep `createShape('icon')`'s `aspectLocked: true` — their glyph
  scales with the box.)
- `textAlignY: 'bottom'` — the label sits in a band **below** the glyph, the
  architecture-diagram convention (icon on top, caption beneath). This is why
  double-clicking a Technology icon to type drops the text under it, which is
  exactly the desired behaviour for labelling `S3`, `Orders DB`, etc.

`getIcon` (line-art) falls back to a placeholder for an unknown id, so the
render path **dispatches on the id**: `isTechIconId(iconId)` picks the coloured
brand renderer, otherwise the stroke-tinted line renderer.

## The catalogue — `apps/live/lib/tech-icons.ts`

```ts
type TechIconDef = {
  id: string; // e.g. 'aws-s3', 'azure-functions', 'k8s'
  label: string; // 'S3', 'Azure Functions', 'Kubernetes'
  short?: string; // short palette caption where `label` would truncate ('VM')
  provider: TechProvider; // 'aws' | 'azure' | 'generic'
  keywords: string; // extra search terms
  color: string; // tile fill — the service / brand colour
  glyph: string; // inner SVG markup (0..24 box) drawn white on the tile
};
```

- `iconId` stays a plain string in the data model (as today), so adding an icon
  needs no migration. An id present in neither catalogue renders the existing
  placeholder.
- **The heavy data loads async.** `tech-icons.ts` is the synchronous API
  surface only (types, `TECH_ICON_DND_MIME`, `TECH_PROVIDERS`, `isTechIconId`);
  the per-icon colour + glyph markup lives in
  `packages/icons/src/tech-icon-catalog.ts` (the shared `@livediagram/icons`
  package) and is dynamic-imported (together with the line-art catalogue) by
  `apps/live/lib/icon-registry.ts`, keeping ~25 kB of source out of the
  editor's first-load JS (see spec/09 "Catalogue loading"). `isTechIconId` —
  which gates hot paths that can't wait for the chunk (the coloured-vs-line-art
  render dispatch, the drag fold-into-shape exclusion, telemetry typing) —
  answers from a lightweight first-load id set, `TECH_ICON_IDS`; tech ids share
  no common prefix (`aws-*` but also bare `k8s` / `docker`), so exact
  membership needs the set. Adding an icon is therefore a **two-line change**
  (the `TechIconDef` entry plus its id in the set), and a parity test pins the
  two together so they can't drift. Before the chunk lands, a known tech id
  renders a **muted skeleton tile** in the mark's rounded-square silhouette
  (never a blank, and nothing jumps when the brand colours arrive); the
  Technology picker shows a brief "Loading icons…" note.
- The mark is a **brand-coloured rounded tile + a white line-art glyph** — the
  AWS resource-icon visual language, applied uniformly across AWS / Azure /
  generic for a cohesive palette, using each service's **official brand /
  category colour**. It is authored in-repo as compact SVG, not the verbatim
  vendor asset packs — keeps the bundle small, renders crisply at icon size, and
  sidesteps redistributing proprietary SVGs from a public MIT repo (see spec/03,
  spec/06). Swapping in a vendor's official SVG later is a per-id edit.

### v1 coverage (curated common set, ~38)

- **AWS:** S3, EC2, Lambda, RDS, DynamoDB, API Gateway, CloudFront, Route 53,
  VPC, SQS, SNS, ECS, EKS, CloudWatch, IAM.
- **Azure:** Virtual Machines, Blob Storage, App Service, Functions, SQL
  Database, Cosmos DB, AKS, Virtual Network, Load Balancer, Service Bus, Key
  Vault, Monitor.
- **Generic infra:** Kubernetes, Docker, PostgreSQL, MySQL, Redis, MongoDB,
  Kafka, Nginx, RabbitMQ, Elasticsearch, GraphQL.

The set is intentionally the services people reach for first; it expands by
adding `TechIconDef` entries.

## Palette — the Technology tab

A new tab in `PaletteTabBar` (`CommandPalette.tsx`), alongside Shapes / Tools /
Devices / Icons. It mirrors the Icons tab: a search box plus a **provider**
filter dropdown (All / AWS / Azure / Generic). Clicking a tile adds the icon at
the viewport centre; dragging a tile onto the canvas drops it at the pointer.

Unlike the line-art Icons grid (5 across, no captions — a labelled line icon's
shape reads on its own), the Technology grid is **4 across with a caption under
each tile**: the brand glyphs aren't self-explanatory at thumbnail size, so the
name sits beneath each one. A handful of long names carry a `short` caption
(`Virtual Machine` → `VM`, `Virtual Network` → `VNet`, `Load Balancer` →
`Load Bal.`, `Blob Storage` → `Blob`, `SQL Database` → `SQL DB`, `Elasticsearch`
→ `Elastic`) so they don't truncate to an ambiguous prefix; the full `label` is
still used for search, the aria-label, and the on-canvas element.

Unlike the Icons tab, a Technology tile is **always a standalone element** — it
never drops _inside_ a selected shape as an inline icon (a coloured brand tile
beside a shape's text is not meaningful, and the inline-icon renderer only knows
line-art prims). It therefore carries its own DnD MIME (`TECH_ICON_DND_MIME`),
which the canvas drop handler routes to a standalone-icon create and which the
shape drop target ignores. The same rule holds _after_ placement: dragging an
existing standalone tech icon over a shape leaves it standalone — the
icon-fold-into-shape gesture (`useEditorDrag`, which absorbs a dragged line-art
`icon` shape into the shape beneath it) excludes tech icons via `isTechIconId`.

## Rendering — `apps/live/components/primitives/tech-icon-glyph.tsx`

`TechIconGlyph` paints the brand-coloured tile + the icon's white `glyph` markup
inside an `<svg>`. No stroke tint is applied; the brand colour is the tile fill
and the glyph is white.

**The mark renders at a fixed pixel size, not scaled to the element box.**
Resizing a Technology icon element gives the caption more room / adds
whitespace around the mark, but the tile itself stays the same size — an
architecture diagram's brand marks read as a uniform set of chips, not blobs
that grow with their boxes. The size comes from an optional `iconSize` preset
on the element (`IconSize = 'sm' | 'md' | 'lg' | 'xl'` → 32 / 48 / 64 / 96 px,
`ICON_SIZE_PX` in `packages/diagram/src/icon-size.ts`), defaulting to `md`
(48 px); the tile clamps to the element box when the box is smaller than the
preset. Layout: with a label the mark centres inside the top band (the top
~64% of the box, matching the old banded geometry) and the caption keeps its
bottom band; without a label the mark centres in the whole box. Line-art
icons are unaffected — they are drawings that keep scaling with their box.
The exports / headless renders (`svgIconShape` in the shared renderer) apply
the same fixed-size geometry so a resized mark exports exactly as drawn.

**Icon size presets in the context menu.** A Technology icon element's
right-click menu gains an **Icon** category (single-element menu only, like
the other type-specific categories): a 4-tile grid of size presets rendered
as icon buttons — a rounded-square chip glyph at graduated sizes with a
Small / Medium / Large / Huge caption under each (the `MenuTile` icon-over-
label convention), the active preset highlighted. Picking one writes
`iconSize` selection-wide (history-aware, `track('Element', 'Changed',
'IconSize')`).

**Exports and headless renders draw the same art.** The shared SVG renderer
(`packages/diagram/src/svg-render.ts`) takes an injected `resolveIconArt`
resolver; with it, a `shape: 'icon'` element exports its real glyph — a
Technology mark as its self-coloured tile, a line-art icon stroke-tinted, each
with the caption in the bottom band — instead of the old box-with-caption
fallback (which remains the output for an unknown id or a resolver-less
caller). The in-app SVG / PNG / PDF export resolves from the loaded icon
registry (`resolveIconArtLoaded`, awaited via `ensureIconCatalogs` in the
Export dialog); the api worker's live image / Explorer thumbnail and the MCP
worker's inline render resolve via `@livediagram/icons/resolve` (a static
import of the catalogue data).

## Templates that seed brand tiles

The **System architecture** starter (spec/09 "Templates",
`buildSystemArchitecture` in `apps/live/lib/template-builders-technical.ts`) is
the first catalogue consumer: it drops the gateway / service / datastore nodes
as branded tiles (`nginx`, `docker`, `k8s`, `postgres`, `redis` from the
vendor-neutral Generic set) so a developer audience lands on a diagram that
already speaks their stack. The starter flows through the same theme pipeline as
every other template, but the brand tiles are immune by construction: the
renderer paints from the catalogue colour and ignores the element's fill /
stroke entirely, so a theme change can't touch them. The lone non-branded node
is the `globe` client glyph, which stays stroke-tinted and adopts the theme.

## Telemetry

Adding a Technology icon fires `track('Element', 'Added', 'TechIcon')` — a
distinct `type` from line-art icons (`'Icon'`) so the dashboard can tell
architecture-icon usage apart, while reusing the closed `Element` / `Added`
category/action pair (spec/22). The `type` is the constant `'TechIcon'`, never
the specific service id, keeping telemetry free of content.

## Out of scope (v1)

- GCP (the provider model already allows adding it later).
- Recolouring brand icons (they keep their fixed brand colours).
- Verbatim vendor asset packs / a downloadable icon-pack importer.
