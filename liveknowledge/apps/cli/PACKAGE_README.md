# liveknowledge

The command line for [liveknowledge](https://www.liveknowledge.app): read, build, edit and discuss documents (articles, slide
decks and infographics) from a terminal, built first for coding agents and second for scripts.

```bash
npx @liveknowledge/cli --help
```

or install it, which gives you the `liveknowledge` command:

```bash
npm install -g @liveknowledge/cli
liveknowledge --help
```

## Sign in

Create an API token in liveknowledge (Settings › API Tokens), then either set it for a command:

```bash
export LIVEKNOWLEDGE_TOKEN=lwt_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | liveknowledge auth login --with-token
```

The CLI never prompts. Another liveknowledge server, such as local development, is reached with `--host https://…` or `LIVEKNOWLEDGE_HOST`.

## Start

```bash
liveknowledge document ls launch            # find a document
liveknowledge tab view "Launch deck"        # its first tab, as an outline
liveknowledge tab lint "Launch deck"        # what is wrong with how it is drawn
liveknowledge edit "Launch deck" -f ops.txt # change it with edit operations
liveknowledge guide edit                    # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `liveknowledge skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, documents or hosts) and sends the
count to the host it talks to. Turn it off with `liveknowledge telemetry off`, `LIVEKNOWLEDGE_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
