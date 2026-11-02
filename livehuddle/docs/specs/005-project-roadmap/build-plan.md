# Build plan

Status: **proposed**, awaiting the owner's approval (Work Tracker #99). Nothing here starts until the spec is
approved.

How livehuddle gets built: by forking livediagram in-tree and cutting it down to Workshop, as livedocuments and
livedesign were made, after the code both products will need has moved to `packages/`. The thread on Work Tracker #99
settled the route: spec first (this PR), then build by forking livediagram.

## How the earlier forks were done

- **liveplanner** began as a clean snapshot of livediagram (`808eb301ca`, "Fork livediagram at 36a7f162a", 2026-10-21),
  before the products shared a repository.
- **livedocuments** (first called livepages) was forked in-tree: `454ffc640f` copied all of `livediagram/` at
  `82e6ed79a` into `livepages/` with a `.forked-from` file naming the commit, then phases cut it down to Pages mode,
  and a last phase took Pages out of livediagram (docs/structure.md).
- **livedesign** was forked in-tree from livepages (`1eb2877a5`) and cut down to logo, wireframe and photo pages.

liveplanner's fork is the warning: comparing the two products a little after the fork, 2,718 files of the editor were
identical, 1,248 changed and about 1,080 in one only (docs/structure.md), and the identical ones then had to be
shared one step at a time. livehuddle shares first.

## The steps, in order

Each step is one PR, specs first. Every product builds and passes its tests after each one.

### 1. Share the avatar core (before the fork)

The card keeps Avatar mode in livediagram and puts it in livehuddle too, so two products need it from the first day:
by the root AGENTS.md rule it goes in `packages/`, and it moves **before** the fork so there is never a second copy.

- **New package `@liveworkspace/avatar`**: the parts of Avatar mode that read no element union. Measured on `main`,
  livediagram's files named for the avatar are 60 files, 5,767 lines of source and 2,836 of tests, in
  `apps/editor` and `packages/` (the sprite and head, the Avatar panel, the walker, walking, speech bubbles and the
  composer, the action keys, Avatar Pad arrivals, the costume config and its parser). The product binds its storage
  key prefix and telemetry, as `@liveworkspace/telemetry-client` and `@liveworkspace/settings` are bound.
- **The avatar's wire shapes** (`AvatarPresence`, the `avatar`, `avatar-push` and `avatar-say` ops and their
  field-by-field parsers) move from `livediagram/packages/api-schema/src/room-messages.ts` to
  `@liveworkspace/api-schema`, which already holds the presence and room-capacity shapes every product shares.
- **The office pieces' pure parts** (room walls and doorways, the fence and footprint collision, chair seats, the
  Avatar Pad's placement: 2,470 lines across the office, chair, fence and portal files) move where they read no
  element union, into `@liveworkspace/avatar` beside the walk that uses them. The element kinds themselves stay in
  each product's union, as every element kind does.
- **Specs first:** livediagram's [Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md) and its
  blueprints name the new home; docs/structure.md's layout tree gains the package.
- livediagram's behaviour does not change: the same tests pass, only imports move.

### 2. The platform specs, then the registration code

