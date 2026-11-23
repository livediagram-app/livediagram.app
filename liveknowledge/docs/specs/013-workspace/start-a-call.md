# Start a Call Here

Where liveknowledge offers [Start a Call Here](../../../../liveworkspace/docs/specs/004-index/item-calls.md) (Work Tracker
1367): a livehuddle call about this knowledgebase, in a new browser tab. The call, the pill, the invites, the Wrap Up and
Meetings are the platform's and livehuddle's; this file says only where they sit here and who sees them.

## Where it sits

- **Call** is in the knowledgebase's top row of actions, first, before Copy and Share. On a phone, and once the card is compact, it is its glyph alone (a phone handset), named
  "Start a Call Here" for screen readers.
- While a call about the knowledgebase is live, the same place holds the pill: a pulsing green dot, "3 in Call" (the count
  alone on a phone) and **Join**.
- **Meetings** is a row in the footer's Tools, under Collaborate.
- The editor loads nothing of livehuddle's: only the button, the pill and the Meetings list, from
  `@liveworkspace/workbench`.

## Who sees it

| Role                                            | Call (start) | Join          | Meetings |
| ----------------------------------------------- | ------------ | ------------- | -------- |
| Editor, Participant, Viewer (an account)        | Yes          | Yes           | Yes      |
| A guest holding the knowledgebase's link               | No           | Yes, as guest | Yes      |
| Offline, embed, workbench frame, Community copy | No           | No            | No       |

## Telemetry

The platform's Start a Call Here events (`UI·Started·ItemCall`, `UI·Opened·ItemCall`, `UI·Refused·ItemCall`,
`UI·Opened·Meetings`), sent under this app's name.
