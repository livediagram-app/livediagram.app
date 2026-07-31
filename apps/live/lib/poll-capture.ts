// Keeping a poll's results (spec/126): turn an ending poll into an ordinary
// canvas element, so the one number the session produced doesn't vanish with
// the panel.
//
// Pure, so the mapping is testable without a room or a canvas. Nothing here
// changes the poll's ephemerality: it runs only when the host presses
// "End & keep results", from tallies already in their own memory.

import { pollOptionTokens, tallyPoll, type LivePoll } from '@livediagram/api-schema';
import { createShape, type ShapeElement } from '@livediagram/diagram';

// A token poll becomes a BAR CHART; a free-text poll becomes an opened IDEA
// BOX. Neither is a new element kind, which is the point (spec/126): the
// tallies ARE a labelled dataset and the free-text answers ARE a set of
// anonymous submissions, and both of those already render, theme, export and
// edit. A bespoke "poll result" kind would rebuild every one of those paths to
// show the same bars.
export function pollResultElement(
  poll: LivePoll,
  answers: Map<string, string | null>,
  x: number,
  y: number,
): ShapeElement {
  const results = tallyPoll(poll, answers);
  const question = poll.question.trim();

  if (poll.style === 'text') {
    const element = createShape('idea-box', x, y);
    return {
      ...element,
      label: question,
      // Already open: the room has just read these answers out loud, so a box
      // that arrives closed would be hiding what everyone has already seen.
      ideaCards: results.textAnswers,
      ideasRevealed: true,
    };
  }

  const tokens = pollOptionTokens(poll);
  const element = createShape('bar-chart', x, y);
  return {
    ...element,
    label: question,
    // Options nobody picked are KEPT at zero, because "nobody chose C" is a
    // result — dropping the empty bars would quietly rewrite the finding.
    pieSlices: tokens.map((token) => ({
      label: token,
      value: results.rows.find((r) => r.token === token)?.count ?? 0,
    })),
  };
}
