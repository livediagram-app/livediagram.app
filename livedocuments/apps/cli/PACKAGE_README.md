# livedocuments

The command line for [livedocuments](https://livedocuments.app): read, build, edit and discuss diagrams from a terminal,
built first for coding agents and second for scripts.

```bash
npx @livedocuments/cli --help
```

or install it, which gives you the `livedocuments` command:

```bash
npm install -g @livedocuments/cli
livedocuments --help
```

## Sign in

Create an API token in livedocuments (Settings › API Tokens), then either set it for a command:

```bash
export LIVEDOCUMENTS_TOKEN=lwt_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | livedocuments auth login --with-token
```

The CLI never prompts. A self-hosted livedocuments is reached with `--host https://…` or `LIVEDOCUMENTS_HOST`.

## Start

```bash
livedocuments document ls auth            # find a document
livedocuments tab view "Auth flow"        # its first tab, as an outline
livedocuments tab lint "Auth flow"        # what is wrong with how it is drawn
livedocuments edit "Auth flow" -f ops.txt # change it with edit operations
livedocuments guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `livedocuments skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, documents or hosts) and sends the
count to the host it talks to. Turn it off with `livedocuments telemetry off`, `LIVEDOCUMENTS_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
