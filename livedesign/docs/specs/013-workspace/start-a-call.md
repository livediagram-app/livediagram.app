# Start a Call Here

Where livedesign offers [Start a Call Here](../../../../liveworkspace/docs/specs/004-index/item-calls.md) (Work Tracker
1367): a livehuddle call about this design, in a new browser tab. The call, the pill, the invites, the Wrap Up and
Meetings are the platform's and livehuddle's; this file says only where they sit here and who sees them.

## Where it sits

- **Call** is in the design's top-right corner card, first, after Prototype on a wireframe tab and before Copy and Share. On a phone, and once the card is compact, it is its glyph alone (a phone handset), named
  "Start a Call Here" for screen readers.
- Pressing it opens the shared Start a Call popover under it (a sheet on a phone, from the Apps drawer's Call tile):
  where to meet, preselected from Settings › Calls and changeable for this call alone, then **Start Call** or
  **Cancel** ([The Start a Call popover](../../../../liveworkspace/docs/specs/004-index/item-calls.md#the-start-a-call-popover),
  Work Tracker 1470). Join, while a call is live, opens it at once.
- While a call about the design is live, the same place holds the pill: a pulsing green dot, "3 in Call" (the count
  alone on a phone) and **Join**.
- **Meetings** is a row in the footer's Tools, under Collaborate.
- The editor loads nothing of livehuddle's: only the button, the pill and the Meetings list, from
  `@liveworkspace/workbench`.

## Who sees it

| Role                                            | Call (start) | Join          | Meetings |
| ----------------------------------------------- | ------------ | ------------- | -------- |
| Editor, Participant, Viewer (an account)        | Yes          | Yes           | Yes      |
| A guest holding the design's link               | No           | Yes, as guest | Yes      |
| Offline, embed, workbench frame, Community copy | No           | No            | No       |

## Telemetry

The platform's Start a Call Here events (`UI·Started·ItemCall`, `UI·Opened·ItemCall`, `UI·Refused·ItemCall`,
`UI·Opened·Meetings`), sent under this app's name.
