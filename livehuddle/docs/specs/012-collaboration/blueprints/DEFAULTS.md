# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                                 | Default applied                                                                         |
| --- | ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| IB1 | idea-box-race | Which of several pending own cards comes out for a peer card | The newest one still in the box, so the earlier post (numbered first by the room) stays |
| IB2 | idea-box-race | How an id-less entry is written beside id-carrying ones      | `''`, so `ideaCardIds` stays aligned by position with `ideaCards`                       |
| IB3 | idea-box-race | Where the refused-post notice shows                          | The editor's error toast, as the Q&A board's refused note                               |
| IB4 | idea-box-race | How long an id may be                                        | 64 characters (`IDEA_CARD_ID_MAX`), the room's other id bound; a UUID is 36             |

| #   | Blueprint     | Spec silence                                 | Default applied                                                                                              |
| --- | ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1  | workshop-mode | Position in the mode order                   | The only mode; no switch and no Shift+D (Editor modes)                                                       |
| D2  | workshop-mode | The catalogue's one-line description         | "Run a session with your team: timers, polls and reveals"                                                    |
| D3  | workshop-mode | Order of Workshop's categories within a band | The catalogue's order for the shared ones; the six Collaborate categories last, in their old group order     |
| D4  | workshop-mode | Where the Comment panel and Action card go   | The end of Write, after its existing tiles, in that order                                                    |
| D5  | workshop-mode | Popular for Workshop (POPULAR_BY_MODE)       | Blank Space, Virtual Office, Team Pod, Coworking Space, All-Hands Hall (`packages/templates/src/popular.ts`) |
| D6  | workshop-mode | Blank Space's content                        | None: an empty canvas, Workshop's Popular landing; no Start screen of its own                                |
| D7  | workshop-mode | Mark's drawing                               | A 24-unit line glyph in the drawing-kinds style: an easel's three legs under a pad with two text lines       |
| D8  | workshop-mode | Whether Workshop's Media has embeds          | No: Image and Avatar only, as livediagram's Diagram Media was                                                |

| #   | Blueprint         | Spec silence                                             | Default applied                                                                                    |
| --- | ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| FT1 | workshop-tour     | When to decide the Share step is out                     | When the tour starts, by whether the header's Share button is on screen                            |
| FT2 | workshop-tour     | The help card's hue                                      | `#ea580c`, a step from Workshop mode's `#c2410c`                                                   |
| PM1 | presentation-mode | What counts as a step (counted from the slide asked for) | A move of exactly one slide; a jump (list, Home, End) is taken as given                            |
| PM2 | presentation-mode | What logs a refused fullscreen                           | `console.warn`, always shown ([Console logging](../../003-system-architecture/console-logging.md)) |

| #   | Blueprint       | Spec silence                                    | Default applied                                                                                                                           |
| --- | --------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PA1 | proximity-audio | "The mic is only on while someone is in range"  | Open while another walker is on your tab (they may hear you or see your bars)                                                             |
| PA2 | proximity-audio | What starts audio                               | Walking where there is a call (muted, no prompt); sound resumes on the next press or key, the microphone prompt comes on the first unmute |
| PA4 | proximity-audio | How a late joiner learns a speaker's microphone | The speaker resends its locator when a new walker reaches its tab, at most once a second                                                  |
| PA6 | proximity-audio | Where the equaliser sits                        | Above the name chip, at reading size, in the speaker's colour                                                                             |

| #   | Blueprint             | Spec silence                                  | Default applied                                                                             |
| --- | --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| JL1 | join-and-leave-sounds | Which chime plays first in a burst            | The first (leading edge), so an arrival is heard as it lands, with no timer in a hidden tab |
| JL2 | join-and-leave-sounds | Where Do Not Disturb is read                  | A module flag the characters layer writes from the walking status, read at play time        |
| JL3 | join-and-leave-sounds | Where the setting sits                        | Account › Notifications, In the Editor, after In-Editor Notifications                       |
| N1  | nudge                 | What "notifies me" is when the tab is visible | The toast alone; a system notification only while hidden                                    |
| N2  | nudge                 | Who may nudge                                 | Editors and Participants (`can.takePart`); a Viewer is nudged, never nudges                 |
| N3  | nudge                 | Identity for the 2 minutes                    | Person tag, else collaboration key, else presence id, on both sides                         |
| N4  | nudge                 | Do Not Disturb                                | Toast still shown, silently; no sound, no system notification                               |
