# Suggestions: Add to Knowledgebase

The livedocuments side of [Suggestions](../../../../liveworkspace/docs/specs/016-notifications/suggestions.md) (Work Tracker 1371): one suggestion, offered in the editor's notice slot under
the platform's rules (one at a time, never mid-gesture, once an item, Don't Suggest This Again, one switch in Settings ›
Getting Started).

An article that explains a process belongs in the team's knowledgebase; livedocuments offers to add it.

## Trigger

Checked on the open tab's first article when idle (`lib/process-article.ts`, `explainsProcess`), any of:

- a run of 3 or more (`PROCESS_STEPS_MIN`) numbered list items at the top level;
- 3 or more headings starting "Step";
- a heading starting "How to", "How we" or "How do", followed by a run of 3 or more list items.

"This article reads like a process. Add it to <knowledgebase> as a page, so the team can find it."

## One click

**Add Page** writes the article as Markdown to a page through the index's
[Write It Up](../../../../liveworkspace/docs/specs/004-index/write-up.md) door, in the default knowledgebase, ending
with a line back to the article (no share code). A toast says where, with **Open Page**. Nothing is moved: the article
stays.

## Who

An Editor of the article, signed in, not in an embed, Offline or a Community copy (`maySuggestTo`). Never a Participant
or a Viewer.

## Code

`components/canvas/article/AddToKnowledgebaseSuggestion.tsx`, mounted in the editor; telemetry
`UI·*·SuggestAddToKnowledgebase`.
