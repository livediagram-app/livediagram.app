# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                                 | Default applied                                                                         |
| --- | ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| IB1 | idea-box-race | Which of several pending own cards comes out for a peer card | The newest one still in the box, so the earlier post (numbered first by the room) stays |
| IB2 | idea-box-race | How an id-less entry is written beside id-carrying ones      | `''`, so `ideaCardIds` stays aligned by position with `ideaCards`                       |
| IB3 | idea-box-race | Where the refused-post notice shows                          | The editor's error toast, as the Q&A board's refused note                               |
| IB4 | idea-box-race | How long an id may be                                        | 64 characters (`IDEA_CARD_ID_MAX`), the room's other id bound; a UUID is 36             |

| #   | Blueprint       | Spec silence                                     | Default applied                                                                                        |
| --- | --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| D1  | facilitate-mode | Position in the mode order (switch, Shift+D)     | Last, after Plan: the catalogue order, so existing Shift+D muscle memory is unchanged                  |
| D2  | facilitate-mode | The catalogue's one-line description             | "Run a session with your team: timers, votes, polls and reveals"                                       |
| D3  | facilitate-mode | Order of Facilitate's categories within a band   | Diagram's order for the shared ones; the six Collaborate categories last, in its old group order       |
| D4  | facilitate-mode | Where Diagram's Comment panel and Action card go | The end of Write, after its existing tiles, in that order                                              |
| D5  | facilitate-mode | MODE_BEST for Facilitate                         | Retrospective, Town Hall Q&A, Lean Coffee, Crazy Eights (spec "Templates by mode")                     |
| D6  | facilitate-mode | Blank Session's content                          | None: an empty canvas, Facilitate's Popular landing; no Start screen of its own                        |
| D7  | facilitate-mode | Mark's drawing                                   | A 24-unit line glyph in the drawing-kinds style: an easel's three legs under a pad with two text lines |
| D8  | facilitate-mode | Whether Facilitate's Media has embeds            | No: Diagram's Media (Image, Avatar), so the two stay alike                                             |

| #   | Blueprint       | Spec silence                         | Default applied                                                                   |
| --- | --------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| FT1 | facilitate-tour | When to decide the Share step is out | When the offer starts, by whether the header's Share button is on screen          |
| FT2 | facilitate-tour | The help card's hue                  | `#ea580c`, a step from Facilitate mode's `#c2410c`, as the Plan tour's is to Plan |
