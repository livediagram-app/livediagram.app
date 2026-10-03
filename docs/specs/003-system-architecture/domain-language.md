# Domain language: mode, kind and template

Three words describe how a document and its tabs differ. They answer different questions and are never
interchangeable. These are design decisions, taken before any feature that uses them.

| Term         | Answers                        | Values                                                      | Where it lives                     |
| ------------ | ------------------------------ | ----------------------------------------------------------- | ---------------------------------- |
| **mode**     | How is a tab worked on?        | Diagram, Draw (`EditorMode`; more modes may come)           | Per person, per tab; `Tab.opensIn` |
| **kind**     | What is a tab?                 | the general diagram tab, or Event Storming (`TabKind`)      | `Tab.kind`                         |
| **template** | What was a document made from? | a template (`TemplateKind`), grouped into template families | Captured once, at creation         |

## Mode

- An **editor mode** is how a person works on a general tab right now: Diagram or Draw.
  (the Editor modes spec in 007-editor).
- A mode is never a type of document or tab. Switching mode changes no content and nothing for anyone else.
- A tab stores the mode it **opens in**. "Opens in" is a choice among modes, not a binary, so a new mode needs no
  new concept.
- Whiteboarding is Draw mode. There is no whiteboard tab kind and no whiteboard document type.

## Kind

- A **tab kind** is what a tab is. It is reserved for boards that do not follow the homogeneous environment of the
  general diagram tab, with their own notation, rules and data.
- The general diagram tab is the default kind. **Event Storming** is the only other kind.
- A new kind is added only when no mode can serve the use.
- "Board type" means a kind. It never names a template or a mode.

## Template

- A **template** is what a document was made from. It shapes the starting content of a general diagram tab and
  then has no further hold on it.
- Templates group into **template families** where a family is meaningful to people, for example Retrospectives
  (several retrospective formats) and Kanban boards.
- A template or a template family is never a kind or a type: a retrospective is a general diagram tab made from a
  retrospective template.

## Using the three together

- **Default folders** are keyed in the order kind, template family, then mode ([Default folders](../013-workspace/default-folders.md)).
- **Explorer filters** offer them as separate chips: Opens in (mode), Kind and Template ([Explorer filters](../013-workspace/explorer-filters.md)).
- Code, copy and specs use these words only in these meanings.
