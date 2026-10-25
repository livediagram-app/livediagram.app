# livedesign CLI

`livedesign` is the command line agents and scripts read, lint and change livedesign designs with. The
behaviour is specified in [CLI](../../docs/specs/015-api/cli.md) and its
[blueprint](../../docs/specs/015-api/blueprints/cli.md); the verbs themselves live in `@livedesign/agent-verbs`.

## Develop

```bash
pnpm --filter @livedesign/cli test        # every suite runs on an in-memory CliIo
pnpm --filter @livedesign/cli build       # dist/livedesign.mjs, one ESM file for Node 22+
LIVEDESIGN_TOKEN=lwt_... apps/cli/dist/livedesign.mjs --help
```

`src/main.ts` runs one command from argv to an exit code; `src/io.ts` is everything it touches outside itself, which
`src/node-io.ts` provides for real and `src/testing/fake-io.ts` for the tests. Running it against a local stack is
in [Local development](../../docs/development/local-development.md#running-the-cli-from-source-optional).
