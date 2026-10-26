# livedesign

The command line for [livedesign](https://livedesign.app): read, build, edit and discuss designs (logos, wireframes, photos) from a terminal,
built first for coding agents and second for scripts.

```bash
npx @livedesign/cli --help
```

or install it, which gives you the `livedesign` command:

```bash
npm install -g @livedesign/cli
livedesign --help
```

## Sign in

```bash
livedesign auth login            # approve the CLI in your browser
livedesign auth login --device   # on a machine without a browser: enter a code on another device
```

For CI and agents, create an API token on [liveworkspace.app](https://liveworkspace.app/explorer?settings=tokens)
(livedesign's Settings › Account › API Tokens › Manage API Tokens takes you there), then either set it for a command:

```bash
export LIVEDESIGN_TOKEN=lwt_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | livedesign auth login --with-token
```

The CLI never prompts when its input or output is not a terminal. Another livedesign server, such as local development, is
reached with `--host https://…` or `LIVEDESIGN_HOST`.

## Start

```bash
livedesign design ls auth            # find a design
livedesign tab view "Auth flow"        # its first tab, as an outline
livedesign tab lint "Auth flow"        # what is wrong with how it is drawn
livedesign edit "Auth flow" -f ops.txt # change it with edit operations
livedesign guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `livedesign skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, designs or hosts) and sends the
count to the host it talks to. Turn it off with `livedesign telemetry off`, `LIVEDESIGN_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
