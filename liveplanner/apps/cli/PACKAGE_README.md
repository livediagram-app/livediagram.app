# liveplanner

The command line for [liveplanner](https://liveplanner.app): read, build, edit and discuss plans from a terminal,
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

Sign in through your browser with `liveplanner auth login` (or `--device` on a machine without one). Or make an API token
on liveworkspace.app (in liveplanner, Settings › Account › API Tokens › Manage API Tokens), then either set it for a command:

```bash
export LIVEPLANNER_TOKEN=lwt_...
```

or store it for this machine:

```bash
printf %s "$TOKEN" | liveplanner auth login --with-token
```

The CLI never prompts when its input or output is not a terminal. Another liveplanner host (a staging or local stack) is reached with `--host https://…` or `LIVEPLANNER_HOST`.

## Start

```bash
liveplanner project ls auth            # find a plan
liveplanner tab view "Auth flow"        # its first tab, as an outline
liveplanner edit "Auth flow" -f ops.txt # change it with edit operations
liveplanner guide edit                  # how edit operations read
```

Every write is one changeset, checked against what you last read, and prints how to revert it. `liveplanner skill
install --to ~/.claude/skills` gives a coding agent the skill that says when to use it.

## Privacy

The CLI counts which commands succeed (the command's name only: never arguments, plans or hosts) and sends the
count to the host it talks to. Turn it off with `liveplanner telemetry off`, `LIVEPLANNER_TELEMETRY=0` or
`DO_NOT_TRACK=1`.

Free to use. MIT licensed; see `LICENSE`. The notices of bundled third-party packages are in `THIRD_PARTY_LICENSES`.