Each platform spec in [Platform registration](../016-platform/platform-registration.md#the-platform-specs-that-change)
first, then its service's code: accounts' resources, the index's apps, media, telemetry, settings, status. These
are harmless before livehuddle has traffic. Two are held back for launch (step 8), because people see them: the site
switcher's row and the sign-in email's list of apps.

### 3. Fork the code

- Copy `livediagram/` at a `main` commit to `livehuddle/`, with `.forked-from` naming it, as `454ffc640f` did.
  Leave out the inert `.github/`.
- Rename mechanically: `@livediagram/*` to `@livehuddle/*`, Worker names, `wrangler.toml` routes (`livehuddle.app`,
  `www.`, `staging.`), the ports ([Platform registration](../016-platform/platform-registration.md#port-block-3500-to-3599)),
  browser storage keys (`livediagram:` to `livehuddle:`), the telemetry app, and the product's name in copy.
- Add `livehuddle` to `pnpm-workspace.yaml`, the root `dev:huddle` script, and the AGENTS.md port table.

### 4. Fork the specs

Copy livediagram's `docs/specs/` into `livehuddle/docs/specs/`, merging this skeleton in (its pages win), with the
same renames. Every later cut removes its specs in the same PR as its code, so the spec tree never describes a feature
livehuddle no longer has.

### 5. Cut down to Workshop

One PR per cut, each removing code, tests, palette entries, templates, help articles and specs together:

1. Diagram and Draw modes: the mode switch goes, every board is Workshop, and the mode-only elements (flowcharts,
   mind maps, sequence diagrams, Sankey, org charts, entities, concept graphics, Technology, Devices) leave the
   element union. livehuddle has no stored spaces yet, so nothing needs migrating.
2. Event Storming, repositories, the Drive mirror, Offline Mode.
3. The `community` app; and the `mcp` and `cli` apps if the owner takes D3.
4. Templates down to Workshop's and the Spaces.

### 6. Make it livehuddle

- Avatar first-class: the picker offers Avatar, a Spaces board opens walking ([v1 scope](../002-project-scope/v1-scope.md) feature 1).
- The start screen and template picker lead with the Spaces; the blank is "Untitled Space".
- The noun **Space** everywhere a person reads one (D6).
- Branding (D5): the colour ramp, the prism tint, the wordmark through `@liveworkspace/brand`.
- Marketing: the landing page on `@liveworkspace/marketing-site`, pitched at meetings, workshops and collaboration.
- Help: the articles v1's features need, cut from livediagram's.

### 7. Measure, bound and test

- The avatar fan-out probe and its fix (R3, below).
- Share-role tests for every gate in [Share roles](../013-workspace/share-roles.md).
- E2E smoke for the editor, a Spaces template walked by two clients, and the canvas performance probe.

### 8. CI, deploys and launch

- The CI group, E2E and canvas-perf entries, deploy tiers ([Platform registration](../016-platform/platform-registration.md#ci)).
- Staging on `staging.livehuddle.app` once the owner's DNS and secrets are in (D8).
- At launch: the site switcher row and the sign-in email line.

### 9. Fold back

The specs reconciled to what shipped, blueprints derived from them, every path and symbol checked.

## What livediagram keeps

**Everything** (Work Tracker #99: "Don't remove these capabilities from livediagram"). Avatar mode, every Navigate
element, the Spaces templates and all of Workshop mode stay in livediagram, behaving as they do today. The only change
livediagram sees is step 1: its avatar code is imported from `@liveworkspace/avatar` instead of its own folders.

livediagram gets no link to livehuddle in v1. A "meeting in it? Try livehuddle" door from a Spaces template is a later
marketing decision, not part of this card.

## Keeping the two products from drifting

Two copies of Workshop mode will drift. Four rules keep that small:

1. **One copy of what can be shared.** The avatar core and its wire shapes live once, in `packages/` (step 1).
2. **The next extraction is named now.** The Session strip and the Collaborate elements (timer, vote, poll, quiz,
   Q&A, reveal, picker, Bring Focus, facilitator) are the next candidates. Their pure parts move to a
   `@liveworkspace/session-tools` package the first time a change has to land in both products, instead of being
   made twice.
3. **A fix to a feature both products have lands in both, in the same PR**, or moves the code to `packages/` first.
   Both products' AGENTS.md say so, with the list of shared features.
4. **A drift report**: a script counting identical, changed and one-only files between `livediagram/` and
   `livehuddle/` with the product names ignored, in the shape of docs/structure.md's liveplanner table, run in CI as
   information (never a gate), so the owner can see the copies diverge and pick the next extraction.

## Rough size

Measured on `main` (2026-11-01):

| What                                      | Size                                            |
| ----------------------------------------- | ----------------------------------------------- |
| livediagram's editor (`apps/editor`)      | 2,616 TypeScript files, about 350,000 lines     |
| livediagram's api (`apps/api`)            | 296 TypeScript files                            |
| The avatar files that move in step 1      | 60 files: 5,767 lines of source, 2,836 of tests |
| The office, chair, fence and portal files | 2,470 lines of source                           |

About **15 PRs**: one for step 1, three or four for step 2, one each for steps 3 and 4, four for step 5, two for
step 6, one or two for step 7, one for step 8. Most of the fork's lines are a copy; the work is in step 1 (careful,
behaviour-preserving moves), step 5 (cuts that keep every test meaningful) and R3.

## Risks

| #   | Risk                                                                                                                                                            | When it bites                                                 | What we do                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Drift** between livediagram's and livehuddle's Workshop                                                                                                       | From the first fix made in one product                        | The four rules above; the drift report shows it                                                                                                                                                                                                                                   |
| R2  | **CI cost**: a fifth product adds a lint, test, build and E2E group                                                                                             | Every PR that reaches `packages/`                             | Only-what-changed planning already scopes groups; livehuddle ships fewer apps than the others; CI minutes are watched after launch                                                                                                                                                |
| R3  | **Avatar fan-out**: every walker sends about 30 packets a second to every socket; a full room of walkers is about 300,000 sends a second for one Durable Object | A large meeting where many people walk at once (an all-hands) | Before launch: a probe that measures relayed sends and CPU for 10, 32 and 100 walkers; then bound it (send rate stepped down with room size, relay a character only to sockets on the same tab, coalesce a socket's packets per frame), with a CPU-time test that keeps the bound |
| R4  | **Room cap of 100** turns away the 101st attendee                                                                                                               | Company-wide meetings                                         | v1 says so plainly (the room-full message exists); raising the cap waits on R3's numbers                                                                                                                                                                                          |
| R5  | **Cut-down breaks shared code paths** (a Workshop feature that quietly used a Diagram-only element)                                                             | Step 5                                                        | One cut per PR, the full suite and E2E each time                                                                                                                                                                                                                                  |
| R6  | **Owner-only steps** (domain, DNS, secrets, billing) hold up staging                                                                                            | Step 8                                                        | Listed in D8 now, so they run in parallel with steps 1 to 7                                                                                                                                                                                                                       |
| R7  | **Status assumes every app has an MCP**                                                                                                                         | Step 2, if D3 defers the MCP                                  | The status spec makes the MCP check optional per app first                                                                                                                                                                                                                        |
| R8  | **Two Spaces products confuse people**: the same templates in livediagram and livehuddle                                                                        | After launch                                                  | livediagram keeps them (the card); livehuddle leads with them; a later cross-link can point meeting-shaped use to livehuddle                                                                                                                                                      |
