# Third-party licences: blueprint

Derived from [Third-party licences](../third-party-licences.md). Defaults applied where the spec is
silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

| File                                                                      | Role                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/licences/src/apps.ts`                                           | `LICENCE_APPS`: every app, its label, side and bundler                |
| `packages/licences/src/errors.ts`                                         | `LicencesError` and its named codes                                   |
| `packages/licences/src/analyze-data.ts`                                   | Decodes one Next `analyze.data` file into client sources and assets   |
| `packages/licences/src/metafile.ts`                                       | Decodes a wrangler (esbuild) metafile into sources                    |
| `packages/licences/src/package-path.ts`                                   | Package root, store-path version, vendored boundaries                 |
| `packages/licences/src/licence-files.ts`                                  | Licence file pattern, text normalisation, text hash                   |
| `packages/licences/src/homepage.ts`                                       | A package's https-only "Source" link                                  |
| `packages/licences/src/licence-id.ts`                                     | `license` field normalisation, text recognition, SPDX allowlist check |
| `packages/licences/src/texts.ts`                                          | `TEXT_SOURCES`: every committed text, its source URL and sha256       |
| `packages/licences/src/overrides.ts`                                      | `OVERRIDES`: texts for exact package versions that ship none          |
| `packages/licences/src/embedded-works.ts`                                 | `EMBEDDED_WORKS`: what is inside binaries and vendored source         |
| `packages/licences/src/collect.ts`                                        | One app's bundle to its works                                         |
| `packages/licences/src/manifest.ts`                                       | All apps' works to the page manifest and its deduplicated texts       |
| `packages/licences/src/contract.ts` (the package entry)                   | The manifest contract the page reads                                  |
| `packages/licences/texts/*.txt`                                           | The committed override and embedded-work texts                        |
| `packages/licences/scripts/generate.ts`                                   | IO: runs the bundlers, writes the manifest and the texts              |
| `packages/licences/src/verify-export.ts`                                  | What is wrong with an exported page, and the HTML budget              |
| `packages/licences/scripts/verify.ts`                                     | Post-build check of the exported page                                 |
| `packages/licences/scripts/log.ts`                                        | The fingerprinted log lines                                           |
| `apps/marketing/lib/licences-manifest.ts`                                 | Loads and checks `generated/licences.json` at build time              |
| `apps/marketing/app/licences/page.tsx`                                    | The `/licences` route                                                 |
| `apps/marketing/components/licences/LicencesView.tsx`                     | Server-rendered sections and entries                                  |
| `apps/marketing/components/licences/LicenceTexts.tsx`                     | Client: lazy texts in fixed-height boxes                              |
| `apps/marketing/app/licences.css`                                         | The entries' short `lic-*` classes, imported by `globals.css`         |
| `apps/marketing/app/sitemap.ts`                                           | Lists `/licences`                                                     |
| `packages/ui/src/SiteFooter.tsx`                                          | "Licences" footer link; legal strip at AA contrast                    |
| `packages/ui/src/ShareRail.tsx`                                           | Its "Share" label at AA contrast (found by the page's axe run)        |
| `apps/live/components/panels/ExplorerHeaderMenu.tsx`                      | "Licences" row beside GitHub                                          |
| `apps/live/components/chrome/tab-bar-icons.tsx`                           | `ScaleIcon` (vendored Lucide `scale`, at `MENU_ICON_PX`)              |
| `packages/icons/lucide-manifest.json`                                     | Gains `scale`                                                         |
| `turbo.json`, `apps/marketing/package.json`, `package.json`, `.gitignore` | Build wiring                                                          |

## Domain and naming

| Term          | Identifier                                           | Meaning                                                                                                       |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| App           | `LicenceApp`, `AppId`                                | One deployed app: `live`, `marketing`, `help`, `telemetry`, `community`, `api`, `mcp`, `router`               |
| Side          | `Side` = `'browser' \| 'server'`                     | Where an app's bundle runs                                                                                    |
| Bundle        | `AppBundle`                                          | One app's shipped `sources` (repo-relative paths) and `assets` (emitted file basenames)                       |
| Work          | `WorkRecord` (collect), `WorkEntry` (manifest)       | Third-party material with its own licence                                                                     |
| Work kind     | `WorkKind` = `'package' \| 'vendored' \| 'embedded'` | npm package, vendored inside a package, inside a binary or our source                                         |
| Carrier       | `carrier`                                            | What holds a vendored or embedded work (`next 16.3.6`, `@tensorflow/tfjs-backend-wasm`, `livediagram source`) |
| Licence text  | `LicenceText` `{ label, text }`                      | One licence or notice file's normalised content                                                               |
| Text hash     | `hash`                                               | First 16 hex of the sha256 of a normalised text; its file name                                                |
| Override      | `Override`                                           | Committed texts for one exact package version                                                                 |
| Embedded work | `EmbeddedWork`                                       | A reviewed table entry for material the bundler cannot see                                                    |
| Binary asset  | (a basename)                                         | Emitted file with an extension in `BINARY_ASSET_EXTENSIONS`                                                   |
| Manifest      | `LicencesManifest`                                   | What the page renders                                                                                         |

Banned: "licence" and "license" as synonyms of each other in identifiers; the code spells the
British `licence` everywhere except the npm `license` field and file names.

## Behaviour and state

The generator is a pure pipeline around two IO edges:

1. **Bundle** (IO, `generate.ts`). Turbo runs the marketing build after all seven other apps' builds
   (`turbo.json`): the analyzer reads and writes `<app>/.next/cache/turbopack` and
   `<app>/.next/diagnostics` whatever `NEXT_DISTDIR` says, and beside that app's `next build` the
   Turbopack persistent cache panics. For each app in `LICENCE_APPS` order, sequentially (D11):
   - `next` apps: remove `<app>/.next-analyze`, run `node <next bin> experimental-analyze -o` in the
     app directory with `NEXT_DISTDIR=.next-analyze`, then read every file named `analyze.data`
     under `<app>/.next-analyze/diagnostics/analyze/data/`. None found: `AnalyzeDataMissing`.
   - `worker` apps: `node <wrangler bin> deploy --dry-run --outdir <tmp>/<app> --metafile
<tmp>/<app>/meta.json` in the app directory; the assets are the outdir's files.
   - A non-zero exit: `BundlerFailed`, with the tail of its output.
2. **Decode** (pure). `decodeAnalyzeData(bytes)` and `decodeMetafile(json, appDir)` give repo-relative
   source paths and emitted asset basenames; the union over an app's files is its `AppBundle`.
3. **Collect** (pure over a `FileReader`). `collectWorks(bundle, reader)`:
   - Each source path with a `node_modules/` segment belongs to the package at its last
     `node_modules/<name>` (scoped names take two segments). The package root's `package.json` must
     hold a string `name` equal to that directory name and a string `version`
     (`PackageManifestInvalid`).
   - The path's `.pnpm/<store key>/node_modules/<name>` segment is required
     (`StorePathUnrecognised`); the store key is `<name with / as +>@<version>` optionally followed by
     `_<peers>`. A version that differs from `package.json`'s is `VersionMismatch`.
   - Directories strictly between the root and the file that hold a `package.json` with a string
     `name` and at least one licence file are **vendored works** (name: the directory's basename, with
     its `@scope` parent when there is one (D5); version: the nested `version`, else `bundled in
<parent> <version>` (D6)).
   - Source paths without `node_modules/` are first-party and are only matched against embedded-work
     source triggers.
   - Each binary asset must match at least one embedded work's `assets` pattern
     (`UnreviewedBinaryAsset`). Each matched or source-triggered entry becomes an embedded work.
   - Texts, in order: the work's licence files (sorted by name), else the override for exactly
     `name@version`, else `LicenceTextMissing`. An embedded work's texts come from its table entry: a
     committed file, or a file inside a package that this bundle ships
     (`EmbeddedPackageNotShipped`).
   - Licence id: see "Interfaces and contracts"; then `isLicenceAllowed`, else `LicenceNotAllowed`.
4. **Assemble** (pure). `buildManifest(collected)` groups works by side, merges the same work's apps,
   deduplicates texts by hash, sorts, and reports unused overrides and embedded works.
5. **Write** (IO). Removes and rewrites `<out>/public/licences/texts/`, writes one `<hash>.txt` per
   text and `<out>/generated/licences.json`.

Invariants: every hash a `WorkEntry` names has a written text; every work has at least one text;
every app appears in exactly one section; output is byte-identical for identical inputs.

## Interfaces and contracts

```ts
export type Side = 'browser' | 'server';
export type AppId =
  'live' | 'marketing' | 'help' | 'telemetry' | 'community' | 'api' | 'mcp' | 'router';
export type LicenceApp = { id: AppId; label: string; side: Side; bundler: 'next' | 'worker' };

export type AppBundle = { app: AppId; sources: string[]; assets: string[] };

// undefined for no such file, [] for no such directory.
export type FileReader = {
  readText(path: string): string | undefined;
  listFiles(dir: string): string[];
};

export type TextRef =
  | { label: string; file: string } // packages/licences/texts/<file>, listed in TEXT_SOURCES
  | { label: string; package: string; path: string }; // a file inside a shipped package

export type Override = { package: string; version: string; licence?: string; texts: TextRef[] };

export type EmbeddedWork = {
  id: string;
  name: string;
  version: string;
  licence: string;
  carrier: string;
  homepage: string;
  trigger: { assets: RegExp } | { sources: string[] };
  texts: TextRef[];
};

export type WorkEntry = {
  anchor: string; // `${side}-${slug(name)}-${slug(version)}`
  kind: 'package' | 'vendored' | 'embedded';
  name: string;
  version: string;
  licence: string;
  carrier?: string;
  homepage?: string; // https only (D8)
  apps: AppId[]; // LICENCE_APPS order
  texts: { label: string; hash: string }[];
};

export type LicencesManifest = {
  schemaVersion: 1;
  sections: { side: Side; apps: { id: AppId; label: string }[]; works: WorkEntry[] }[];
  texts: Record<string, { lines: number; bytes: number }>;
};
```

- **`analyze.data`**: a 4-byte big-endian length `n`, then `n` bytes of UTF-8 JSON, then binary
  data the generator ignores. The JSON must hold arrays `sources` (`{ path: string,
parent_source_index?: number | null }`, the tree root carrying `null`), `chunk_parts` (`{ source_index: number, output_file_index:
number }`) and `output_files` (`{ filename: string }`); a source's full path is its parents' paths
  concatenated. Client output files are those whose `filename` starts with `[client-fs]/`. A
  client source path starting `[project]/` is repo-relative after the prefix; other prefixes
  (`[turbopack]/…`) are bundler runtime and skipped. Any other shape, an out-of-range index or a
  length past the end: `AnalyzeFormatUnrecognised`.
- **Metafile**: JSON with an object `inputs`; its keys are paths relative to the app directory.
  Otherwise `MetafileFormatUnrecognised`.
- **Licence file pattern**:
  `/^(licen[cs]e|copying|notice|copyright|third[-_ ]?party[-_ ]?notices)([-_. ].*)?$/i`, regular
  files only.
- **Normalised text**: BOM removed, `\r\n` and `\r` to `\n`, trailing whitespace of the whole text
  trimmed, one final `\n`. An empty result counts as no text.
- **Licence id**: `license` string (an `SEE LICEN[CS]E IN …` value is treated as absent); legacy
  `license: { type }` gives `type`; legacy `licenses: [{ type }]` gives the types joined by `OR`,
  parenthesised when more than one; an override's `licence` wins over all of these. Absent: the
  first text is recognised by `detectLicenceId` (whitespace collapsed, exactly one of MIT, ISC,
  BSD-2-Clause, BSD-3-Clause, Apache-2.0 must match), else `LicenceIdUnknown`.
- **Allowlist** (`LICENCE_ALLOWLIST`, D10): `0BSD`, `Apache-2.0`, `BlueOak-1.0.0`, `BSD-2-Clause`,
  `BSD-3-Clause`, `BSL-1.0`, `CC-BY-4.0`, `CC0-1.0`, `ISC`, `MIT`, `MIT-0`, `MPL-2.0`, `OFL-1.1`,
  `Python-2.0`, `Unlicense`, `Zlib`. The expression is parsed (`AND` binds tighter than `OR`,
  parentheses, `WITH <exception>` keeps the base id); `OR` needs one allowed branch, `AND` needs
  all. `UNLICENSED`, an unknown id or an unparsable expression: `LicenceNotAllowed`.

## Data and persistence

Nothing persists outside the build. Generated, gitignored and rebuilt every marketing build:
`apps/marketing/generated/licences.json`, `apps/marketing/public/licences/texts/*.txt` and each Next
app's `.next-analyze/`. Committed: `packages/licences/texts/*.txt`, each listed in `TEXT_SOURCES`
with its upstream URL pinned to a tag or commit and its sha256. No schema migration: the manifest
carries `schemaVersion: 1`, and the page refuses any other (`LicencesManifestInvalid`).

## Errors and edge cases

| Code                         | When                                                         | Handling                              |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `BundlerFailed`              | analyzer or wrangler exits non-zero                          | build fails, output tail logged       |
| `AnalyzeDataMissing`         | no `analyze.data` after a successful run                     | build fails                           |
| `AnalyzeFormatUnrecognised`  | header, JSON shape or indices off                            | build fails                           |
| `MetafileFormatUnrecognised` | no `inputs` object                                           | build fails                           |
| `PackageManifestInvalid`     | root `package.json` missing, unreadable, or name/version off | build fails                           |
| `StorePathUnrecognised`      | package not under `.pnpm/<name>@<version>…`                  | build fails                           |
| `VersionMismatch`            | store-path version differs from `package.json`               | build fails                           |
| `LicenceTextMissing`         | no licence file and no override for `name@version`           | build fails; add an override          |
| `LicenceIdUnknown`           | no usable `license` field, text unrecognised                 | build fails; add an override licence  |
| `LicenceNotAllowed`          | id outside the allowlist                                     | build fails; a human decides          |
| `UnreviewedBinaryAsset`      | a `.wasm` or font no embedded work matches                   | build fails; add a table entry        |
| `EmbeddedPackageNotShipped`  | an embedded text names a package this bundle does not ship   | build fails                           |
| `TextSourceIntegrity`        | committed text missing, unlisted, or sha256 differs          | build and tests fail                  |
| `LicencesManifestMissing`    | the page builds with no manifest (e.g. bare `next dev`)      | page build fails: run `pnpm licences` |
| `LicencesManifestInvalid`    | manifest `schemaVersion` is not 1                            | page build fails                      |
| `LicencesVerifyFailed`       | exported page or a text missing, or HTML over budget         | marketing build fails                 |

Edge cases: a package shipped in two versions yields two works; the same text across works is one
file; a work in both sides appears in both sections; a vendored boundary without a licence file is
covered by its parent and not listed; unused overrides and embedded works are logged
(`licences.table.unused`) and not fatal (spec); a text fetch failing in the browser shows the error
copy in the same box.

## Security and trust

- Inputs are our own dependency tree and bundler output; the generator runs with the build's
  privileges, spawns only the pinned `next` and `wrangler` binaries resolved from the workspace, and
  makes no network request.
- Texts reach the page only as text: served as static `.txt`, rendered as React text nodes inside
  `<pre>`, never as HTML. Homepages are emitted only when they parse as `https:` URLs (D8), and render
  with `rel="noopener noreferrer"`.
- The page and texts are static assets on the marketing worker: no server work, no cost per view.

## Performance and limits

- Measured in a full `pnpm build`: live 7.9 s, help 6.1 s, telemetry 3.0 s, marketing 2.5 s, each
  worker about 1 s; about 22 s on the marketing build only, which now starts once the editor's
  build finishes (the full build took 59 s).
- HTML carries summaries only; texts load on open. The largest text, ONNX Runtime's third-party
  notices, is 327 KB (about 80 KB compressed) and is fetched only when its entry opens.
- Page weight measured: 173.8 KB raw, 20.3 KB gzipped for 54 works. A static export ships the
  server-rendered entries twice (HTML and RSC payload), so repeated chrome is short `lic-*`
  classes (per-element utilities made it 353 KB) and no per-entry SVG (D16).
- Budget: `LICENCES_HTML_BUDGET_BYTES` (D14) on the exported `licences.html`, checked by `verify.ts`.

## Presentation and UX

Route `/licences`, the shared `SiteHeader` without a funnel surface (D15) and marketing's `Footer`,
content column `max-w-3xl`.

- Title (h1): "Open-source licences".
- Lead: "livediagram is MIT licensed and built on the work of many open-source projects. These are
  the ones our apps ship, generated from what each app actually bundles every time the site is
  built."
- Section h2 "In your browser", intro: "Sent to your browser by the editor, this website, the help
  centre, the Community and the telemetry dashboard." Section h2 "On our servers", intro: "Bundled into the API,
  MCP server and router, which run on Cloudflare rather than on your device."
- Each section shows its work count: "{n} works".
- Entry summary: the native disclosure marker (D16), name (medium weight), version, then a row of
  licence id (monospace) and app chips ("Editor", "Website", "Help centre", "Telemetry", "Community", "API",
  "MCP server", "Router") after a visually hidden "Ships in". A hanging indent keeps a wrapped name,
  version or chip row aligned past the marker.
- Entry body: for a vendored or embedded work "Inside {carrier}."; for a homepage, a "Source" link;
  then per text: its label as a heading-sized line, a "Plain text" link, and the text box.
- Text box states: loading "Loading {label}…", loaded (the text), error "This text could not be
  loaded. Open the plain-text file instead." All three in the same fixed-height box.
- Empty section (no works): "Nothing third-party ships here." (not reachable today, rendered anyway).

## Accessibility

- `details`/`summary` native keyboard (Enter, Space) and state announcement; the summary holds an
  `h3` with the name; a `focus-visible` ring (`ring-2 ring-brand-500`) on the summary.
- Links name what they open: `aria-label` "Source of {name}" and "Plain text of {label} for {name}",
  each starting with its visible text (2.5.3), and at least 24 px tall (2.5.8).
- Each text box is a `<pre tabIndex={0} role="region" aria-label="{label} for {name}">` with
  `aria-busy` while loading, so keyboard users can scroll it (WCAG 2.1.1).
- Chips and meta text use slate 600 or 700 on white and slate 200 or 300 on slate 900 (all over
  4.5:1). Nothing moves: the native marker swaps without animation.
- axe (`wcag2a` to `wcag22aa`) with an entry open: no violations in dark; in light only the
  sitewide brand-500 wordmark and primary button, which stay as they are by operator decision
  (the wordmark is a logotype).

## Web Experience

- LCP: the h1 and lead, server-rendered, no web font or image dependency.
- CLS: zero. A text box's height is `min(lines, TEXT_BOX_MAX_LINES) × TEXT_BOX_LINE_HEIGHT_REM rem`
  plus its padding, from the manifest's line count, before any fetch; the summary never moves; no
  `margin-top`/`padding-top` on `details[open]`.
- INP: opening an entry is native; the fetch starts in a `toggle` listener and does no layout work
  beyond setting text.
- Measured with texts delayed 800 ms: a box is 446 px loading and loaded, the next entry moves
  0 px, the 327 KB notices scroll inside a fixed 506 px box, and CLS is 0 (the only shifts are the
  user's own opens, which CLS excludes).

## Observability

Every line is `[licences] <fingerprint> key=value …` on stdout (errors on stderr):
`licences.bundle.start app=`, `licences.bundle.done app= ms= sources= assets=`,
`licences.app.works app= packages= vendored= embedded=`, `licences.table.unused kind= id=`,
`licences.manifest.written works= texts= bytes= path=`, `licences.error code= message=`,
`licences.verify.ok html_bytes= texts=`, `licences.verify.failed reason=`.

## Testing

| Spec rule                                                      | Test                                              |
| -------------------------------------------------------------- | ------------------------------------------------- |
| Every app is registered, sides right                           | `apps.test.ts` (reads `apps/*`)                   |
| Client output only; strict analyze format                      | `analyze-data.test.ts`                            |
| Worker bundles from the metafile; strict format                | `metafile.test.ts`                                |
| Package root, store-path version, vendored boundaries          | `package-path.test.ts`                            |
| Licence files incl. NOTICE; normalisation; hash                | `licence-files.test.ts`                           |
| Licence id rules and allowlist                                 | `licence-id.test.ts`                              |
| Missing text fails; override applies to exact version only     | `collect.test.ts`                                 |
| Unreviewed binary fails; embedded works by asset and source    | `collect.test.ts`                                 |
| Committed texts listed and intact; tables reference real files | `texts.test.ts`                                   |
| Sections, merged apps, dedup, order, unused report             | `manifest.test.ts`                                |
| Runs for real on the real apps                                 | CI build job (`pnpm build`)                       |
| Exported page, texts and HTML budget                           | `verify-export.test.ts`; `verify.ts` in the build |
| Source links https only                                        | `homepage.test.ts`                                |
| Named error codes                                              | `errors.test.ts`                                  |
| Page renders sections, entries, links; fixed box heights       | `apps/marketing/components/licences/*.test.tsx`   |
| Manifest missing or invalid fails the page                     | `apps/marketing/lib/licences-manifest.test.ts`    |
| Footer link; AA small print                                    | `packages/ui/src/SiteFooter.test.tsx`             |
| Share rail label at AA                                         | `packages/ui/src/ShareRail.test.tsx`              |
| Sitemap lists `/licences`                                      | `apps/marketing/app/sitemap.test.ts`              |
| Explorer ⋯ row opens `/licences` in a new tab                  | `ExplorerHeaderMenu.test.tsx`                     |
| `/licences` and its texts reach marketing                      | `apps/router/src/index.test.ts`                   |

## Constants and configuration

| Constant                     | Value                                 | Provenance                                      | Safe range          |
| ---------------------------- | ------------------------------------- | ----------------------------------------------- | ------------------- |
| `BINARY_ASSET_EXTENSIONS`    | `wasm`, `ttf`, `otf`, `woff`, `woff2` | Spec: binaries the bundler cannot see into      | add, never remove   |
| `NEXT_ANALYZE_DISTDIR`       | `.next-analyze`                       | Keeps the analysis off `.next` and `.next-dev`  | any ignored dir     |
| `TEXT_HASH_LENGTH`           | 16 hex                                | D3: 64 bits, no collision at thousands of texts | 12 to 64            |
| `TEXTS_URL_PREFIX`           | `/licences/texts/`                    | Under the page's own path on marketing          | fixed               |
| `TEXT_BOX_MAX_LINES`         | 24                                    | D1: a licence's opening fits; long ones scroll  | 12 to 40            |
| `TEXT_BOX_LINE_HEIGHT_REM`   | 1.25                                  | D2: Tailwind `text-xs leading-5`                | tied to the class   |
| `LICENCES_HTML_BUDGET_BYTES` | 260,000                               | D14: 1.5 times the 173.5 KB first measured      | measured × 1.3 to 2 |

## Assets and external resources

Every committed text in `packages/licences/texts/` is listed in `TEXT_SOURCES` with its upstream
URL, pinned to the tag or commit the shipped build came from, and its sha256; `texts.test.ts` keeps
the list, the files and the checksums in step. Regenerating one means fetching the same URL.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md), rows D1 to D16.
