# Ask AI

Status: built

A question typed in the footer's Tools, answered from the open design's own words with the places the answer came
from, built once for every app. The platform spec, [Ask AI](../../../../liveworkspace/docs/specs/019-ask/ask.md), is
the source of truth for the tool, what is sent, which AI answers and how the person switches, Sources, built-in AI's
allowance and the route. This spec says only what is livedesign's own.

## What is read

Every tab's elements that hold words, the ones the Search panel reads: an element's label and a table's cells. Asking loads the tabs not yet opened, as opening Search does.

## A source opens

Its tab, with the element selected (**Show in Design**).

## Suggested questions

- "Summarise this design"
- "What does the copy say?"
- "Which pages mention a price or a date?"

## Share roles

An **Editor**, a **Participant** and a **Viewer** may each ask once signed in: asking reads the design and changes
nothing. A guest, and a link visitor who is not signed in, see the row badged Sign In. What is sent is what that
person's editor holds, so a link to one tab asks about that tab alone.

## Where it lives

- `apps/api/src/routes/ask.ts`: `POST /api/ask`, handing the platform's `serveAsk` who is calling, the key lookup,
  the `AI` binding and the count; the room class's `spendAsk` keeps the account's daily count.
- `apps/live/components/panels/useAskAi.ts`: what the editor hands the tool, called from `ItemToolsHost`.
