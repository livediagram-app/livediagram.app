# The Behaviours family

liveplanner shows no palette, so it has no palette categories or bands. What survives from them is one name the model
uses: the **Behaviours family**, every shape kind whose content arrives at run time rather than being drawn by its
author. They are the ones that do something when pressed and the ones that collect what the room thinks.

## The members

`BEHAVIOUR_SHAPES` in `packages/project/src/behaviour-shapes.ts`:

| Kind             | Spec                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| `portal`         | [Portal element](../009-elements/portal-element.md)                    |
| `session-button` | [Session button](../012-collaboration/session-button.md)               |
| `picker`         | [Picker](../012-collaboration/picker.md)                               |
| `temperature`    | [Temperature check](../012-collaboration/temperature-check.md)         |
| `decision`       | [Participant responses](../012-collaboration/participant-responses.md) |
| `comment-pin`    | [Comment pin](../012-collaboration/comment-pin.md)                     |
| `action-card`    | [Action panel](../012-collaboration/action-panel.md)                   |

`isBehaviourShape(kind)` answers membership.

## What the family decides

- **A Participant never writes a Behaviour's words.** A poll's question or a timer's label is the author's, so
  `participant-content.ts` refuses a Participant's write on any Behaviour someone else added
  ([Share roles](../013-workspace/share-roles.md)).
- **One `…` per card.** `drawsOwnElementMenu(kind)` is true for the session button alone: a Timer's length and a
  Vote's dots are settings changed mid-session, so it draws its own `…` with them in it. `carriesSharedSettingsMenu`
  gives the rest of the family the shared settings `…`, which opens the element's context menu, except the comment
  pin and the action panel, whose actions are all on the card. `ElementFaceRouter` draws the shared one, and the two
  never both render in the same corner.

## Testing

`packages/project/src/behaviour-shapes.test.ts` pins the members and both predicates.
