# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint         | Spec silence                                             | Default applied                                                                                    |
| --- | ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| PM1 | presentation-mode | What counts as a step (counted from the slide asked for) | A move of exactly one slide; a jump (list, Home, End) is taken as given                            |
| PM2 | presentation-mode | What logs a refused fullscreen                           | `console.warn`, always shown ([Console logging](../../003-system-architecture/console-logging.md)) |
