# liveknowledge CLI

`liveknowledge` is the command line agents and scripts read, lint and change liveknowledge documents with. The
behaviour is specified in [CLI](../../docs/specs/015-api/cli.md) and its
[blueprint](../../docs/specs/015-api/blueprints/cli.md); the verbs themselves live in `@liveknowledge/agent-verbs`.

## Develop

```bash
pnpm --filter @liveknowledge/cli test        # every suite runs on an in-memory CliIo
pnpm --filter @liveknowledge/cli build       # dist/liveknowledge.mjs, one ESM file for Node 22+
LIVEKNOWLEDGE_TOKEN=lwt_... apps/cli/dist/liveknowledge.mjs --help
```

`src/main.ts` runs one command from argv to an exit code; `CliIo` (`@liveworkspace/cli-kit/io`) is everything it touches outside itself, which
@liveworkspace/cli-kit's `nodeIo` provides for real and `src/testing/fake-io.ts` for the tests. Running it against a local stack is
in [Local development](../../docs/development/local-development.md#running-the-cli-from-source-optional).
