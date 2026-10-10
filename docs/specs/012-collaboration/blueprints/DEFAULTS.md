# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                                 | Default applied                                                                         |
| --- | ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| IB1 | idea-box-race | Which of several pending own cards comes out for a peer card | The newest one still in the box, so the earlier post (numbered first by the room) stays |
| IB2 | idea-box-race | How an id-less entry is written beside id-carrying ones      | `''`, so `ideaCardIds` stays aligned by position with `ideaCards`                       |
| IB3 | idea-box-race | Where the refused-post notice shows                          | The editor's error toast, as the Q&A board's refused note                               |
| IB4 | idea-box-race | How long an id may be                                        | 64 characters (`IDEA_CARD_ID_MAX`), the room's other id bound; a UUID is 36             |
