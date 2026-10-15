# Linting

Status: shipped

## What

Every workspace is linted by **oxlint** with one shared config, `@livediagram/oxlint-config`
(`packages/oxlint-config`). `pnpm lint` runs `turbo run lint`, and each workspace's `lint` script is
`oxlint`: it reads the workspace's `oxlint.config.ts`, which re-exports the shared config (`apps/live`
adds one override for its Playwright suite). Every rule is an **error**; there are no warnings.

## Why

The linter must not hold the compiler back. ESLint's TypeScript support imports the classic TypeScript
compiler API, which TypeScript 7 does not ship; oxlint parses TypeScript itself, and runs faster. The
rules the repo enforced under ESLint carry over one by one, so the move changes the tool, not the bar.

## The rules

The shared config turns every oxlint category off and names each rule, so `packages/oxlint-config/index.ts`
is the whole of what the repo enforces.

- **ESLint's recommended rules**, as oxlint's native `eslint/*` rules, with ESLint's options where
  oxlint's defaults differ (`no-irregular-whitespace` checks templates, regular expressions and JSX
  text; `no-constant-binary-expression` skips relational comparisons).
- **typescript-eslint's recommended rules**, as oxlint's native `typescript/*` rules (and `eslint/*`
  for `no-unused-vars`, `no-unused-expressions` and `no-array-constructor`, which oxlint runs on
  TypeScript). Unused variables and arguments are allowed only when named with a leading `_`.
- **By language**: the rules TypeScript's compiler already enforces (`no-undef`, `no-dupe-keys`,
  `constructor-super` and the rest) run on JavaScript files only; `no-var`, `prefer-const`,
  `prefer-rest-params` and `prefer-spread` run on TypeScript files only. JavaScript files know the
  browser, Node and ES2022 globals.
- **Every `eslint-plugin-react-hooks` rule**, the React Compiler's included, loaded as an oxlint JS
  plugin under the name `react-hooks-js` (`react` is oxlint's own). It is the same plugin, so the same
  analysis; [React state and effects](react-state-and-effects.md) says why they are errors.
- **The repo's own rules**, in the `livediagram` JS plugin (`packages/oxlint-config/plugin.ts`):
  - `livediagram/no-native-title`: no native `title` outside `iframe` and `abbr`
    ([Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md));
  - `livediagram/no-raw-icon-svg`: no icon-sized raw `<svg>` outside the art allow-list
    ([Iconography](../004-interface-design/iconography.md)).
- **No formatting rules.** Prettier owns formatting.
- **No type-aware rules.** Every rule reads one file's syntax; none needs a type checker.

## Disable directives

- Only `oxlint-disable` directives count. An `eslint-disable` comment suppresses nothing, so one
  pasted from elsewhere never hides a finding.
- A directive that suppresses nothing is itself an error, so a stale one cannot linger.

## Files

- Each workspace lints its own tree; build output (`dist`, `build`, `.next*`, `out`, `.turbo`,
  `.wrangler`, `coverage`), `node_modules` and Next's `next-env.d.ts` are ignored.
- Files outside every workspace (root `scripts/`, `docs/demo/`) are not part of `pnpm lint`; the root
  `oxlint.config.ts` exists so an editor lints them with the same rules.

## Guarantees

`packages/oxlint-config` lints scratch files with the real config in its tests: one deliberate
violation per rule family (hooks, React Compiler, `any`, the repo's own rules), an unused directive,
an ignored `eslint-disable`, and the JavaScript-only and TypeScript-only splits.
