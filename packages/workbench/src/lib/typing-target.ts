// Whether a key or paste event's target is somewhere the person is typing: a text field, a
// textarea, a contentEditable label or note, or (by default) a <select>, whose letter presses are
// the browser's type-ahead. Canvas shortcuts and pastes stand aside for all of them.

export function isTypingTarget(
  target: EventTarget | null,
  { select = true }: { select?: boolean } = {},
): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (select && target instanceof HTMLSelectElement) ||
    (target instanceof HTMLElement && target.isContentEditable === true)
  );
}

// An empty text box that hands Cmd/Ctrl+Z and redo to the editor (docs/specs/007-editor/start-diagramming.md "Undo and
// redo reach the editor through an empty search"): it opts in with `data-editor-history`, and only while empty, since a
// box holding text has typing of its own to undo.
export function passesHistoryChords(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement &&
    target.dataset.editorHistory !== undefined &&
    target.value === ''
  );
}

// The search chords (Cmd/Ctrl+K and Cmd/Ctrl+.) pass a start search on to the editor whatever it holds (each product's
// start spec, "The search chords reach the editor from the start's search"): the box has no chord of its own for them,
// and it takes focus as a new tab's start opens, where they once did nothing.
export function passesSearchChords(
  e: Pick<KeyboardEvent, 'key'>,
  target: EventTarget | null,
): boolean {
  return (
    (e.key === '.' || e.key.toLowerCase() === 'k') &&
    target instanceof HTMLInputElement &&
    target.dataset.editorHistory !== undefined
  );
}

// Controls Enter acts on itself: a button or link, a widget role, and anything inside a menu, a popover or the tour's
// card. A shortcut claiming Enter stands aside for these, or the control under the focus would never fire.
const ENTER_ACTIVATED = [
  'button',
  'a[href]',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[data-menu-surface]',
  '[data-anchored-popover]',
  '[data-tour-popover]',
].join(',');

export function isEnterActivatedTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(ENTER_ACTIVATED) !== null;
}
