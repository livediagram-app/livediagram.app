# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint         | Spec silence                                                 | Default applied                                                                                    |
| --- | ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| PM1 | presentation-mode | What counts as a step (counted from the slide asked for)     | A move of exactly one slide; a jump (list, Home, End) is taken as given                            |
| PM2 | presentation-mode | What logs a refused fullscreen                               | `console.warn`, always shown ([Console logging](../../003-system-architecture/console-logging.md)) |
| IB1 | idea-box-race     | Which of several pending own cards comes out for a peer card | The newest one still in the box, so the earlier post (numbered first by the room) stays            |
| IB2 | idea-box-race     | How an id-less entry is written beside id-carrying ones      | `''`, so `ideaCardIds` stays aligned by position with `ideaCards`                                  |
| IB3 | idea-box-race     | Where the refused-post notice shows                          | The editor's error toast                                                                           |
| IB4 | idea-box-race     | How long an id may be                                        | 64 characters (`IDEA_CARD_ID_MAX`), the room's other id bound; a UUID is 36                        |
