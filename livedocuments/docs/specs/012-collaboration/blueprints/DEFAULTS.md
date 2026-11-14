# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                                             | Default applied                                                                                    |
| --- | ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| PM1 | presentation-mode  | What counts as a step (counted from the slide asked for) | A move of exactly one slide; a jump (list, Home, End) is taken as given                            |
| PM2 | presentation-mode  | What logs a refused fullscreen                           | `console.warn`, always shown ([Console logging](../../003-system-architecture/console-logging.md)) |
| PM3 | presentation-mode  | How long a build comes in, and how far Rise travels      | 420 ms (`BUILD_ENTER_MS`) on the slide curve; 28 canvas px (`BUILD_RISE_PX`)                       |
| PM4 | presentation-mode  | What a Fade or Rise does under reduced motion            | Cuts in, as Appear                                                                                 |
| PM5 | presentation-mode  | Which number a build's badge shows                       | Its place among the slide's steps, not the stored order                                            |
| NC1 | speaker-note-cards | How many cards a slide holds                             | 20 (`NOTE_CARDS_MAX`), read past it cut to the first 20                                            |
| NC2 | speaker-note-cards | How long a card is                                       | 1,000 characters as typed (`NOTE_CARD_TEXT_MAX`); longer old or imported text kept whole           |
| NC3 | speaker-note-cards | What a closed blank card does                            | Removed on close, no undo; a card with words gets a 6 s Undo                                       |
| NC4 | speaker-note-cards | Whether the presenter's viewer stays open across slides  | Yes, on the next slide's first card; hidden on a slide with no cards                               |
| NC5 | speaker-note-cards | How cards reach a PowerPoint notes page                  | One paragraph a card, line breaks inside a card as `<a:br/>`; import makes one card                |
| NC6 | speaker-note-cards | How far past the deck cap a save's base may go           | Four times the deck cap (`MAX_DECK_BASE_LEN`, 1 MB): a deck stored past the cap can save smaller   |
| NC7 | speaker-note-cards | Where a changed slide goes when the stored deck lost it  | After the slide before it in the editor's deck when the stored deck holds that one, else first     |
