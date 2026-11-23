# Ask AI

Status: built

A question typed in the footer's Tools, answered from the open plan's own words with the places the answer came
from, built once for every app. The platform spec, [Ask AI](../../../../liveworkspace/docs/specs/019-ask/ask.md), is
the source of truth for the tool, what is sent, which AI answers and how the person switches, Sources, built-in AI's
allowance and the route. This spec says only what is liveplanner's own.

## What is read

Every tab's elements that hold words (the ones the Search panel reads), and **every card** that is neither archived nor in the Trash: its number, title, description and status (`lib/ask-cards.ts`), on the tab whose board shows it, or the first tab for a card no board shows. Asking loads the tabs not yet opened, as opening Search does.

## A source opens

A card opens in the item panel, on the tab whose board shows it, as picking it in Search does. Anything else opens its tab with the element selected (**Show in Plan**).

## Suggested questions

- "Summarise this plan"
- "What is in progress right now?"
- "Which cards have no description?"

## Share roles

An **Editor**, a **Participant** and a **Viewer** may each ask once signed in: asking reads the plan and changes
nothing. A guest, and a link visitor who is not signed in, see the row badged Sign In. What is sent is what that
person's editor holds, so a link to one tab asks about that tab alone.

## Where it lives

- `apps/api/src/routes/ask.ts`: `POST /api/ask`, handing the platform's `serveAsk` who is calling, the key lookup,
  the `AI` binding and the count; the room class's `spendAsk` keeps the account's daily count.
- `apps/editor/components/panels/useAskAi.ts`: what the editor hands the tool, called from `ItemToolsHost`.
