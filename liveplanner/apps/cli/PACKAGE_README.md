# liveplanner

The command line for [liveplanner](https://liveplanner.app): read, build, edit and discuss diagrams from a terminal,
built first for coding agents and second for scripts.

```bash
npx @liveplanner/cli --help
```

or install it, which gives you the `liveplanner` command:

```bash
npm install -g @liveplanner/cli
liveplanner --help
```

## Sign in

Create an API token in liveplanner (Settings › API Tokens), then either set it for a command:

```bash
export LIVEPLANNER_TOKEN=lvd_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | liveplanner auth login --with-token
```

The CLI never prompts. A self-hosted liveplanner is reached with `--host https://…` or `LIVEPLANNER_HOST`.

## Start

```bash
liveplanner document ls auth            # find a document
liveplanner tab view "Auth flow"        # its first tab, as an outline
liveplanner tab lint "Auth flow"        # what is wrong with how it is drawn
liveplanner edit "Auth flow" -f ops.txt # change it with edit operations
liveplanner guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `liveplanner skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, documents or hosts) and sends the
count to the host it talks to. Turn it off with `liveplanner telemetry off`, `LIVEPLANNER_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
