# livediagram CLI

`livediagram` is the command line agents and scripts read, lint and change livediagram documents with. The
behaviour is specified in [CLI](../../docs/specs/015-api/cli.md) and its
[blueprint](../../docs/specs/015-api/blueprints/cli.md); the verbs themselves live in `@livediagram/agent-verbs`.

## Develop

```bash
pnpm --filter @livediagram/cli test        # every suite runs on an in-memory CliIo
pnpm --filter @livediagram/cli build       # dist/livediagram.mjs, one ESM file for Node 22+
LIVEDIAGRAM_TOKEN=lvd_... apps/cli/dist/livediagram.mjs --help
```

`src/main.ts` runs one command from argv to an exit code; `src/io.ts` is everything it touches outside itself, which
`src/node-io.ts` provides for real and `src/testing/fake-io.ts` for the tests. Running it against a local stack is
in [Local development](../../docs/development/local-development.md#running-the-cli-from-source-optional).
