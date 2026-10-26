# Docs

Follow the references below only as needed; never upfront.

Documentation for livedesign, the open-source real-time editor for logos, wireframes and photos.

livedesign is a multiplayer page editor in the browser: teams design logos, wireframe screens and edit photos in layers together in real time, with shared cursors and live selections, then export them (PDF, PNG, SVG, JSON, a Logo Kit, or a photo's PNG, JPEG, WebP or PSD). What a person makes is a **design**. The editor works without signing in, so starting is "open the link, start designing". The hosted product runs free at [livedesign.app](https://livedesign.app), and the codebase is MIT-licensed and publicly viewable. Who it is for lives in [Purpose](./specs/001-project-vision/purpose.md), what is built and still ahead in [Build phase](./specs/005-project-roadmap/prototype-scope.md).

These docs are the practical guide: what the app does, how to run it locally, and how to contribute. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](specs/). Specs are normative; these docs explain.

## Contents

- ./specs/README.md - when building or changing product behaviour: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./development/architecture.md - when you need the repo shape: seven apps (one a CLI), fourteen product packages over the shared `@liveworkspace/*` ones, Cloudflare-only deploys from the monorepo
- ./development/local-development.md - when cloning, installing, and running the apps locally
- ./development/contributing.md - when proposing a change: specs-first workflow, code style, tests, PRs
- ./research/README.md - when you need measurements and experiment reports

## How docs relate to specs

- **Docs** (this folder): user-facing + contributor-facing instructions. How to do things.
- **[Specs](specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## License

[MIT](../LICENSE). Fork, embed, modify, commercial or otherwise. livedesign runs at [livedesign.app](https://livedesign.app); see [Open source + distribution](./specs/002-project-scope/open-source-and-business-model.md).
