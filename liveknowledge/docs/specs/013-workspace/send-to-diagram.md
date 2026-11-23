# Send to Diagram

What liveknowledge sends with [Send to Diagram](../../../../liveworkspace/docs/specs/004-index/send-to-diagram.md)
(Work Tracker 1393), where its entries sit, which AI drafts the diagram, and who may use it. The picker, the graph, the
diagram and the limits on it are the platform's; this file says only what is liveknowledge's own.

## What it sends

The same words [Send to Plan](send-to-plan.md) sends, from the same places, each entry right after Send to Plan's:

- **The text toolbar**, while a text element is edited: the words picked, or the whole text.
- **The page toolbar**, after Send to Plan: the words picked in the page's writing, or with only the caret there, its
  whole paragraph, list item or checklist item.
- **The reader's pills**: someone who reads the writing but cannot write in it picks words, and **Send to Diagram**
  shows beside **Send to Plan** under them.

Send to Plan wears liveplanner's logo and Send to Diagram livediagram's, on every entry and pill (owner, 2026-11-23).

The diagram is named after the page ("Onboarding diagram"), and its caption reads "From <knowledgebase>, <page>",
linking back to the block the words start in (`#t=<tab>&el=<block>`).

## The draft

`POST /api/documents/<id>/pages/<tab>/describe-diagram` `{words, kind}` answers `{graph, provider}`: the words read as a
graph on this knowledgebase's AI, in the order Ask uses ([search-and-ask.md "Which key
answers"](../030-knowledgebase/search-and-ask.md#which-key-answers)): the knowledgebase's own key, its team's, the
person's own, else built-in AI (Workers AI, the model Describe Structure asks). So a person or team whose own AI key is
set has their key answer first, as their primary; without one, built-in AI answers. Nothing is written: the editor hands
the graph to the index.

- **The model is told** the kind asked for, the page's title and the words, fenced as material, never instructions; its
  reply is read strictly (`parseDiagramDraft`, then the platform's `readDiagramSendGraph`) and placed only as labels.
  A chosen kind's layout wins over the model's. On built-in AI a reply that does not read is asked once more with fixed
  words for why.
- **Who**: a signed-in person, in person, who can read the knowledgebase (any role). An API token, a guest or a visitor
  without an account is refused, since it spends a key or built-in AI.
- **Limits**: 20 drafts a person an hour and 100 a knowledgebase a day (the room's counters, `diagram:` scopes); on
  built-in AI, 10 a person a UTC day wherever they ask (`~send-to-diagram:` count). Words over 8,000 characters are
  refused before anything is asked.
- **Refusals** are fixed words: no words, too many words, a limit, built-in AI not set up or unable to answer, "The AI
  couldn't find a diagram in these words", or the provider's failure kind (`modelFailureWords`).

## Who sees it

| Role                             | Entry                                             |
| -------------------------------- | ------------------------------------------------- |
| Editor, Participant              | Text toolbar, page toolbar                        |
| Viewer                           | The pill beside Send to Plan's under words picked |
| Guest, Offline, embed, Community | None (the platform's "Who may send")              |

## Telemetry

The platform's Send to Diagram events (`UI·Opened·SendToDiagram`, `UI·Created·SendToDiagram`,
`UI·Refused·SendToDiagram`), charted as the Send to Diagram stack beside Send to Plan's.
