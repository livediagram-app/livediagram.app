# Docs

Follow the references below only as needed; never upfront.

Documentation for livediagram, the open-source real-time diagram editor.

livediagram is a multiplayer canvas in the browser: teams build diagrams and mindmaps together in real time, with shared cursors, live selections and a per-tab activity log with revert. The canvas works without signing in, so starting is "open the link, start drawing". The hosted product runs free at [livediagram.app](https://livediagram.app), and the MIT-licensed codebase is self-hostable end to end. Who it is for lives in [Purpose](./specs/001-project-vision/purpose.md), what is built and still ahead in [Build phase](./specs/005-project-roadmap/prototype-scope.md).

These docs are the practical guide: what the app does, how to run it locally, how to host it on your own Cloudflare account, and how to contribute. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](specs/). Specs are normative; these docs explain.

## Contents

- ./specs/README.md - when building or changing product behaviour: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./development/architecture.md - when you need the repo shape: seven apps, thirteen packages, Cloudflare-only deploys
- ./development/local-development.md - when cloning, installing, and running the apps locally
- ./development/contributing.md - when proposing a change: specs-first workflow, code style, tests, PRs
- ./operations/self-hosting.md - when running your own copy on Cloudflare Workers + D1, optionally with Clerk
- ./research/README.md - when you need measurements and experiment reports, such as sticky detection in wall photos
- ./demo/sticky-vision/index.html - when watching the sticky detector run live on a synthetic wall (`pnpm demo:sticky-vision`)

## How docs relate to specs

- **Docs** (this folder): user-facing + contributor-facing instructions. How to do things.
- **[Specs](specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## License

[MIT](../LICENSE). Self-host, fork, embed, modify, commercial or otherwise. The hosted version at [livediagram.app](https://livediagram.app) runs alongside the open-source codebase; see [Open source + distribution](./specs/002-project-scope/open-source-and-business-model.md) for the OSS / hosted split.
