# Build plan

Status: **steps 1 to 10 built**. The owner approved it on Work Tracker #99, steps 1 to 9 have shipped, and step 9
folded the specs back to the code (Work Tracker #190). Step 10, the meet-first refocus (Work Tracker #423), has shipped
in its five parts, with its leftovers in Work Tracker #583. What remains is deleting the diagram tools' element engine
(Work Tracker #459), the owner's D8 steps (Work Tracker #395) and keeping the two products from drifting (below).

How livehuddle gets built: by forking livediagram in-tree and cutting it down to Workshop, as livedocuments and
livedesign were made, after the code both products will need has moved to `packages/`. The thread on Work Tracker #99
settled the route: spec first, then build by forking livediagram.

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

- **New package `@liveworkspace/avatar`** (`@livehuddle/avatar` in this product's `packages/avatar` since Work
  Tracker #650 left livehuddle its only user): the parts of Avatar mode that read no element union. Measured on `main`,
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
- **Specs first:** [Avatar mode](../008-canvas/avatar-mode.md) (livediagram's copy then; it left livediagram with Work Tracker #650) and its
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
2. Event Storming and repositories: the Event Storming board, its notes, lanes, templates and wall-photo import, and
   repository links with the CLI's `link`, `sync` and `snapshot`. Both are livediagram's own.
3. Keep and adapt the platform-wide features (owner, 2026-11-02; D3 settled as (b)): Offline Mode, the Drive mirror,
   the Community, the MCP server and the CLI stay. The MCP's tools and the CLI's commands lose what steps 5.1 and 5.2
   cut and talk about Spaces; livehuddle registers with the platform's Community service, and its gallery publishes
   Spaces in categories for meetings and workshops. Steps 5.2 and 5.3 land as one PR (Work Tracker #184).
4. Templates down to Workshop's and the Spaces (done: thirty-nine, with Blank Space; Software & IT folded into
   Retrospectives once Event Storming left it with one).

### 6. Make it livehuddle

Done in two PRs: 6a, Avatar first-class and the Space noun (Work Tracker #186), and 6b, branding, the marketing site
and help (Work Tracker #187).

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

**Built** (Work Tracker #189): the hold lifted and everything below is in the code; it deploys once the owner's
remaining D8 steps (Work Tracker #395) are done (the PR, #1251, merged).

- The CI group, E2E and canvas-perf entries, deploy tiers ([Platform registration](../016-platform/platform-registration.md#ci)).
- Staging on `staging.livehuddle.app` once the owner's DNS and secrets are in (D8).
- At launch: the site switcher row and the sign-in email line.
- Left for later: livehuddle's telemetry dashboard (its events are stored, held out of the picker until then) and
  the Explorer hero's pictures of its kinds.

### 9. Fold back

**Done** (Work Tracker #190): the specs reconciled to what shipped, blueprints derived from them, every cited path,
link, anchor and backticked symbol checked against livehuddle's code and the shared `packages/`; both products'
AGENTS.md carry the drift rules below; and the drift report runs in CI.

### 10. Meet-first (Work Tracker #423)

The owner (2026-11-04): livehuddle is about meeting in Spaces, not workshops. Five PRs, in order, each leaving main
working; each part that removes a feature removes its help in the same PR, so help never points at a missing feature
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md) lists what leaves and which part removes it):

1. **Specs.** [Purpose](../001-project-vision/purpose.md) and its boundaries record, [v1 scope](../002-project-scope/v1-scope.md),
   Not in livehuddle, the meeting board ([Workshop mode](../012-collaboration/workshop-mode.md)), the catalogue
   ([Templates by mode](../007-editor/templates-by-mode.md)), a **Leaving livehuddle** note on every spec that goes,
   and both products' AGENTS.md shared-features lists set to the target.
2. **Decks, presenting and the Page** (#356's scope, done): the Slide Deck panel, Presentation mode and the `page` tile and
   kind leave the editor, with their help articles, help registry entries, figures and links (redirects to the
   nearest article). They are small and self-contained, so their code goes in the same PR.
3. **Entry points to the rest.** The catalogue becomes Blank Space and the four Spaces (`packages/templates`, Popular,
   the template categories, `retired-templates.test.ts` answering a leaving kind with Blank Space); the palette
   becomes the meeting palette (with the React category's Reaction Pads, owner 2026-11-04); the Session strip offers Timer and Vote; the Session button, the Workshop tour and the
   interface's "Workshop" wording go (Start a Space, the default folder's label, the Explorer's Opens In filter). The
   help articles for the retros, the Collaborate elements, the leaving palette categories and the templates are
   removed or rewritten in the same PR. Stored elements still draw. The MCP's and CLI's template lists follow the
   catalogue.
4. **Delete the Collaborate and workshop code**, now unreachable: the Collaborate element kinds and their menus, the
   `poll-*` room ops, the Q&A endpoint and `qa` op, per-participant responses, the leaving template builders, and
   their tests, in the editor, the api and `packages/document`; the OpenAPI, MCP and CLI element enums with them.
   First a read-only count of stored tabs holding a leaving kind; a deleted kind then reads as an unknown element,
   kept and drawn as a placeholder. The drift report's header and both AGENTS.md lists lose their "until #423's code
   parts land" notes.
5. **Marketing, Home and the help centre's framing**: the Home hero (Work Tracker #409), the marketing pages, FAQ and
   comparisons, the Community categories, and the help centre's About and Getting Started articles say meeting in
   Spaces, never workshops.

The diagram tools' code (shapes, arrows, the pens, the layout containers, tables, charts, embeds) is offered nowhere
after part 3; deleting it reaches the element engine both shapes and Spaces stand on, so it is its own card.

## What livediagram keeps

**Everything** (Work Tracker #99: "Don't remove these capabilities from livediagram"). Avatar mode, every Navigate
element, the Spaces templates and all of Workshop mode stay in livediagram, behaving as they do today. The only change
livediagram sees is step 1: its avatar code is imported from `@livehuddle/avatar` instead of its own folders.

livediagram gets no link to livehuddle in v1. A "meeting in it? Try livehuddle" door from a Spaces template is a later
marketing decision, not part of this card.

## Keeping the two products from drifting

Two copies of what both products carry will drift. Since step 10 that is the Portal, Bring Focus and the Link card,
the Selection Mode buttons, the Session strip's Timer and Vote, the Reaction Pads, the facilitator baton and
follow-me; the rest of Workshop mode is livediagram's alone. Since livediagram's Work Tracker #650 (2026-11-09),
Avatar mode, the Spaces templates and every avatar-only piece (Chair, Desk, Sofa, the office pieces, Fence, Avatar
Pad, turning and seats) are livehuddle's alone: livediagram keeps a stored one as a "Moved to livehuddle" placeholder
and drops the old avatar ops unread (livediagram's
[Not in livediagram](../../../../livediagram/docs/specs/002-project-scope/not-in-livediagram.md)), so there is no
copy left to drift. Four rules keep the rest small:

1. **One copy of what can be shared.** The realtime room's shapes live once, in `packages/`. The avatar core
   (`@livehuddle/avatar`, step 1) moves into livehuddle with #650's second part, since only livehuddle uses it; the
   reaction bursts both products throw stay shared.
2. **The next extraction is named now.** The Session strip's Timer, Bring Focus and the facilitator baton
   are the next candidates (the Collaborate elements were, until step 10 took them out of livehuddle). Their pure parts move to a
   `@liveworkspace/session-tools` package the first time a change has to land in both products, instead of being
   made twice.
3. **A fix to a feature both products have lands in both, in the same PR**, or moves the code to `packages/` first.
   Both products' AGENTS.md say so, with the list of shared features.
4. **A drift report**: `.github/scripts/drift-report.mjs` counts identical, changed and one-only files between
   `livediagram/` and `livehuddle/` with the product names ignored, per app and package, in the shape of
   docs/structure.md's liveplanner table. CI's Plan job writes it to every run's summary as information, never a gate
   (the root [docs/ci.md](../../../../docs/ci.md#drift-report)), so the owner can see the copies diverge and pick the
   next extraction.

The report at step 9 (2026-11-04), the rows with the most changed files:

|                     | identical | changed | only in livediagram | only in livehuddle |
| ------------------- | --------- | ------- | ------------------- | ------------------ |
| `apps/editor`       | 1,875     | 464     | 325                 | 13                 |
| `apps/help`         | 133       | 249     | 25                  | 3                  |
| `docs/specs`        | 207       | 221     | 33                  | 9                  |
| `packages/document` | 388       | 106     | 88                  | 1                  |
| All files           | 3,581     | 1,369   | 841                 | 43                 |

Of the editor's 464 changed files, about 300 lost code for a cut feature, about 100 say Space, and the other 60 or so
are mostly Prettier re-wrapping a line the longer or shorter name moved; the help centre and the specs changed as
products, as expected.

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

| #   | Risk                                                                                                                                                            | When it bites                                                                             | What we do                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Drift** between livediagram's and livehuddle's Workshop                                                                                                       | From the first fix made in one product                                                    | The four rules above; the drift report shows it                                                                                                                                                                                                                                                                                                                                                                                 |
| R2  | **CI cost**: a fifth product adds a lint, test, build and E2E group                                                                                             | Every PR that reaches `packages/`                                                         | Only-what-changed planning already scopes groups; livehuddle ships fewer apps than the others; CI minutes are watched after launch                                                                                                                                                                                                                                                                                              |
| R3  | **Avatar fan-out**: every walker sends about 30 packets a second to every socket; a full room of walkers is about 300,000 sends a second for one Durable Object | A large meeting where many people walk at once (an all-hands)                             | Before launch: a probe that measures relayed sends and CPU for 10, 32 and 100 walkers; then bound it (send rate stepped down with room size, relay a character only to sockets on the same tab, coalesce a socket's packets per frame), with a CPU-time test that keeps the bound. **Done** (step 7, part 1): 100 walkers went from a saturated room to 40% of a core ([Avatar mode](../008-canvas/avatar-mode.md#a-busy-room)) |
| R4  | **Room cap of 100** turns away the 101st attendee                                                                                                               | Company-wide meetings                                                                     | v1 says so plainly (the room-full message exists); raising the cap waits on R3's numbers, which leave a full room of 100 walkers at 40% of one core                                                                                                                                                                                                                                                                             |
| R5  | **Cut-down breaks shared code paths** (a Workshop feature that quietly used a Diagram-only element)                                                             | Step 5                                                                                    | One cut per PR, the full suite and E2E each time                                                                                                                                                                                                                                                                                                                                                                                |
| R6  | **Owner-only steps** (domain, DNS, secrets, billing) hold up staging                                                                                            | Step 8                                                                                    | Listed in D8 now, so they run in parallel with steps 1 to 7                                                                                                                                                                                                                                                                                                                                                                     |
| R7  | **Status assumes every app has an MCP**                                                                                                                         | Settled: livehuddle shipped its MCP in v1 (D3 (b)), and it went later (Work Tracker #562) | No status-service change for an app without an MCP; livehuddle's group checks no MCP                                                                                                                                                                                                                                                                                                                                            |
| R8  | **Two Spaces products confuse people**: the same templates in livediagram and livehuddle                                                                        | After launch                                                                              | livediagram keeps them (the card); livehuddle leads with them; a later cross-link can point meeting-shaped use to livehuddle                                                                                                                                                                                                                                                                                                    |
