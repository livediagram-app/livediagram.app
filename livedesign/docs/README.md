# Docs

Follow the references below only as needed; never upfront.

Documentation for livedesign, the open-source real-time editor for logos, wireframes and photos.

livedesign is a multiplayer page editor in the browser: teams design logos, wireframe screens and edit photos in layers together in real time, with shared cursors and live selections, then present the pages full screen and export them (PDF, PNG, SVG, JSON, a Logo Kit, or a photo's PNG, JPEG, WebP or PSD). What a person makes is a **design**. The editor works without signing in, so starting is "open the link, start designing". The hosted product runs free at [livedesign.app](https://livedesign.app), and the MIT-licensed codebase is self-hostable end to end. Who it is for lives in [Purpose](./specs/001-project-vision/purpose.md), what is built and still ahead in [Build phase](./specs/005-project-roadmap/prototype-scope.md).

These docs are the practical guide: what the app does, how to run it locally, how to host it on your own Cloudflare account, and how to contribute. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](specs/). Specs are normative; these docs explain.

## Contents

- ./specs/README.md - when building or changing product behaviour: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./development/architecture.md - when you need the repo shape: eight apps (one a CLI), twenty-four packages, Cloudflare-only deploys
- ./development/local-development.md - when cloning, installing, and running the apps locally
- ./development/contributing.md - when proposing a change: specs-first workflow, code style, tests, PRs
- ./operations/self-hosting.md - when running your own copy on Cloudflare Workers + D1, optionally with sign-in through liveworkspace accounts
- ./research/README.md - when you need measurements and experiment reports

## How docs relate to specs

- **Docs** (this folder): user-facing + contributor-facing instructions. How to do things.
- **[Specs](specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## License

[MIT](../LICENSE). Self-host, fork, embed, modify, commercial or otherwise. The hosted version at [livedesign.app](https://livedesign.app) runs alongside the open-source codebase; see [Open source + distribution](./specs/002-project-scope/open-source-and-business-model.md) for the OSS / hosted split.
