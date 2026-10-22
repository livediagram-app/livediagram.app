# Docs

Follow the references below only as needed; never upfront.

Documentation for liveplanner, the free real-time planning tool.

liveplanner is a multiplayer canvas in the browser: teams build diagrams, whiteboards, mind maps, infographics and documents together in real time, with shared cursors and live selections. The canvas works without signing in, so starting is "open the link, start drawing". The product runs free at [liveplanner.app](https://liveplanner.app), with no trackers and no ads. Who it is for lives in [Purpose](./specs/001-project-vision/purpose.md), what is built and still ahead in [Build phase](./specs/005-project-roadmap/prototype-scope.md).

These docs are the practical guide: what the app does, how to run it locally, and how we change the code. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](specs/). Specs are normative; these docs explain.

## Contents

- ./specs/README.md - when building or changing product behaviour: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./development/architecture.md - when you need the repo shape: nine apps, twenty-three packages, Cloudflare-only deploys
- ./development/local-development.md - when cloning, installing, and running the apps locally
- ./development/engineering-notes.md - when changing the code: specs-first workflow, code style, tests, PRs
- ./research/README.md - when you need measurements and experiment reports
- ./research/migration-readiness.md - when importing boards from Miro or Microsoft Whiteboard

## How docs relate to specs

- **Docs** (this folder): engineering instructions. How to do things.
- **[Specs](specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## Licence

Proprietary, all rights reserved ([LICENSE](../LICENSE)). liveplanner is free to use at [liveplanner.app](https://liveplanner.app); see [Business model + licence](./specs/002-project-scope/business-model-and-licence.md). Third-party components keep their own licences ([THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)).
