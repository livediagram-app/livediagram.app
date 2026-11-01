# Specs

Follow the references below only as needed; never upfront.

This folder is the **source of truth** for what livehuddle is and how it will work. Before building anything, check
here. After every product decision, update or add a spec.

**Status: proposed.** Written for the owner's approval (Work Tracker #99, "Build LiveHuddle App"). No livehuddle code
exists, and none is written until this spec is approved. The decisions still open are in
[Open decisions for the owner](./005-project-roadmap/open-decisions.md).

Specs live in numbered category folders, in the shape every liveworkspace product uses: the reserved `001`-`005`
first (vision, scope, architecture, interface design, roadmap), then one folder per domain concept, numbered as
livediagram numbers them so a forked spec keeps its place. The specs themselves are unnumbered and named by subject.
Categories that will arrive with the fork (the editor, canvas, elements, collaboration, API and so on) are not
written here: they come over from livediagram's specs at the fork and are cut down there
([Build plan](./005-project-roadmap/build-plan.md) "Fork the specs").

## Categories

- ./001-project-vision/README.md - when you need the why: the problem, audience and value proposition, and what livehuddle is not
- ./002-project-scope/README.md - when deciding what is in or out: the v1 features, the non-goals and the apps livehuddle ships
- ./003-system-architecture/README.md - when touching where livehuddle keeps its data or how its apps fit together: one Durable Object per space, no D1
- ./005-project-roadmap/README.md - when asking how livehuddle gets built, what comes after v1 (audio, video, screen sharing) and what the owner still has to decide
- ./013-workspace/README.md - when gating any feature by share role: Editor, Participant and Viewer in livehuddle
- ./016-platform/README.md - when registering livehuddle with liveworkspace: sites, accounts, index, telemetry, media, CI, DNS and the 3500 port block

## Workflow

- A new feature, scope decision, or constraint goes into a spec **before** code.
- Reference specs by filename in PRs and discussions.
- If two specs conflict, that's the bug: fix the specs first, then the code.
- Keep specs terse but unambiguous. Update them when something changes; don't let them drift.
