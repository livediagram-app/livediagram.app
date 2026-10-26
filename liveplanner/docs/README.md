# Docs

Follow the references below only as needed; never upfront.

Documentation for liveplanner, the free real-time planning tool.

liveplanner is a multiplayer planner in the browser: a team's **project** holds Board, Sheet, Dashboard and Form tabs (boards of cards, spreadsheets, dashboards that show both, and forms whose responses become cards), worked on together in real time with shared cursors and presence. It works without signing in, so starting is "open the link, start planning". It is free, with no trackers and no ads, and hosted at [liveplanner.app](https://liveplanner.app). Who it is for lives in [Purpose](./specs/001-project-vision/purpose.md), what is in and out in [Scope](./specs/002-project-scope/product-scope.md), where the product stands in [Build phase](./specs/005-project-roadmap/prototype-scope.md).

These docs are the practical guide: what the app does, how to run it locally, and how we change the code. For the why-behind-the-what (product decisions, constraints, behaviour contracts), read the [specs](specs/). Specs are normative; these docs explain.

## Contents

- ./specs/README.md - when building or changing product behaviour: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./development/architecture.md - when you need the repo shape: seven apps, the shared packages, Cloudflare-only deploys
- ./development/local-development.md - when installing and running the apps locally
- ./development/engineering-notes.md - when changing the code: specs-first workflow, code style, tests, PRs
- ./research/README.md - when you need measurements and experiment reports

## How docs relate to specs

- **Docs** (this folder): engineering instructions. How to do things.
- **[Specs](specs/)**: product source of truth. Why the app behaves the way it does, what the contracts are, what's in scope.

If a doc disagrees with a spec, the spec wins (and the doc is the bug). Docs link out to specs when readers should go deeper.

## Licence

[MIT](../LICENSE). liveplanner is free to use; see [Business model + licence](./specs/002-project-scope/business-model-and-licence.md). Third-party components keep their own licences ([THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)).
