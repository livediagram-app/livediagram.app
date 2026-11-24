# Send to Knowledge Base

What livediagram sends with [Send to Knowledge Base](../../../../liveworkspace/docs/specs/004-index/send-to-knowledge.md)
(Work Tracker 1425), where its entries and chip sit, which AI writes the summary, and who may use it. The picker, the
section, the chips' rules and the limits are the platform's; this file says only what is livediagram's own.

## What it sends

- **A selection of several**: the selection's toolbar, **Send to Knowledge Base** right after Send to Plan.
- **One element**: the selection toolbar's **Send to Knowledge Base** beside Send to Plan (every role), and the element
  menu's **Resources** category, right after Send to Plan, for an Editor.
- A selection with nothing in it to document (no words, no frame, no arrow) still sends: its picture and the list of
  what it holds ("A rectangle", "An arrow").

What each element gives (`lib/knowledge-selection.ts`, `captureKnowledgeSelection`), in reading order (top to bottom,
then left to right):

- **A shape, sticky, text or card**: its kind in the app's words and its label as the person sees it (rich text read
  as plain words), and its note.
- **A frame or lane**: an item of its own, and every element inside it joins the selection, its `in` naming the
  frame (the frame's contents are what a picked frame is). livediagram has no groups (009-elements
  web-components-and-no-groups.md), so a frame is how a part of a diagram is gathered.
- **An arrow**: a link between its ends when both are in the selection; an end outside it is sent as `null` and never
  named. Its label is the link's.
- A picture, an embed or an icon gives its kind and its alt text or name, never its bytes.

The **picture** is the selection drawn as Export Selection draws it (`renderTabToCanvas` over `tabAsSeen` of the
selected elements and their frames' contents, in the tab's own appearance, without indicators), a PNG at 2x, drawn
again at 1.5x, 1x, 0.75x and 0.5x until it is at most the platform's 300,000 bytes; a selection too big for that goes
without one, and the picker says so. It is drawn once, when the picker opens.

The **link back** opens this diagram at the tab with the first element selected (`#t=<tab>&el=<element>`).

## The summary

`POST /api/documents/<id>/knowledge-summary` `{tabId, selection, focus?, ai?}` answers `{markdown, provider, model}`,
on the platform's summariser: the diagram's team's key for a joined member, else the person's own, else built-in AI.

- **Who**: a signed-in person, in person, who can read the diagram (any role). An API token, a guest or a visitor
  without an account is refused (`summary_needs_account`), since it spends a key or built-in AI.
- **Credits** with Pro on: 1, paid by the diagram's owner (its team) for an Editor or a Participant, by a Viewer
  themself, spent only once the model has answered; at most 20 a day charged to one diagram by people who are not its
  owner (the same count as Ask's).
- **Limits**: built-in AI counts toward Ask's 30 questions a person a day; the platform's caps on the selection.

## The chip

Each sent element shows liveknowledge's logo among its [indicators](../008-canvas/element-indicators.md), after Send
to Plan's: its hover reads "On <page> · <knowledgebase>" (and "+N" when sent more than once), and a press opens the
page in liveknowledge in a new browser tab. Like every indicator it is never drawn in an export or a thumbnail. Only a
reader who can open the knowledgebase sees it.

## Who sees it

| Role                             | Entry                                                     | Chips |
| -------------------------------- | --------------------------------------------------------- | ----- |
| Editor                           | The selection toolbars, the element menu (Resources)      | Yes   |
| Participant                      | The selection toolbars                                    | Yes   |
| Viewer                           | The selection toolbars                                    | Yes   |
| Guest, Offline, embed, Community | None (the platform's "Who may send")                      | No    |

A send needs only read access here: what decides is the person's Edit on the knowledgebase they pick, which the
picker and the index check.

## Telemetry

The platform's Send to Knowledge Base events (`UI·Opened·SendToKnowledge`, `UI·Used·SendToKnowledge`,
`UI·Created·SendToKnowledge`, `UI·Refused·SendToKnowledge`, `UI·Opened·SentKnowledge`), under this app's name.
