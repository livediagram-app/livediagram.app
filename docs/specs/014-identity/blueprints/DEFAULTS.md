# Identity blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint       | Spec silence                             | Default applied                                                                      |
| --- | --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| D1  | profile-picture | Several Google accounts linked           | The first in Clerk's `externalAccounts` order                                        |
| D2  | profile-picture | Whether the picture fades in             | No transition: a 20px swap reads as a flicker when faded, and nothing to reduce      |
| D3  | profile-picture | How often a failure logs                 | Once per failed URL, on its `error` event                                            |
| D4  | profile-picture | How a new URL resets the load state      | State keyed on the URL (`loadedUrl`, `failedUrl`), compared during render, no effect |
| D5  | profile-picture | The initial behind a transparent picture | `invisible` once the picture shows, keeping its box                                  |
