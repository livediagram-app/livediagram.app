# Interface design blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                                  | Default applied                                                                                                |
| --- | --------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| D1  | motion    | How the tokens reach components               | Tailwind's `--transition-duration-*` namespace, so `duration-micro` etc. exist with no plugin                  |
| D2  | motion    | Whether unused tokens are emitted             | `@theme static`, so a token read only through `var()` is always defined                                        |
| D3  | motion    | The beat between cascade items                | 10ms: eleven items reach the 100ms cap, which covers a context menu or a visible screen of rows                |
| D4  | motion    | Row enter/exit tier                           | `micro`, because rows are cascade items and a cascade item runs at `micro`                                     |
| D5  | motion    | How the guard treats an untracked `var()`     | `Infinity`, fallback or not: an inline style can override it, so only tokens count as bounded                  |
| D6  | motion    | A delay declared apart from its duration      | Held to the cascade cap, since the pairing is only known at runtime; the runtime guard checks the sum          |
| D7  | motion    | Inline `animationDuration` / `animationDelay` | Not read statically: marketing art sets hundreds; chrome cascades go through `cascadeDelayMs` and e2e          |
| D8  | motion    | The middle tier                               | 200ms, halfway between the hover and ceiling values, for surfaces larger than a menu and smaller than a dialog |
