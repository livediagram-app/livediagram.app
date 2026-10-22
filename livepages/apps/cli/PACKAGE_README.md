# livepages

The command line for [livepages](https://livepages.app): read, build, edit and discuss diagrams from a terminal,
built first for coding agents and second for scripts.

```bash
npx @livepages/cli --help
```

or install it, which gives you the `livepages` command:

```bash
npm install -g @livepages/cli
livepages --help
```

## Sign in

Create an API token in livepages (Settings › API Tokens), then either set it for a command:

```bash
export LIVEPAGES_TOKEN=lvd_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | livepages auth login --with-token
```

The CLI never prompts. A self-hosted livepages is reached with `--host https://…` or `LIVEPAGES_HOST`.

## Start

```bash
livepages document ls auth            # find a document
livepages tab view "Auth flow"        # its first tab, as an outline
livepages tab lint "Auth flow"        # what is wrong with how it is drawn
livepages edit "Auth flow" -f ops.txt # change it with edit operations
livepages guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `livepages skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, documents or hosts) and sends the
count to the host it talks to. Turn it off with `livepages telemetry off`, `LIVEPAGES_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
