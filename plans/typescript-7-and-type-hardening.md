# TypeScript 7 (native) + type hardening

Two questions drove this plan, and the research answered both:

1. **Are we on the latest TypeScript / the Go compiler?** No. The repo pins
   `typescript@^6.0.3` (the JS compiler). **TypeScript 7.0 shipped on 2026-07-08** —
   that release _is_ the Go port; `tsgo` is no longer a preview package, it's the
   `tsc` binary inside `typescript@7`. Measured on this repo's biggest workspace
   (`apps/live`, cold, no `.tsbuildinfo`): **9.96s on TS 6 → 1.09s on TS 7 (~9x)**.
2. **Can we harden further?** Yes. The base config turns on `strict`,
   `noUncheckedIndexedAccess`, `noImplicitOverride` and `verbatimModuleSyntax`, but
   nine further correctness flags are unset. Every one was measured against the
   whole repo (see the table below) so the plan carries real numbers, not guesses.

## Measured cost of every candidate flag

Run as `tsc 7.0.2 -p <each of the 15 tsconfigs> --noEmit <flag>`, de-duplicated
across projects (packages are type-checked from source by their consumers, so a
raw sum double-counts).

| Flag                                 | Unique errors | Files | Verdict                      |
| ------------------------------------ | ------------: | ----: | ---------------------------- |
| _baseline (TS 7, no new flags)_      |             0 |     0 | TS 7 is drop-in              |
| `noFallthroughCasesInSwitch`         |             0 |     0 | adopt                        |
| `noUnusedLocals`                     |             0 |     0 | adopt                        |
| `allowUnreachableCode: false`        |             0 |     0 | adopt                        |
| `allowUnusedLabels: false`           |             0 |     0 | adopt                        |
| `noUncheckedSideEffectImports`       |             0 |     0 | adopt (pin the TS 7 default) |
| `noImplicitReturns`                  |             1 |     1 | adopt                        |
| `noUnusedParameters`                 |             2 |     1 | adopt                        |
| `erasableSyntaxOnly`                 |             5 |     2 | adopt                        |
| `noPropertyAccessFromIndexSignature` |           335 |    49 | **decline** — see Phase 4    |
| `exactOptionalPropertyTypes`         |           462 |   226 | **decline** — see Phase 5    |
| `isolatedDeclarations`               |           112 |    48 | **decline** — see below      |

The three declines were reached by measuring, not by taste, and each is argued
where it was decided: `isolatedDeclarations` below,
`noPropertyAccessFromIndexSignature` in Phase 4, `exactOptionalPropertyTypes` in
Phase 5. Two of them were planned as work, done or part-done, and then dropped
on what the conversion actually looked like — the measurement that mattered came
from reading real diffs, not from counting errors.

### Why `isolatedDeclarations` is declined

46 of its 112 errors are in `apps/mcp/src/schema.ts`, a file of zod schemas.
`isolatedDeclarations` would demand a hand-written type annotation for each
inferred zod type — annotations that are enormous, unreadable, and immediately
wrong when a schema changes. Its actual payoff is parallel declaration emit, and
**no workspace here emits declarations**: every `tsconfig.json` sets `noEmit`,
because packages are consumed as TypeScript source (`transpilePackages` /
bundler resolution). Paying zod-shaped annotation costs for a build speed-up we
cannot collect is a bad trade. Recorded in `DECISIONS.md`, not silently skipped.

## Migration shape: TypeScript 7 side by side with 6

TypeScript 7.0 **ships no programmatic API** (7.1 will). `typescript-eslint`
detects it and hard-fails: `typescript-eslint does not support TS 7.0`. Next.js
and Prettier's TypeScript parser also import the compiler API. So the official
migration (the "Running Side-by-Side with TypeScript 6.0" section of the 7.0
announcement) is two npm aliases:

```jsonc
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2", // provides `tsc` (7.0)
    "typescript": "npm:@typescript/typescript6@^6.0.2", // provides the 6.0 API + `tsc6`
  },
}
```

