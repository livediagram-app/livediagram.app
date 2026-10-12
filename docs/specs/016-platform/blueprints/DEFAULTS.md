# Platform blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                               | Default applied                                                                                   |
| --- | ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| D1  | new-version-prompt | How often to check for a saved state       | Every 200 ms while waiting, locally (no request)                                                  |
| D2  | new-version-prompt | Where the prompt sits                      | Bottom centre, 80 px up like the photo import bars, on the chrome layer                           |
| D3  | new-version-prompt | What "Not now" remembers                   | The dismissed server number, for this page only                                                   |
| D4  | stale-builds       | Which id names a build                     | The deploy's commit, from the one build job both deploys use                                      |
| D5  | stale-builds       | How long the loop guard remembers          | One minute per destination, in `sessionStorage`                                                   |
| D6  | stale-builds       | Which URL a recovery loads                 | The navigation intent within 10 s, else the current URL                                           |
| D7  | pr-previews        | Where preview tooling lives                | `packages/preview-env`, a private Node-only package, so its logic is tested in CI like `licences` |
| D8  | pr-previews        | What a preview does with `workers_dev`     | Inherits it unchanged; the custom domain is the documented address                                |
| D9  | pr-previews        | Which tool reads and writes TOML           | `smol-toml`, already in the lockfile through `apps/cli`                                           |
| D10 | pr-previews        | What happens when the label does not exist | The tier job fails loudly; the label is created once by an admin                                  |
| D11 | pr-previews        | A teardown step whose resource is missing  | Counts as done (`gone`), so teardown is idempotent                                                |
| D12 | pr-previews        | When the sweeper runs                      | Daily at 04:00 UTC, an hour after staging's api cron, and on demand                               |
| D13 | pr-previews        | How the tier job gets turbo                | A normal `pnpm install --frozen-lockfile`, so its turbo is the locked version                     |
