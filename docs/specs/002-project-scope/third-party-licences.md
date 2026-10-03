# Third-party licences

livediagram is MIT, and every app it deploys carries other people's open-source work. The licences
of that work (MIT, BSD, ISC, Apache-2.0 and the rest) ask for their copyright and licence text to
travel with every copy, and our production bundles strip the comments that would otherwise carry
them. So livediagram publishes one **licences page**, generated at build time from what each app
actually ships, and links it from every public footer and from the editor.

## What counts as shipped

A **work** is a piece of third-party material with its own licence: an npm package, a work vendored
inside a package, or a work compiled into a binary asset. The page lists exactly the works that
reach a deployed artefact, and nothing else.

- **Bundle truth.** What ships is read from the bundler, not inferred from `package.json`. The
  static apps (live, marketing, help, telemetry) are analysed with Next's `experimental-analyze`
  (Turbopack), and only the modules it places in client output count: a static export has no server
  at runtime, so server chunks never leave the build. The workers (api, mcp, router) are bundled
  with `wrangler deploy --dry-run --metafile`, and every module in the metafile counts.
- **Why not the lockfile closure.** The production closure of a Next app lists its build machinery
  (sharp and its LGPL libvips, Playwright, `onnxruntime-node`, the MDX toolchain) as if it shipped.
  Publishing that would claim obligations we do not have and bury the ones we do.
- **Versions.** A work's version is its installed `package.json` version, cross-checked against the
  pnpm store path it was bundled from; the store path is the lockfile's resolution, so the page
  always names the locked version.
- **First-party code is not listed.** The `@livediagram/*` workspaces are this repo, under its MIT
  licence.
- **Vendored works.** A directory inside a package that carries its own `package.json` name and its
  own licence file is a separate work. Next vendors React, React DOM, the scheduler and a few
  polyfills this way; each is listed by its directory name, "bundled in next".
- **Embedded works.** A bundler sees JavaScript, not what is compiled into a WebAssembly binary or
  a font. Every emitted binary asset (`.wasm`, `.ttf`, `.otf`, `.woff`, `.woff2`) must match at least
  one entry of the reviewed **embedded-works table**, which names the libraries inside it with their
  own licence texts: XNNPACK and its helpers plus the Emscripten runtime inside the TensorFlow.js
  WASM backend, ONNX Runtime's third-party notices inside its WASM, libwebp inside `@jsquash/webp`,
  resvg and tiny-skia inside `@resvg/resvg-wasm`, and the Inter font inside the mcp worker. The same
  table covers material vendored into our own source (Lucide and Feather icon geometry, draw.io's
  view geometry ported into the draw.io importer), triggered by the first-party source file that
  carries it being bundled.

## Licence texts

- A work's texts are its licence files: the files at its root named `LICENSE`, `LICENCE`,
  `COPYING`, `NOTICE`, `COPYRIGHT` or `ThirdPartyNotices` (any case, any extension or suffix). Every
  one of them is published, so an Apache-2.0 package's `NOTICE` travels with its licence.
- **A work with no licence text fails the build**, naming the package and version. The fix is never
  to omit it: an **override** supplies the upstream text, committed to the repo with its source URL
  (pinned to a tag or commit) and a checksum, keyed to the exact package version so an upgrade asks
  for review again. Today nine packages need one: five TensorFlow.js packages, two ONNX Runtime
  packages, seedrandom and `@resvg/resvg-wasm`.
- **Licence id.** The `license` field of the work's `package.json`, as an SPDX expression. When it is
  absent, the id is recognised from the text (MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0);
  text that is not recognised fails the build.
- **Allowed licences.** A shipped work's licence id must be in the reviewed allowlist of permissive
  and weak-copyleft licences. An `UNLICENSED` package, a strong copyleft licence or anything new
  fails the build, so adding one is a decision somebody makes, not something a dependency bump does.
- A table entry (override or embedded work) that matches nothing in a build is reported, not fatal:
  an entry may land ahead of the dependency it serves (libwebp's entry precedes PR #176's encoder).

## The page

- **One page, at `/licences`,** served by marketing (which already answers every path no other app
  claims). One page rather than one per app: most works ship in several apps, the router serves them
  all under one origin, and a visitor looking for "what is in livediagram" should not need to know
  the app boundaries. Each entry names the apps that ship it.
- **Two sections.** "In your browser" lists the works sent to people's browsers by the editor, the
  website, the help centre and the telemetry dashboard. "On our servers" lists the works bundled
  into the api, MCP and router workers; they run on Cloudflare, not on anyone's device, and are
  listed in full all the same. A work shipped on both sides appears in both, with each side's apps.
- **Entries are collapsed.** Each is a native disclosure showing the name, version, licence id and
  apps; opening it loads its texts. A vendored or embedded work also says what carries it. The
  disclosure marker is the platform's own, so no chevron is drawn once per entry.
- **Texts load lazily** from static plain-text files deduplicated by content (dozens of packages
  share an identical Apache-2.0 text), so the page's HTML holds no licence text at all. The page
  weighs about 174 KB (20 KB compressed) for 54 works, half the landing page; a static export ships
  each entry twice (HTML and its React payload), so the entries use short classes and a build-time
  budget keeps texts from ever being inlined. Every text
  also has a direct "Plain text" link, which works without JavaScript.
- **Zero layout shift.** A text's box has a fixed height computed at build time from its line count
  (capped, then it scrolls), so loading, failing or finishing never moves anything. The summary row
  never moves when an entry opens.
- **Accessible.** WCAG 2.2 AA: native `details`/`summary` for keyboard and screen readers, a visible
  focus ring, each scrollable text box focusable and labelled, AA contrast in light and dark.
- **Links.** The shared site footer (marketing, help centre, telemetry) links "Licences". In the
  editor, the Explorer panel's ⋯ menu has a "Licences" row beside GitHub, opening the page in a new
  tab like GitHub does.

## Keeping it current

- The page is regenerated on every marketing build, locally, in CI and in the deploy workflow alike,
  from a clean analysis each time. Nothing generated is committed.
- The marketing build runs after every other app's build. Next's analyzer uses an app's Turbopack
  build cache whatever output directory it is given, and beside that app's own build the two
  processes corrupt it, so the two never run at once.
- The generator's logic is unit-tested with synthetic analyzer and metafile data; the CI build runs
  it for real, so a Next or wrangler change that breaks the analysis fails CI with a named error.
- A post-build check fails the marketing build if the page, any referenced text or the HTML budget
  is off.
- A new app directory that the generator does not know about fails its tests.

## Limits

- The analyzer is an experimental Next CLI with an undocumented format. The generator reads it
  strictly and fails loudly when it changes; it never guesses.
- An embedded-works entry names the libraries the upstream build declares (its build manifest or its
  own notices file). Rust crates inside resvg's WASM beyond resvg and tiny-skia are not enumerated;
  it runs only in our mcp worker.
- `THIRD_PARTY_NOTICES.md` at the repo root stays the notice for material vendored into the source
  tree (Lucide, Feather, draw.io); the page is the notice for what the deployed apps carry.

## Related

- [Open source + distribution](open-source-and-business-model.md)
- [Router app](../016-platform/router-app.md)
- [Folders](../013-workspace/folders.md) (the Explorer ⋯ menu)
