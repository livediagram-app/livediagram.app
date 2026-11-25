# Ask AI

Status: built

A question typed in the footer's Tools, answered from the open Space's own words with the places the answer came
from, built once for every app. The platform spec, [Ask AI](../../../../liveworkspace/docs/specs/020-ask/ask.md), is
the source of truth for the tool, what is sent, which AI answers and how the person switches, Sources, built-in AI's
allowance and the route. This spec says only what is livehuddle's own.

## What is read

Every tab's elements that hold words, the ones the Search panel reads: an element's label and a table's cells. Asking loads the tabs not yet opened, as opening Search does.

## A source opens

Its tab, with the element selected (**Show in Space**).

## Suggested questions

- "Summarise this space"
- "What is written on the boards?"
- "What is still to be decided?"

## Sending an answer on

Every finished answer ends with **Send to Plan** and **Send to Knowledge Base** under its footer, above the question
box ([Ask AI](../../../../liveworkspace/docs/specs/020-ask/ask.md) "Sending an answer on"; Work Tracker 1433). Send to
Plan makes a card of each listed item of the answer, every title editable first (an answer with no list makes one
card); Send to Knowledge Base adds the answer as written, the question its heading, with no AI pass and no AI credit.
Both link back to this Space. An **Editor**, a **Participant** and a **Viewer** see them once signed in, in the
cloud; an embed, Offline and a Community copy show neither.

## Share roles

An **Editor**, a **Participant** and a **Viewer** may each ask once signed in: asking reads the Space and changes
nothing. A guest, and a link visitor who is not signed in, see the row badged Sign In. What is sent is what that
person's editor holds, so a link to one tab asks about that tab alone.

With Pro on, a built-in question spends **1 AI credit** ([Ask AI](../../../../liveworkspace/docs/specs/020-ask/ask.md)
"AI credits"): an Editor's and a Participant's from the Space's owner (its team's for a team's Space), a Viewer's
from their own month. A question on a key spends none, and with Pro off nothing is counted or asked.

## Where it lives

- `apps/api/src/routes/ask.ts`: `POST /api/ask`, handing the platform's `serveAsk` who is calling, the key lookup,
  the `AI` binding, the count and, with Pro on, the AI credits (`askCreditsOf`); the room class's `spendAsk` keeps the account's daily count.
- `apps/editor/components/panels/useAskAi.ts`: what the editor hands the tool, called from `ItemToolsHost`.
