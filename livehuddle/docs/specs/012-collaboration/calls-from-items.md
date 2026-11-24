# Calls from other apps

Status: **built** (Work Tracker 1367). livehuddle is the meeting room for every app: **Start a Call Here** on a
diagram, a plan, a document, a design or a knowledgebase opens a livehuddle call about it in a new browser tab
([Start a Call Here](../../../../liveworkspace/docs/specs/004-index/item-calls.md), the platform's spec: starting,
joining, invites, Meetings and the rules). This file says what livehuddle does with such a call: the Space it is, what
the call shows, and the Wrap Up.

## The Space

A call is an ordinary Space, made from the **Team Pod** template (a pod for a stand-up: everyone in it hears everyone)
by the index as the host's, named "<item title> Call", with a Participant link that lets the item's readers in. Its
audio, video and screen share are livehuddle's own calls ([Proximity audio](proximity-audio.md), [Video and screen
bubbles](video-and-screen-bubbles.md)): no second video stack. Presenting the item is screen share. Everything a Space
offers works in it, and its minutes are the host's as any Space's ([Call Minutes](call-minutes.md)).

The room keeps the call's id once the index marks it (the internal door `POST /api/internal/items/:id/call`), and from
then on tells the index who is in it, a count and their presence names, at most every 1.5 seconds of changes
(`PUT /app/items/:id/call-people`). A Space that is not a call says nothing.

## What the call shows

The corner card at the top right leads with **the item**: its app's logo and its name, at most 22 characters before an
ellipsis, as one button, **Open Item**, which brings the item's tab back to the front (the tab it was started or joined
from), or opens the item in a new tab when that tab is gone. Its hover card reads "This call is about <item> in
<app>. Open Item takes you back to it." Then:

- **Invite** (an account who reaches the item): a centred dialog listing the people who reach the whole item, the
  team's members first, each a check row, at most 10 picked; **Send Invites** sends an Inbox row to each picked
  (the platform's "Invites"), and a toast says "Invited 2 people".
- **Wrap Up** (the host alone): opens the Wrap Up dialog below.

On joining, everyone sees one toast: "This call is about <item>. It isn't recorded." livehuddle records nothing.

## Wrap Up

A dialog centred on screen (a bottom sheet on a phone), with the hero header (art `meeting`), titled **Wrap Up** with
the line "Send the summary and the actions where they belong." Three parts:

1. **Summary**: a text area holding, to start with, the facts and the notes:
   ```
   Call about <item> (<app>), <date> at <time>, <minutes> minutes.
   With: Ana, Bo, Cy.

   Notes:
   - <each sticky and text on the Space's floors, in reading order, its first line>
   ```
   **Write With AI** (an account, under Ask AI's key rules: the host's key, their team's, or built-in AI's daily
   allowance; [Ask AI](../../../../liveworkspace/docs/specs/020-ask/ask.md)) asks for a summary of the notes, "What was
   decided, the actions with who owns them, and the questions still open", and puts its answer in the text area,
   under the facts, its citations taken out. While it writes, the button reads **Writing…** and the text area is
   read-only; a failure shows its words under the text area and leaves the text as it was. The text stays editable.
2. **Send To**: a knowledgebase, picked from a list of the knowledgebases the host can edit (most recent first), starting on
   the default the index offers (the one connected to the item, else the newest of the item's team). **Send Summary**
   writes the page, "<item title> Call, <date>", and shows **Open Page** in its place once it is written.
3. **Actions**: **Send Actions to Plan** opens Send to Plan with every sticky on the open floor (one card each, at most
   20, as the tab menu's Send Stickies to Plan does). Each card links to its sticky, and to the item.

The dialog closes on **Done**, Escape or the close button; nothing is lost by closing it, and Wrap Up opens it again.

## Who sees what

| Role                                    | The item and Open Item | Invite | Wrap Up |
| --------------------------------------- | ---------------------- | ------ | ------- |
| The host (an Editor of their own Space) | Yes                    | Yes    | Yes     |
| A Participant (an account)              | Yes                    | Yes    | No      |
| A guest                                 | Yes                    | No     | No      |

A Space that is no call, or one opened Offline, in an embed or through the Community, shows none of it.

## Telemetry

`UI·Opened·CallItem` (Open Item), `UI·Created·CallInvite` (invites sent), `UI·Used·CallSummaryAi` (Write With AI),
`UI·Created·CallSummary` (a summary written). Charted in the Calls stack (the platform's "Telemetry").
