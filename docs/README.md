# Docs

Follow the references below only as needed; never upfront.

Documentation for livediagram, the open-source real-time diagram editor.

These docs are the practical guide: what the app does, how to run it locally, how to host it on your own Cloudflare account, and how to contribute. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](specs/). Specs are normative; these docs explain.

## Contents

- ./specs/README.md - when building or changing product behaviour: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./product/what-is-livediagram.md - when you need what the product does, who it is for, and what is built
- ./development/architecture.md - when you need the repo shape: seven apps, thirteen packages, Cloudflare-only deploys
- ./development/local-development.md - when cloning, installing, and running the apps locally
- ./development/contributing.md - when proposing a change: specs-first workflow, code style, tests, PRs
- ./operations/self-hosting.md - when running your own copy on Cloudflare Workers + D1, optionally with Clerk
- ./vision/sticky-detection.md - when working on how a wall photo becomes sticky notes: pipeline, constants, limits
- ./vision/handwriting-readers.md - when choosing a reader for marker handwriting on a sticky crop
- ./vision/experiments/e-model.md - when weighing a tiny learned boundary model against the classical pipeline
- ./vision/experiments/d-resolution.md - when asking whether more pixels per note help the sticky detector
- ./demo/sticky-vision/index.html - when watching the sticky detector run live on a synthetic wall (`pnpm demo:sticky-vision`)

## How docs relate to specs

- **Docs** (this folder): user-facing + contributor-facing instructions. How to do things.
- **[Specs](specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## License

[MIT](../LICENSE). Self-host, fork, embed, modify, commercial or otherwise. The hosted version at [livediagram.app](https://livediagram.app) runs alongside the open-source codebase; see [What is livediagram?](product/what-is-livediagram.md) for the OSS / hosted split.
