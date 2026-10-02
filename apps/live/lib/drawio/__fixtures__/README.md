# draw.io import fixtures

A small corpus of representative draw.io files for the draw.io importer
([spec](../../../../../docs/specs/020-import-export/drawio-import.md)).

## Provenance and licence

Every file here was written for this repository and is MIT-licensed with the rest of the codebase. The
sources are hand-written XML using the style strings draw.io's own shape libraries emit (so they read
like files saved from draw.io), but no draw.io artwork, stencil or diagram is copied. Stencil names such
as `mxgraph.aws4.lambda` are identifiers only.

## The corpus

| File                            | Kind                 | Covers                                                                                                                                                                                            |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flowchart.drawio`              | source, uncompressed | terminator, rounded box, decision, document, cylinder, data, ellipse, text, orthogonal / curved / straight edges, waypoints, edge label child, HTML bold                                          |
| `swimlanes.drawio`              | source, uncompressed | a pool of three vertical-title lanes, a horizontal swimlane, edges across lanes                                                                                                                   |
| `uml.drawio`                    | source, uncompressed | class boxes (stack layouts with rows and a separator), inheritance, composition, an ER table, crow's-foot ends, actor, frame, lifeline, note                                                      |
| `cloud-architecture.drawio`     | source, uncompressed | an AWS VPC group, AWS / Azure / Kubernetes / network icons, Cisco stencils with no match, an embedded image, a web image                                                                          |
| `multi-page.drawio`             | source, uncompressed | three pages, layers (one hidden and locked), page link, URL and script links, placeholders, tooltip, group, hidden cell, collapsed container, rich HTML, rotation, opacity, shadow, a font        |
| `routes.drawio`                 | source, uncompressed | edge routes: a fan-out trunk, a bus to six columns, floating ends on every side and perimeter, waypoints, elbow / entity-relation / segment routers, loops, curves, edges on edges, a legend edge, text sized to itself |
| `routes/*.json`                 | generated            | draw.io's own path for every edge of each source fixture, from its desktop CLI (the route port's goldens)                                                                                         |
| `flowchart.compressed.drawio`   | generated            | compressed pages (base64 + raw deflate + URI encoding)                                                                                                                                            |
| `multi-page.compressed.drawio`  | generated            | compressed, several pages                                                                                                                                                                         |
| `flowchart.mxgraphmodel.xml`    | generated            | a bare `mxGraphModel`, no `mxfile` envelope                                                                                                                                                       |
| `cloud-architecture.drawio.svg` | generated            | an SVG with the (compressed) mxfile in its `content` attribute                                                                                                                                    |
| `flowchart.drawio.png`          | generated            | a PNG with the mxfile in a `tEXt` chunk (URI-encoded)                                                                                                                                             |
| `swimlanes.drawio.png`          | generated            | a PNG with the mxfile in a `zTXt` chunk (zlib)                                                                                                                                                    |
| `no-diagram.png`                | generated            | a PNG without a diagram (the refusal path)                                                                                                                                                        |

## Regenerating

Edit a source, then rebuild the generated files (deterministic, byte-identical for the same sources):

```bash
node apps/live/lib/drawio/__fixtures__/generate.ts
```

The route goldens need draw.io desktop's CLI (an extracted AppImage) and `xvfb-run`:

```bash
pnpm --filter @livediagram/live exec tsx scripts/drawio-route-goldens.mts --drawio <path>/squashfs-root/drawio
```
