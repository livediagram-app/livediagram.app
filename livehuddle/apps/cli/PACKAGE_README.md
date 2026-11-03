# livehuddle

The command line for [livehuddle](https://livehuddle.app): read, build, edit and discuss Spaces, the boards a team
meets and runs workshops on, from a terminal; built first for agents and second for scripts.

```bash
npx @livehuddle/cli --help
```

or install it, which gives you the `livehuddle` command:

```bash
npm install -g @livehuddle/cli
livehuddle --help
```

## Sign in

You need a livehuddle account. Sign in through your browser, or with a device code on a machine without one:

```bash
livehuddle auth login            # opens a sign-in page
livehuddle auth login --device   # prints a page and a code to enter on any device
```

Either creates an API token named **livehuddle CLI**, with an optional **Read-only access** switch. For CI and agents,
create a token on [liveworkspace.app](https://www.liveworkspace.app/explorer?settings=tokens) (up to 20 at a time, each
optionally read-only), then either set it for a command:

```bash
export LIVEHUDDLE_TOKEN=lwt_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | livehuddle auth login --with-token
```

The CLI never prompts when its input or output is not a terminal, so it is safe in pipes and CI. Another livehuddle
server, such as local development, is reached with `--host https://…` or `LIVEHUDDLE_HOST`.

## Start

```bash
livehuddle document ls retro             # find a Space
livehuddle tab view "Sprint retro"       # its first tab, as an outline
livehuddle tab lint "Sprint retro"       # what is wrong with how it is drawn
livehuddle edit "Sprint retro" -f ops.txt # change it with edit operations
livehuddle guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `livehuddle skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, Spaces or hosts) and sends the
count to the host it talks to. Turn it off with `livehuddle telemetry off`, `LIVEHUDDLE_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

MIT licensed. The notices of bundled packages are in `THIRD_PARTY_LICENSES`.
