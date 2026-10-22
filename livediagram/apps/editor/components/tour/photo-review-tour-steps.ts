// The steps of Show Me in the photo import review (docs/specs/021-event-storming/event-storming.md "Show Me"): a tour
// of checking what was found on the wall, run on the review itself. The box steps point at the first box found, and
// every control stays usable, so the person can untick, retype or redraw while the step is up.
import type { TourStepOf } from './tour-step';

export type PhotoReviewTourApi = {
  // The box the box steps point at: the first one on the photo when the tour started.
  boxId: number | null;
  // Selects a box (null lets go), as pressing it does, so its correcting toolbar shows.
  select: (id: number | null) => void;
};

type PhotoReviewTourStep = TourStepOf<PhotoReviewTourApi>;

const box = (api: PhotoReviewTourApi) =>
  api.boxId === null ? null : `[data-testid="note-box-${api.boxId}"]`;

const BOX: PhotoReviewTourStep = {
  id: 'box',
  title: 'Each Box Is a Note',
  body: 'Each sticky found has a box, with the words that were read.',
  selector: box,
};

const TICK: PhotoReviewTourStep = {
  id: 'tick',
  title: 'Tick What to Keep',
  body: 'Untick any you do not want added.',
  selector: (api) => {
    const b = box(api);
    return b && `${b} [role="checkbox"]`;
  },
  // A selected box's tick moves into its correcting toolbar, so the box is let go of first: the tick is back on its
  // corner for the ring to find.
  prepare: (api) => api.select(null),
};

const WORDS: PhotoReviewTourStep = {
  id: 'words',
  title: 'Fix the Words',
  body: 'Press the words to fix any misread handwriting.',
  selector: (api) => (api.boxId === null ? null : `[data-testid="note-words-${api.boxId}"]`),
};

const CORRECT: PhotoReviewTourStep = {
  id: 'correct',
  title: 'Correct a Box',
  body: 'Press a box to move, resize, recolour or delete it.',
  selector: () => '[role="toolbar"][aria-label="Correct this box"]',
  prepare: (api) => api.select(api.boxId),
  cleanup: (api) => api.select(null),
};

const DRAW: PhotoReviewTourStep = {
  id: 'draw',
  title: 'Draw One It Missed',
  body: 'Missed one? Drag a box round it.',
  target: 'photo-count',
};

const ADD: PhotoReviewTourStep = {
  id: 'add',
  title: 'Add Them to the Board',
  body: 'Adds the ticked notes to the board. You can still keep or discard them there.',
  target: 'photo-add',
};

const OUTRO: PhotoReviewTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is the Review',
  body: 'Show Me is here every time you import a photo of the wall.',
};

// The steps for this photo: the box steps only when something was found.
export function photoReviewTourSteps(hasBoxes: boolean): PhotoReviewTourStep[] {
  return [...(hasBoxes ? [BOX, TICK, WORDS, CORRECT] : []), DRAW, ADD, OUTRO];
}
