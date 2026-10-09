// The shape of a guided-tour step, shared by the welcome tour (tour-steps.ts,
// docs/specs/007-editor/editor-tour.md) and the Plan tour (plan-tour-steps.ts,
// docs/specs/026-plan/plan-tour.md). `Api` is the facade each tour's host builds, so a step's prepare
// and cleanup always see fresh editor handlers.
export type TourStepOf<Api> = {
  id: string;
  title: string;
  body: string;
  // data-tour-id of the element the popover anchors to + highlights.
  // Absent (and no `selector`) = no anchor: the card centres itself (the welcome / outro).
  target?: string;
  // A CSS selector for an anchor that has no data-tour-id of its own (a board element, a card on it),
  // resolved through the api when the step runs. Takes precedence over `target`; null = no anchor yet.
  selector?: (api: Api) => string | null;
  // Optional second anchor folded into the highlight rect (union of the
  // two). The dropdown steps use it so the ring wraps the trigger button
  // AND its portalled menu as one region, not the floating menu alone;
  // the tabs step wraps the active pill + the add button the same way.
  alsoHighlight?: string;
  // Centred bookend cards, outside the step count, each with its own
  // illustration and button set: 'welcome' offers the tour (accept /
  // decline, declining is permanent via the done-guard); 'outro' wraps it
  // up (finish + a help-centre link).
  card?: 'welcome' | 'outro';
  // Skip this step entirely on mobile viewports (desktop-only chrome, like
  // the paintbrush dock button).
  mobileSkip?: boolean;
  // Skip this step on an event-storming board (docs/specs/021-event-storming/event-storming.md): the board hides
  // the palette's header band, so its two dropdowns aren't there to point
  // at. Without this the step anchors to a display:none trigger, a ring
  // measuring 0x0 in the top-left corner and a menu opened off-screen.
  boardSkip?: boolean;
  // Runs on entering the step, anchored or not (an anchorless outro can tidy up here).
  prepare?: (api: Api) => void | Promise<void>;
  cleanup?: (api: Api) => void;
};

// Whether a step points at something (otherwise it is a centred card).
export function hasAnchor<Api>(step: TourStepOf<Api>): boolean {
  return step.target !== undefined || step.selector !== undefined;
}

// Telemetry `type` token for a step-viewed event (docs/specs/017-telemetry/telemetry.md: preset tokens
// only, never content; step ids are a fixed catalogue, so deriving is
// safe): ('TourStep', 'selection-modes') → 'TourStepSelectionModes'.
export function stepTelemetryType(prefix: string, stepId: string): string {
  const camel = stepId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `${prefix}${camel}`;
}
