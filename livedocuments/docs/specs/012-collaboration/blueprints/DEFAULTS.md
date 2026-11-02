# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                                             | Default applied                                                                                    |
| --- | ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| PM1 | presentation-mode  | What counts as a step (counted from the slide asked for) | A move of exactly one slide; a jump (list, Home, End) is taken as given                            |
| PM2 | presentation-mode  | What logs a refused fullscreen                           | `console.warn`, always shown ([Console logging](../../003-system-architecture/console-logging.md)) |
| NC1 | speaker-note-cards | How many cards a slide holds                             | 20 (`NOTE_CARDS_MAX`), read past it cut to the first 20                                            |
| NC2 | speaker-note-cards | How long a card is                                       | 1,000 characters as typed (`NOTE_CARD_TEXT_MAX`); longer old or imported text kept whole           |
| NC3 | speaker-note-cards | What a closed blank card does                            | Removed on close, no undo; a card with words gets a 6 s Undo                                       |
| NC4 | speaker-note-cards | Whether the presenter's viewer stays open across slides  | Yes, on the next slide's first card; hidden on a slide with no cards                               |
| NC5 | speaker-note-cards | How cards reach a PowerPoint notes page                  | One paragraph a card, line breaks inside a card as `<a:br/>`; import makes one card                |
