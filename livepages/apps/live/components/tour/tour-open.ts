// A step on a button that opens something (a popover, a menu, a panel) shows what it opens rather than the button alone
// (docs/specs/007-editor/pages-tour.md "Mechanics"): it presses the button as the step starts,
// rings what opened, and presses it again as the step ends, so the person sees the real thing and is left as they were.
import type { TourStepOf } from './tour-step';

// What a press can open, for telling the new one apart from those already on screen.
// A dock panel (Card Types, Layers) counts: it is a floating panel that was not on screen before the press.
const OPENABLE =
  '[role="dialog"], [role="menu"], [data-anchored-popover], [data-menu-flyout], [data-floating-panel]';
const MARK = 'data-tour-opened';
const OPENED = `[${MARK}]`;

// The button that opens it: the anchor itself, or the opening button inside it (a toolbar group, a segment).
function triggerIn(anchor: Element | null): HTMLElement | null {
  if (!anchor) return null;
  if (anchor instanceof HTMLButtonElement) return anchor;
  return (
    anchor.querySelector<HTMLElement>('button[aria-haspopup], button[aria-expanded]') ??
    anchor.querySelector<HTMLElement>('button')
  );
}

function newest(before: ReadonlySet<Element>): Element | null {
  const now = [...document.querySelectorAll(OPENABLE)].filter(
    (el) => !before.has(el) && el.getClientRects().length > 0,
  );
  return now.at(-1) ?? null;
}

// How long a press may take to open what it names, and to open something unnamed, before the step rings its button
// instead. A step waits this long only when nothing opens, so the unnamed wait is kept short.
const CONTROLS_WAIT_MS = 1000;
const NEW_WAIT_MS = 600;

function waitForElement(find: () => Element | null, timeoutMs: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const found = find();
      if ((found && found.getClientRects().length > 0) || performance.now() - started > timeoutMs)
        return resolve(found);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

const waitForNew = (before: ReadonlySet<Element>, timeoutMs: number) =>
  waitForElement(() => newest(before), timeoutMs);

/**
 * `step`, made to open what its button opens: `trigger` finds the button (or what holds it) as the step starts. The
 * step rings what opened, falling back to its own anchor when nothing does. `modal` rings over the dialog layer, for a
 * button that opens a dialog.
 */
export function opensFrom<Api, S extends TourStepOf<Api>>(
  step: S,
  trigger: (api: Api) => string | null,
  options: { modal?: boolean } = {},
): S {
  const own = step.selector ?? (step.target ? () => `[data-tour-id="${step.target}"]` : null);
  let button: HTMLElement | null = null;
  // Whether the step has been left: what is still opening as it ends is closed as it arrives.
  let left = false;
  const close = () => {
    const opened = document.querySelector(OPENED);
    opened?.removeAttribute(MARK);
    // Closed as the person would: by its own Close (a dialog: pressing what opened it opens it again, and Escape is
    // the tour's while it runs), else by pressing the toggle that opened it again; only while it is still open.
    const closeButton = opened?.isConnected
      ? opened.querySelector<HTMLElement>('button[aria-label^="Close"]')
      : null;
    if (closeButton) closeButton.click();
    else if (button && (button.getAttribute('aria-expanded') === 'true' || opened?.isConnected)) {
      button.click();
    }
    button = null;
  };
  return {
    ...step,
    ...(options.modal ? { layer: 'modal' as const } : {}),
    // What opened, else the step's own anchor; with neither, nothing (the step is skipped, not ringed on nothing).
    selector: (api) => (document.querySelector(OPENED) ? OPENED : (own?.(api) ?? null)),
    prepare: async (api) => {
      left = false;
      await step.prepare?.(api);
      for (const el of document.querySelectorAll(OPENED)) el.removeAttribute(MARK);
      const at = trigger(api);
      button = at ? triggerIn(document.querySelector(at)) : null;
      if (!button) return;
      const before = new Set(document.querySelectorAll(OPENABLE));
      if (button.getAttribute('aria-expanded') !== 'true') button.click();
      // What it opens, by the id it names (aria-controls: the Draw dock's flyouts), else the newest popover or menu.
      const controls = button.getAttribute('aria-controls');
      const opened = controls
        ? await waitForElement(() => document.getElementById(controls), CONTROLS_WAIT_MS)
        : await waitForNew(before, NEW_WAIT_MS);
      opened?.setAttribute(MARK, '');
      // What it opened is shown, not handed the keyboard: a flyout that focuses its own search field kept the tour's
      // arrows for itself, and Next seemed to repeat the step (the Draw tour's Shapes).
      const focused = document.activeElement;
      if (opened && focused instanceof HTMLElement && opened.contains(focused)) focused.blur();
      if (left) close();
    },
    cleanup: (api) => {
      left = true;
      close();
      step.cleanup?.(api);
    },
  };
}
