// Collaborate-category illustrations (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md and
// docs/specs/012-collaboration/comment-pin.md): the palette's Collaborate groups, plus one scene per element that
// collects what the room thinks: estimate card, temperature check, idea box,
// agenda, decision record and roll call. (The comment and action panels live in
// palette-collab-panels.tsx, the Q&A board in palette-qa-board.tsx.)
//
// One scene per sub-article, drawn as the card really looks: a titled panel
// with its caption on the right, and the card's one action as the dashed
// accent bar the Q&A board introduced.
//
// This entry keeps the category scene and re-exports the rest: the card chrome from
// palette-collaborate-card.tsx, the scenes from palette-collaborate-ask.tsx and
// palette-collaborate-record.tsx.

import { CollaborateCategories as CategoryPicker } from './palette-behaviour';

export { CollabCard } from './palette-collaborate-card';
export { EstimateCard, TemperatureCheckCard, IdeaBoxCard } from './palette-collaborate-ask';
export {
  AgendaCard,
  DecisionRecordCard,
  RollCallCard,
  QuizRoundCard,
} from './palette-collaborate-record';

// --- Scenes ------------------------------------------------------------------

/** Workshop mode's Collaborate band in the category picker: the six Collaborate
 *  categories. Ask and Record hold the elements that collect what the room thinks,
 *  so they are the two drawn lit. */
export function CollaborateCategories() {
  return <CategoryPicker lit={['Ask', 'Record']} />;
}
