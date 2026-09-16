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
| `noPropertyAccessFromIndexSignature` |           335 |    49 | adopt (138 in one validator) |
| `exactOptionalPropertyTypes`         |           463 |   226 | adopt, phased per workspace  |
| `isolatedDeclarations`               |           112 |    48 | **decline** — see below      |

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

- [ ] Raise `target` / `lib` from ES2022 to ES2024 across the base config and the
      per-workspace overrides that restate it
- [ ] Drop options TS 7 no longer honours or now defaults, keeping only those
      that document a real decision

### Phase 3 — zero- and low-cost strictness flags

- [ ] `noFallthroughCasesInSwitch` (0 errors)
- [ ] `noUnusedLocals` (0 errors)
- [ ] `allowUnreachableCode: false` (0 errors)
- [ ] `allowUnusedLabels: false` (0 errors)
- [ ] `noUncheckedSideEffectImports: true` (0 errors — pin the TS 7 default)
- [ ] `noImplicitReturns` (1 error, `DeleteAccountDialog.tsx`)
- [ ] `noUnusedParameters` (2 errors, `useEditorDrag.insert-between.test.tsx`)
- [ ] `erasableSyntaxOnly` (5 errors, `apps/mcp/src/api.ts` + one test)

### Phase 4 — `noPropertyAccessFromIndexSignature` (335 errors, 49 files)

- [ ] `packages/diagram/src/validate.ts` (138) — the untyped-JSON validator
- [ ] Remaining `packages/*` sites
- [ ] `apps/api` + `apps/mcp` sites
- [ ] `apps/live` sites
- [ ] `apps/marketing`, `apps/help`, `apps/telemetry` sites
- [ ] Turn the flag on in `tsconfig.base.json`

### Phase 5 — `exactOptionalPropertyTypes` (463 errors, 226 files)

Worked bottom-up: packages first, because a fixed DTO in `packages/api-schema`
erases consumer errors in `apps/*`.

- [ ] `packages/api-schema`
- [ ] `packages/diagram`
- [ ] `packages/ui`, `packages/templates`, `packages/telemetry-client`
- [ ] `apps/api`
- [ ] `apps/mcp`, `apps/router`
- [ ] `apps/live` — `lib/` + `hooks/`
- [ ] `apps/live` — `components/` + `app/`
- [ ] `apps/marketing`, `apps/help`, `apps/telemetry`
- [ ] Turn the flag on in `tsconfig.base.json`

### Phase 6 — fold back

- [ ] Log the `isolatedDeclarations` decline + the alias-pair choice in `DECISIONS.md`
- [ ] Add the TS 6/7 split to `LESSONS_LEARNED.md`
- [ ] Re-read every comment touched by the migration; no comment may cite a
      "phase" or a plan coordinate — state the invariant in domain words
- [ ] Final `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