`tsc` is then 7.0 (what `typecheck` runs) while `import ts from 'typescript'`
still resolves to the 6.0 API (what eslint / next / prettier need). Verified in a
scratch workspace: `tsc --version` → 7.0.2, `tsc6 --version` → 6.0.3,
`import('typescript').version` → 6.0.3, and `eslint` lints a `.ts` file cleanly.
Both aliases go in **every** workspace — pnpm only links a workspace's own bins.

---

## Tasks

### Phase 1 — TypeScript 7

- [x] Add the `@typescript/native` + `typescript` alias pair to the root and all
      14 workspace `package.json` files; `pnpm install`
      (`packages/eslint-config` needed the TS 6 alias as a real dependency too —
      with `auto-install-peers`, pnpm otherwise satisfied typescript-eslint's
      `typescript` peer from the 7.0 copy the alias pulled in, and eslint died
      with `typescript-eslint does not support TS 7.0`)
- [x] Verify `tsc --version` reports 7.0.2 in every workspace and `pnpm typecheck`
      is green across the monorepo
- [x] Verify the TS 6 API consumers still work: `pnpm lint`, `pnpm format:check`
- [x] Verify the toolchain end to end: `pnpm test`, `pnpm build`
- [x] Record the cold-typecheck before/after timings for the plan + PR

  Cold (every `.tsbuildinfo` deleted first), same machine, `tsc6` vs `tsc`:

  | Scope                              |  TS 6 |  TS 7 | Speed-up |
  | ---------------------------------- | ----: | ----: | -------: |
  | `apps/live` alone                  | 9.96s | 1.09s |     9.1x |
  | all 14 projects, run in sequence   | 21.4s |  2.9s |     7.3x |
  | `pnpm typecheck` (turbo, no cache) |     — | 1.89s |        — |

- [x] Update `docs/` + `README.md` where they name the TypeScript toolchain

### Phase 2 — tsconfig modernisation

- [x] Raise `target` / `lib` from ES2022 to ES2024 across the base config and the
      per-workspace overrides that restate it
- [x] Drop options TS 7 no longer honours or now defaults, keeping only those
      that document a real decision

### Phase 3 — zero- and low-cost strictness flags

- [x] `noFallthroughCasesInSwitch` (0 errors)
- [x] `noUnusedLocals` (0 errors)
- [x] `allowUnreachableCode: false` (0 errors)
- [x] `allowUnusedLabels: false` (0 errors)
- [x] `noUncheckedSideEffectImports: true` (0 errors — pin the TS 7 default)
- [x] `noImplicitReturns` (1 error, `DeleteAccountDialog.tsx`)
- [x] `noUnusedParameters` (2 errors, `useEditorDrag.insert-between.test.tsx`)
- [x] `erasableSyntaxOnly` (5 errors, `apps/mcp/src/api.ts` + one test)

### Phase 4 — `noPropertyAccessFromIndexSignature` (335 errors, 49 files) — **declined**

Adopted, completed across all 335 sites, then reverted on review. The argument
for it was that `noUncheckedIndexedAccess` makes an index-signature **value**
honest (`| undefined`) while this makes the **access** honest, so running one
without the other was half a guard rail.

That analogy was wrong, and one probe shows why:

```ts
interface JWTPayload {
  sub?: string;
  [k: string]: unknown;
}
declare const payload: JWTPayload;

payload.emial; // TS4111 — a typo
payload.email; // TS4111 — correct
payload['emial']; // no error at all
```

The flag reports the typo and the correct key identically, and brackets silence
both. It catches nothing and **changes no types** — unlike
`noUncheckedIndexedAccess`, which really does alter the type and really does
catch crashes. It is a notation rule, not a safety rule, which is why it sits
under "Additional Checks" rather than inside `strict`.

Priced as notation, 335 rewrites is a bad trade:

- **138 of them are in one file**, `packages/diagram/src/validate.ts`, whose
  objects are plain `Record<string, unknown>`. There are no declared properties
  there to be distinguished from index-signature ones, so the brackets carry no
  information at all. `hasValidBox` went from three lines to eight once Prettier
  reflowed it.
