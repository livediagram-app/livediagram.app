# @liveworkspace/migration

The shared contract of the move from the historical livediagram.app ([docs/migration.md](../../docs/migration.md),
"Tooling"): the payload each app's migration door takes, the moved-parts mapping, the browser's Local only handoff
and the legacy guest claim (`src/contract.ts`), and the splitter that turns one old document into its parts
(`src/split.ts`). Plain TypeScript with no product imports, used by the migrate tool, the apps' Workers and
livediagram's editor alike.
