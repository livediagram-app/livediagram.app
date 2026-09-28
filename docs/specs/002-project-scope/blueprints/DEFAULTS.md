# Project scope blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint            | Spec silence                               | Default applied                                                                                                                  |
| --- | -------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| D1  | third-party-licences | How tall a text box is before it scrolls   | 24 lines: the opening of every common licence, including Apache-2.0's first section, fits                                        |
| D2  | third-party-licences | The text box's type                        | `text-xs leading-5` monospace, so a line is exactly 1.25rem and the height is computable at build time                           |
| D3  | third-party-licences | How texts are named                        | First 16 hex of the sha256 of the normalised text                                                                                |
| D4  | third-party-licences | Entry order                                | By name, case-insensitive (`en`), then version                                                                                   |
| D5  | third-party-licences | A vendored work's name                     | Its directory name (with `@scope/`), which is the name Next vendors it under                                                     |
| D6  | third-party-licences | A vendored work's version when it has none | `bundled in <parent> <parent version>`                                                                                           |
| D7  | third-party-licences | Label of a text                            | Its file name; an override's label names the upstream and version                                                                |
| D8  | third-party-licences | Which package links are shown              | `homepage`, else `repository` (string, shorthand or `{ url }`), only when it resolves to `https:`                                |
| D9  | third-party-licences | Opening the page from the editor           | A new tab, as the neighbouring GitHub row does, so an open diagram stays put                                                     |
| D10 | third-party-licences | What "permissive and weak-copyleft" admits | The sixteen ids in `LICENCE_ALLOWLIST`: today's shipped licences plus common permissive peers                                    |
| D11 | third-party-licences | Parallel or sequential analysis            | Sequential: deterministic logs, bounded memory beside turbo's own parallel builds                                                |
| D12 | third-party-licences | Footer placement                           | In the footer nav after Privacy, among the legal links                                                                           |
| D13 | third-party-licences | Sitemap weight                             | Priority 0.2, monthly: a transparency page, not a destination                                                                    |
| D14 | third-party-licences | The HTML budget                            | 1.5x the page as first measured (173.5 KB for 54 works), rounded to 260,000 bytes: dozens more entries fit, inlined texts do not |
| D15 | third-party-licences | The page's header calls to action          | The shared header without a landing-funnel surface: a transparency page is not a funnel step, so its CTAs carry no `via`         |
| D16 | third-party-licences | The entry's disclosure affordance          | The native `summary` marker, coloured: no second drawing of a chevron, no rotation to animate, no bytes per entry                |
