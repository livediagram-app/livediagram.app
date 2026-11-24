# Theme blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                                  | Default applied                                                                                                    |
| --- | ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| D1  | multicolour-themes | "Each wrapper logs"; which layer owns the log | The four `theme-graph.ts` wrappers log, so live, templates, Markdown import and MCP share one fingerprint          |
| D2  | multicolour-themes | Log levels                                    | `console.info` for an apply, `console.warn` for an empty palette, matching the `[tag]` convention in `apps/editor` |
| D3  | multicolour-themes | Where the contrast rule is computed           | A `contrastRatio` helper in `packages/document/src/colors.ts`, beside `hexToRgb` and `isLightColor`                |
| D4  | multicolour-themes | "Without exhausting the call stack"           | An explicit-stack depth-first walk; same result as recursion, because each subtree takes one index                 |
| D6  | multicolour-themes | Branch map reuse in a switch                  | Build once, share for `prev` and `next`; the map depends only on the elements                                      |
| D7  | page-designs       | Where content zones come from                 | The page's own texts (what any layout or person put there), so every layout and every hand-made page is guarded    |
| D8  | page-designs       | A section page                                | One to three elements, all texts: what the section and title layouts make                                          |
| D9  | page-designs       | Plain paper's darkness                        | Dark chrome's slate paper on screen is dark; exports are white paper, light                                        |
| D10 | page-designs       | Blur without filters                          | Blur softens a design's own gradients' edges; no SVG blur filter, so moving layers never repaint                   |
