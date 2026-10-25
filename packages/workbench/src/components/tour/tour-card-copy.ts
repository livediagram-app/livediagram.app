// The last card's words (docs/specs/007-editor/editor-tour.md "The last card"), so each tour finishes on its own
// eyebrow and help link. Every mode tour finishes on the same plain Start; an element tour's and Show Me's read Done.
export type TourCardCopy = {
  outroEyebrow: string;
  helpHref: string;
  finish: string;
};

// The last card's button on every mode tour; an element tour's and Show Me's read Done.
export const TOUR_FINISH = 'Start';

export const TOUR_CARD_COPY: TourCardCopy = {
  outroEyebrow: 'Tour complete',
  helpHref: '/help',
  finish: TOUR_FINISH,
};
