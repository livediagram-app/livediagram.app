# Docs

Follow the references below only as needed; never upfront.

Documentation for livedocuments, the open-source real-time editor for documents made of pages.

livedocuments is a multiplayer page editor in the browser: teams write articles, build slide decks and lay out infographics together in real time, with shared cursors and live selections, then present them full screen. The editor works without signing in, so starting is "open the link, start writing". The hosted product runs free at [livedocuments.app](https://livedocuments.app), and the codebase is MIT-licensed. Who it is for lives in [Purpose](./specs/001-project-vision/purpose.md), what is built and still ahead in [Build phase](./specs/005-project-roadmap/prototype-scope.md).

These docs are the practical guide: what the app does, how to run it locally, and how to contribute. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](specs/). Specs are normative; these docs explain.

## Contents

- ./specs/README.md - when building or changing product behaviour: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./development/architecture.md - when you need the repo shape: nine apps, twenty-three packages, Cloudflare-only deploys
- ./development/local-development.md - when cloning, installing, and running the apps locally
- ./development/contributing.md - when proposing a change: specs-first workflow, code style, tests, PRs
- ./operations/self-hosting.md - when running your own copy on Cloudflare Workers + Durable Objects, optionally with sign-in through liveworkspace accounts
- ./research/README.md - when you need measurements and experiment reports

## How docs relate to specs

- **Docs** (this folder): user-facing + contributor-facing instructions. How to do things.
- **[Specs](specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## License

[MIT](../LICENSE). Fork, embed, modify, commercial or otherwise. The hosted version at [livedocuments.app](https://livedocuments.app) runs alongside the open-source codebase; see [Open source + distribution](./specs/002-project-scope/open-source-and-business-model.md) for the OSS / hosted split.
