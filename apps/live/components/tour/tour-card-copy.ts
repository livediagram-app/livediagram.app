// The words every tour shares (docs/specs/007-editor/coach-dock.md).

// An offer with more than one way in (the Plan tour's Boards and Spreadsheets): each starts the tour its own way, in
// place of Take the Tour.
export type TourWelcomeChoice = { id: string; label: string; onPick: () => void };

// The closing's button on every mode tour and the Pages tour; an element tour's and Show Me's read Done.
export const TOUR_FINISH = 'Start';
