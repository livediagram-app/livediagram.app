// The bookend cards' words, so a second tour (the Plan tour, docs/specs/026-plan/plan-tour.md) wears the
// same card with its own eyebrow, finish button and help link. The defaults are the Diagram tour's.
export type TourCardCopy = {
  welcomeEyebrow: string;
  accept: string;
  decline: string;
  outroEyebrow: string;
  helpHref: string;
  helpLabel: string;
  finish: string;
};

// A welcome card offering more than one way in (the Plan tour's Boards and Spreadsheets): each starts the tour
// its own way, in place of the single accept button.
export type TourWelcomeChoice = { id: string; label: string; onPick: () => void };

export const WELCOME_TOUR_COPY: TourCardCopy = {
  welcomeEyebrow: 'Diagram tour',
  accept: 'Yes',
  decline: 'No',
  outroEyebrow: 'Tour complete',
  helpHref: '/help',
  helpLabel: 'Visit Help Centre',
  finish: 'Start diagramming',
};
