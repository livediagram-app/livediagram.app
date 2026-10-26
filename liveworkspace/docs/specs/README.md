# Specs

Follow the references below only as needed; never upfront.

This folder is the **source of truth** for what the liveworkspace platform is and how it works, as the products'
`docs/specs/` are for each product. Before changing anything under `liveworkspace/`, or a service's contract in the
root `packages/`, check here. After every platform decision, update or add a spec.

Specs live in numbered category folders: `001` (scope) and `002` (architecture) first, then one folder per service.
The specs themselves are unnumbered and named by subject. Each category's `blueprints/` folder holds the
implementation detail derived from its specs: files, routes, tables, bindings, constants with their values, crons,
limits and tests.

Paths in these specs are relative to `liveworkspace/` (`apps/accounts/…`), except those that start with `packages/`
(the root `packages/`), a product folder (`livediagram/…`) or `docs/` (the root `docs/`).

## Categories

- ./001-platform-scope/README.md - when you need the why: what the platform is, what it owns and what each app keeps
- ./002-architecture/README.md - when touching how the services fit together: one origin, routes, environments, deploys, local ports, wiring an app to the platform
- ./003-accounts/README.md - when working on sign-in, sessions, guests, teams, API tokens, OAuth and the device grant, settings, profiles or email
- ./004-index/README.md - when working on the One Explorer's index: items, folders, sharing, grants, the Inbox, the Timeline, the Trash, default folders, guest merges
- ./005-drive/README.md - when working on the Google Drive mirror
- ./006-media/README.md - when working on uploaded images, previews, live images or share cards
- ./007-community/README.md - when working on Community listings
- ./008-telemetry/README.md - when working on anonymous events, the telemetry Worker or the telemetry dashboard
- ./009-status/README.md - when working on the hourly status checks, their history or the status page
- ./010-site/README.md - when working on liveworkspace.app's pages: the front door, the Explorer page, the Settings panel, the sign-in pages, the site switcher
- ./011-workbench/README.md - when working on workbench pairings, tickets and sessions
- ./012-migrate/README.md - when working on the move from the historical livediagram.app, or on what is left of Clerk

## Workflow

- A new feature, scope decision or constraint goes into a spec **before** code, then into its blueprint, then the code.
- Reference specs by filename in PRs and discussions.
- If a spec and the code disagree, that's a bug: usually the spec is right; if not, fix the spec first.
- Keep specs terse but unambiguous, in the present tense, describing the design as it is. Git keeps the history.
