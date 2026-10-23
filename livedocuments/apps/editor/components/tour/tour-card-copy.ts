// The bookend cards' words, so each tour (the Pages tour, docs/specs/007-editor/pages-tour.md) wears the same card
// with its own eyebrow and help link; every tour finishes on the same plain Start
// (docs/specs/007-editor/pages-tour.md "The steps").
export type TourCardCopy = {
  welcomeEyebrow: string;
  accept: string;
  decline: string;
  outroEyebrow: string;
  helpHref: string;
  finish: string;
};

// The last card's button on every mode tour; an element tour's and Show Me's read Done.
export const TOUR_FINISH = 'Start';

export const WELCOME_TOUR_COPY: TourCardCopy = {
  welcomeEyebrow: 'Tour',
  accept: 'Yes',
  decline: 'No',
  outroEyebrow: 'Tour complete',
  helpHref: '/help',
  finish: TOUR_FINISH,
};
