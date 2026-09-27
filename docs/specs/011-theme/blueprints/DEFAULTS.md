# Theme blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                                  | Default applied                                                                                                  |
| --- | ------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| D1  | multicolour-themes | "Each wrapper logs"; which layer owns the log | The four `theme-graph.ts` wrappers log, so live, templates, Markdown import and MCP share one fingerprint        |
| D2  | multicolour-themes | Log levels                                    | `console.info` for an apply, `console.warn` for an empty palette, matching the `[tag]` convention in `apps/live` |
| D3  | multicolour-themes | Where the contrast rule is computed           | A `contrastRatio` helper in `packages/diagram/src/colors.ts`, beside `hexToRgb` and `isLightColor`               |
| D4  | multicolour-themes | "Without exhausting the call stack"           | An explicit-stack depth-first walk; same result as recursion, because each subtree takes one index               |
| D5  | multicolour-themes | Rejection wording                             | `badRequest('empty palette')`, following the route's lowercase messages (`'name too long'`)                      |
| D6  | multicolour-themes | Branch map reuse in a switch                  | Build once, share for `prev` and `next`; the map depends only on the elements                                    |
| D7  | retired-schemes    | Load-time vs D1 migration                     | Read time at every tab entry point; the next save persists it, and offline tabs and files never reach D1         |
| D8  | retired-schemes    | Log level and fingerprint                     | `console.info('[tab-migrate] retired-scheme', { from, stripped })`, only when something was rewritten            |
