# Interface design blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint                     | Spec silence                                  | Default applied                                                                                                |
| --- | ----------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| D1  | motion                        | How the tokens reach components               | Tailwind's `--transition-duration-*` namespace, so `duration-micro` etc. exist with no plugin                  |
| D2  | motion                        | Whether unused tokens are emitted             | `@theme static`, so a token read only through `var()` is always defined                                        |
| D3  | motion                        | The beat between cascade items                | 10ms: eleven items reach the 100ms cap, which covers a context menu or a visible screen of rows                |
| D4  | motion                        | Row enter/exit tier                           | `micro`, because rows are cascade items and a cascade item runs at `micro`                                     |
| D5  | motion                        | How the guard treats an untracked `var()`     | `Infinity`, fallback or not: an inline style can override it, so only tokens count as bounded                  |
| D6  | motion                        | A delay declared apart from its duration      | Held to the cascade cap, since the pairing is only known at runtime; the runtime guard checks the sum          |
| D7  | motion                        | Inline `animationDuration` / `animationDelay` | Not read statically: marketing art sets hundreds; chrome cascades go through `cascadeDelayMs` and e2e          |
| D8  | motion                        | The middle tier                               | 200ms, halfway between the hover and ceiling values, for surfaces larger than a menu and smaller than a dialog |
| D9  | tooltips-hover-cards-popovers | How long "a short grace period" is            | 100ms: crosses a 6 to 10px gap at any human speed, short enough that a passing pointer leaves no card          |
| D10 | tooltips-hover-cards-popovers | How a blur closes a hint                      | The same grace as a pointer leave, so focus moving onto the hint's neighbour does not flicker it               |
| D11 | tooltips-hover-cards-popovers | An engine without `:focus-visible`            | Treat focus as keyboard-visible, so keyboard users never lose the hint                                         |
| D12 | tooltips-hover-cards-popovers | A tooltip's width                             | `max-w-xs` (320px) and wrapping; a name is never cut short                                                     |
| D13 | tooltips-hover-cards-popovers | A tooltip's distance from its control         | 6px and an 8px pointer: a pill is smaller than a card, so it sits closer                                       |
| D14 | tooltips-hover-cards-popovers | Whether a hint describes its trigger          | No `aria-describedby`: a tooltip repeats the name, and a hover card appears only after focus lands             |
| D15 | tooltips-hover-cards-popovers | What a hint anchors on                        | The wrapper's first element child, as the old `Tooltip` did                                                    |
| D16 | tooltips-hover-cards-popovers | How exactly "the same words" is checked       | The accessible name contains the label: clipped text and visually hidden prefixes still pass                   |
