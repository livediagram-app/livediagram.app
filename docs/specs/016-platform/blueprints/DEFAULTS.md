# Platform blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                         | Default applied                                                         |
| --- | ------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| D1  | new-version-prompt | How often to check for a saved state | Every 200 ms while waiting, locally (no request)                        |
| D2  | new-version-prompt | Where the prompt sits                | Bottom centre, 80 px up like the photo import bars, on the chrome layer |
| D3  | new-version-prompt | What "Not now" remembers             | The dismissed server number, for this page only                         |
| D4  | stale-builds       | Which id names a build               | The deploy's commit, from the one build job both deploys use            |
| D5  | stale-builds       | How long the loop guard remembers    | One minute per destination, in `sessionStorage`                         |
| D6  | stale-builds       | Which URL a recovery loads           | The navigation intent within 10 s, else the current URL                 |
