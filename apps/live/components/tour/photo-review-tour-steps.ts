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
  body: 'Every sticky found on your wall has a box. Its colour is the kind of note it was read as, and the words under it are what was read.',
  selector: box,
};

const TICK: PhotoReviewTourStep = {
  id: 'tick',
  title: 'Tick What to Keep',
  body: 'Only ticked notes are added. Untick one that is not a sticky, or one already on the board.',
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
  body: 'Press the words to type them again where the handwriting was misread.',
  selector: (api) => (api.boxId === null ? null : `[data-testid="note-words-${api.boxId}"]`),
};

const CORRECT: PhotoReviewTourStep = {
  id: 'correct',
  title: 'Correct a Box',
  body: 'Press a box to select it. Drag it to move it, pull a corner to resize it, pick its kind here, or delete it.',
  selector: () => '[role="toolbar"][aria-label="Correct this box"]',
  prepare: (api) => api.select(api.boxId),
  cleanup: (api) => api.select(null),
};

const DRAW: PhotoReviewTourStep = {
  id: 'draw',
  title: 'Draw One It Missed',
  body: 'Drag across bare photo to draw a box round a sticky that was not found. Its kind comes from the paper’s colour, and its words are read like the rest.',
  target: 'photo-count',
};

const ADD: PhotoReviewTourStep = {
  id: 'add',
  title: 'Add Them to the Board',
  body: 'Puts the ticked notes on the board as a draft, to keep or discard there. Cancel leaves the board as it was.',
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
