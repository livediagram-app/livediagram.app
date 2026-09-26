# Interface design blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint    | Spec silence                                    | Default applied                                                                                                                                             |
| --- | ------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | motion       | How the tokens reach components                 | Tailwind's `--transition-duration-*` namespace, so `duration-micro` etc. exist with no plugin                                                               |
| D2  | motion       | Whether unused tokens are emitted               | `@theme static`, so a token read only through `var()` is always defined                                                                                     |
| D3  | motion       | The beat between cascade items                  | 10ms: eleven items reach the 100ms cap, which covers a context menu or a visible screen of rows                                                             |
| D4  | motion       | Row enter/exit tier                             | `micro`, because rows are cascade items and a cascade item runs at `micro`                                                                                  |
| D5  | motion       | How the guard treats an untracked `var()`       | `Infinity`, fallback or not: an inline style can override it, so only tokens count as bounded                                                               |
| D6  | motion       | A delay declared apart from its duration        | Held to the cascade cap, since the pairing is only known at runtime; the runtime guard checks the sum                                                       |
| D7  | motion       | Inline `animationDuration` / `animationDelay`   | Not read statically: marketing art sets hundreds; chrome cascades go through `cascadeDelayMs` and e2e                                                       |
| D8  | motion       | The middle tier                                 | 200ms, halfway between the hover and ceiling values, for surfaces larger than a menu and smaller than a dialog                                              |
| D9  | dark-palette | Hover on a solid fill that is not a control     | Two constants: `SOLID_BRAND_DARK` (no hover) for badges and discs, `SOLID_BRAND_DARK_CONTROL` for controls                                                  |
| D10 | dark-palette | How the wordmark's sky reaches the span         | Tailwind's own `sky-400` utility (`#38bdf8`), not a new token                                                                                               |
| D11 | dark-palette | Resize handle hover in dark                     | Fill and border hold; only the existing opacity lift (70 % to 100 %) signals hover; no shadow                                                               |
| D12 | dark-palette | Count badge height once its line box is trimmed | `h-3.5` (14px), the height `py-0.5` + `leading-none` at 10px already rendered                                                                               |
| D13 | dark-palette | Optical centring without `text-box` support     | `translateY(0.1em)`, the measured cap-to-line-box offset of the UI face                                                                                     |
| D14 | dark-palette | What the contrast audit measures                | Visible text nodes (non-blank, non-zero box, visible, cumulative opacity > 0, in viewport)                                                                  |
| D15 | dark-palette | What the audit cannot measure                   | Skipped and reported, never failed: art under a CSS `filter`, disabled controls, visually hidden text, backgrounds that are images before any opaque colour |
| D16 | dark-palette | Large-text threshold                            | 24px, or 18.66px at weight 700 or more (WCAG's 18pt / 14pt bold at 96dpi)                                                                                   |
| D17 | dark-palette | Arrow label on dark paper with a user stroke    | Follows the stroke, as in light: the label is `#94a3b8` only for an arrow with no stored colour                                                             |
| D18 | dark-palette | Which screens the audit covers                  | Wizard steps 1 and 2, editor with a seeded diagram and its default panels, Settings, Share, Join, Explorer                                                  |
