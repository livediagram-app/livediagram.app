# livediagram

The command line for [livediagram](https://livediagram.app): read, build, edit and discuss diagrams from a terminal,
built first for coding agents and second for scripts.

```bash
npx @livediagram/cli --help
```

or install it, which gives you the `livediagram` command:

```bash
npm install -g @livediagram/cli
livediagram --help
```

## Sign in

Create an API token in livediagram (Settings › API Tokens), then either set it for a command:

```bash
export LIVEDIAGRAM_TOKEN=lvd_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | livediagram auth login --with-token
```

The CLI never prompts. A self-hosted livediagram is reached with `--host https://…` or `LIVEDIAGRAM_HOST`.

## Start

```bash
livediagram document ls auth            # find a document
livediagram tab view "Auth flow"        # its first tab, as an outline
livediagram tab lint "Auth flow"        # what is wrong with how it is drawn
livediagram edit "Auth flow" -f ops.txt # change it with edit operations
livediagram guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `livediagram skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, documents or hosts) and sends the
count to the host it talks to. Turn it off with `livediagram telemetry off`, `LIVEDIAGRAM_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
