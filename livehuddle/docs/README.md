# Docs

Follow the references below only as needed; never upfront.

Documentation for livehuddle, the liveworkspace app for meeting, running workshops and collaborating together in a
shared space.

livehuddle was built by forking livediagram in-tree, as the [Build plan](./specs/005-project-roadmap/build-plan.md)
says: its code and specs are livediagram's as forked, cut down to Workshop. The Workshop features both products still
carry are listed in [AGENTS.md](../AGENTS.md#workshop-features-shared-with-livediagram), and CI's drift report shows
how far the two copies have moved apart.

## Contents

- ./specs/README.md - when deciding what livehuddle is, what v1 holds and how it will be built: the specs are the source of truth
- ./instructions/README.md - when repeating a known process, such as registering a help article
- ./development/architecture.md - when you need the repo shape: eight apps, thirteen packages, Cloudflare-only deploys
- ./development/local-development.md - when cloning, installing, and running the apps locally
- ./development/contributing.md - when proposing a change: specs-first workflow, code style, tests, PRs
- ./research/README.md - when you need measurements and experiment reports, such as canvas performance and stroke smoothing
- ./research/migration-readiness.md - when importing boards from Miro or Microsoft Whiteboard, or for the Google Drive research behind liveworkspace's Drive sync