- The genuine case — a type with declared members **and** an index signature,
  like `JWTPayload` — is a small minority, and at those sites the very next
  expression is already a `typeof … === 'string'` guard that says the same thing
  in code.

Nothing is lost by declining: no type widens, no check weakens,
`noUncheckedIndexedAccess` keeps doing the actual work.

- [x] Convert all 335 sites (driven by compiler error positions, not regex)
- [x] Review the result on real diffs — the noise is not buying safety
- [x] Prove the flag catches no typo and changes no type
- [x] Revert, and record the evidence in `DECISIONS.md`

### Phase 5 — `exactOptionalPropertyTypes` (462 errors, 226 files) — **declined**

Planned as the headline hardening task, then measured and dropped.

The flag polices exactly one distinction: `prop?: T` (the key may be **absent**)
versus `prop?: T | undefined` (absent **or** present holding no value). It earns
its cost only in a codebase that actually makes that distinction. Three checks
say this one does not.

- **No presence protocol anywhere.** Zero `hasOwnProperty` calls in the repo,
  and no `Object.keys`-driven merge that treats a present-but-undefined key
  differently from a missing one. Every `'field' in el` is discriminated-union
  narrowing across element variants, and each is immediately paired with a
  value test (`'label' in el && typeof el.label === 'string'`), so an undefined
  value takes the same branch as an absent key.
- **Realtime ships whole elements, not field patches.** `ElementOp.update`
  replaces the element by id (spec/75 Level 0), and `elementsEqual` compares via
  `JSON.stringify`, which erases undefined-valued keys regardless. The
  field-level CRDT that _would_ need the distinction was deliberately dropped.
- **The one genuine case is already solved, at runtime.** `tabBroadcastOps`
  builds a tab-meta patch where a cleared field is deliberately
  `patch[k] = undefined`, notices `JSON.stringify` would drop it, and falls back
  to a whole-tab op. Its test is named "falls back to a whole-tab op when a meta
  field is cleared". A compiler flag would neither have prevented that bug nor
  improved that code.

With absent and undefined interchangeable everywhere, the honest resolution of
all 462 errors is to widen the declarations to `?: T | undefined` — which is
what the code already means. That is 462 edits across 226 files whose end state
is a flag with nothing left to catch.

Trialled before deciding: `packages/ui` (all 6) and part of `packages/diagram`
were really converted, which is how the shape of the only available fix became
clear. `buttonClassName` is representative — its parameters default `variant`
and `size`, so callers are _meant_ to forward an undefined value, and the fix
was to say so in the type. True, and inert. Reverted with the flag.

- [x] Measure the flag across the monorepo (462 unique errors, 226 files)
- [x] Trial the conversion on `packages/ui` + `packages/diagram` to learn the real fix
- [x] Test whether absence-vs-undefined is load-bearing anywhere in the repo
- [x] Decline, revert the trial, record the evidence in `DECISIONS.md`

### Phase 6 — fold back

- [x] Log the `isolatedDeclarations` decline + the alias-pair choice in `DECISIONS.md`
- [x] Add the TS 6/7 split to `LESSONS_LEARNED.md`
- [x] Re-read every comment touched by the migration; no comment may cite a
      "phase" or a plan coordinate — state the invariant in domain words
- [x] Final `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — 14/14, 14/14,
      12/12 (3,868 tests), 7/7
- [x] Playwright smoke, 7/7. First run failed five specs on
      `Couldn't create the diagram`: another checkout was holding port 3002, and
      Playwright's `reuseExistingServer` had attached the suite to that server
      instead of the e2e stack, so the editor had no api worker. Re-run on
      `E2E_LIVE_PORT=3402 E2E_API_PORT=8987` and it is green.
- [x] Checked, while the Phase 4 bracket rewrite was still in, that Turbopack
      inlines `process.env['NEXT_PUBLIC_X']` as readily as the dot form: a build
      with a probe key emitted `let r="pk_test_…"` with no `process.env` left in
      any client chunk. The rewrite is gone, but the finding is filed in
      `LESSONS_LEARNED.md` because that failure would have been silent
