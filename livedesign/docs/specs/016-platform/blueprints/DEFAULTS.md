# Platform blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                            | Default applied                                                                    |
| --- | ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------- |
| D1  | new-version-prompt | How often to check for a saved state    | Every 200 ms while waiting, locally (no request)                                   |
| D2  | new-version-prompt | Where the prompt sits                   | Bottom centre, 80 px up, on the chrome layer                                       |
| D3  | new-version-prompt | What "Not now" remembers                | The dismissed server number, for this page only                                    |
| D4  | stale-builds       | Which id names a build                  | The deploy's commit, from the one build job both deploys use                       |
| D5  | stale-builds       | How long the loop guard remembers       | One minute per destination, in `sessionStorage`                                    |
| D6  | stale-builds       | Which URL a recovery loads              | The navigation intent within 10 s, else the current URL                            |
| D7  | nextjs             | How the shared config is shaped         | One function, `liveworkspaceNextConfig`, each app spreading it                     |
| D8  | nextjs             | Turbopack-only flags under webpack      | Left off together with the compiler, so the webpack escape hatch still builds      |
| D9  | trusted-types      | Where the third-party origins come from | None: no layout passes any since sign-in moved to the accounts site                |
| D10 | trusted-types      | What a refused script URL does          | Returns null (the browser blocks it) and logs `[trusted-types] script-url-refused` |
