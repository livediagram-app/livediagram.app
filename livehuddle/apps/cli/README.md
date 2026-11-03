# livehuddle CLI

`livehuddle` is the command line agents and scripts read, lint and change livehuddle Spaces (the api's documents) with. The
behaviour is specified in [CLI](../../docs/specs/015-api/cli.md) and its
[blueprint](../../docs/specs/015-api/blueprints/cli.md); the verbs themselves live in `@livehuddle/agent-verbs`.

## Develop

```bash
pnpm --filter @livehuddle/cli test        # every suite runs on an in-memory CliIo
pnpm --filter @livehuddle/cli build       # dist/livehuddle.mjs, one ESM file for Node 22+
LIVEHUDDLE_TOKEN=lwt_... apps/cli/dist/livehuddle.mjs --help
```

`src/main.ts` runs one command from argv to an exit code; `src/io.ts` is everything it touches outside itself, which
@liveworkspace/cli-kit's `nodeIo` provides for real (in `src/bin.ts`) and `src/testing/fake-io.ts` for the tests. Running it against a local stack is
in [Local development](../../docs/development/local-development.md#running-the-cli-from-source-optional).
