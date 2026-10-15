# Source scanners

Status: shipped

## What

Some guards read the repo's own TypeScript rather than run it: the light and dark palette tests
(`apps/live/app/*-palette.test.ts`), the telemetry emitter scan (`apps/telemetry/app/emitter-scan.ts`)
and the optical guard (`packages/tailwind-config/src/optical-guard.ts`). They parse source files into
TypeScript syntax trees and walk them.

They parse with `parseSourceFiles(paths)` from `@livediagram/source-ast` (`packages/source-ast`), and
walk the trees with `typescript/unstable/ast`: its `is*` guards, `SyntaxKind`, and each node's
`forEachChild`, `parent`, `getStart` and `getText`.

## Why

The repo runs one TypeScript, TypeScript 7, whose compiler is native and ships no classic compiler API
(`ts.createSourceFile` is gone). Its API reaches the native compiler instead, so a guard parses with
exactly the compiler that type-checks the code, and a syntax TypeScript accepts is a syntax the guards
read.

## How parsing works

- One call parses a batch: the files are opened as one project whose `tsconfig.json` exists only in
  memory (served through the API's virtual file system). It lists exactly the files, with no lib, no
  import resolution and no type checking, so the compiler only parses.
- Trees come back in the order of the paths; every node knows its parent, and `.tsx` files parse as
  JSX.
- One compiler process serves a batch and is closed when the batch is parsed.
- A file the compiler could not read is an error that names the file, never a silent skip.
- A guard that filters files by their text first (the optical guard, the light palette) parses only
  the files that can hold a finding.

## The one other TypeScript

`ts-json-schema-generator` (the api's OpenAPI schema generator, `apps/api/scripts/gen-openapi-schemas.mjs`)
bundles its own TypeScript 5.9 to read the api-schema types. It runs only in
`pnpm --filter @livediagram/api gen:openapi` and the drift test that checks its output; nothing else
imports a classic TypeScript.

## Out of scope

- Type information. The guards read syntax only; none asks the checker.
