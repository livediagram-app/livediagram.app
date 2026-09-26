# Editor blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint  | Spec silence                          | Default applied                                                                        |
| --- | ---------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| D1  | appearance | Lifetime of the OS watch              | One `MediaQueryList`, attached on first subscribe or write, never detached             |
| D2  | appearance | Content of the `darkreader-lock` meta | `'true'`: Dark Reader keys on the name alone, and Next drops a meta with empty content |
