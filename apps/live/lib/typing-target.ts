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
