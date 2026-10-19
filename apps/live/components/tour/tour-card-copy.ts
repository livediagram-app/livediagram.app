// The bookend cards' words, so a second tour (the Plan tour, docs/specs/026-plan/plan-tour.md) wears the
// same card with its own eyebrow and help link. The defaults are the Diagram tour's; every mode tour finishes on
// the same plain Start (docs/specs/007-editor/editor-tour.md "The bookend cards ask nothing of the editor").
export type TourCardCopy = {
  welcomeEyebrow: string;
  accept: string;
  decline: string;
  outroEyebrow: string;
  helpHref: string;
  finish: string;
};

// A welcome card offering more than one way in (the Plan tour's Boards and Spreadsheets): each starts the tour
// its own way, in place of the single accept button.
export type TourWelcomeChoice = { id: string; label: string; onPick: () => void };

// The last card's button on every mode tour; an element tour's and Show Me's read Done.
export const TOUR_FINISH = 'Start';

export const WELCOME_TOUR_COPY: TourCardCopy = {
  welcomeEyebrow: 'Diagram tour',
  accept: 'Yes',
  decline: 'No',
  outroEyebrow: 'Tour complete',
  helpHref: '/help',
  finish: TOUR_FINISH,
};
