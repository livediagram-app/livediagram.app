// Typing ahead of a new card's panel (docs/specs/026-plan/plan-board.md "A card just made opens at once"): a card
// chosen from Add Card opens its panel a moment later, and its title takes focus a frame after that. Keys typed in
// between would land on the board (and its shortcuts), so the first word of a fast typist's title was lost. Armed
// when the card is made (openNewItem), this holds those keys and hands them to the title when it takes focus
// (ItemPanel useTitleFocus). Blueprint: docs/specs/026-plan/blueprints/plan-board.md "Typing ahead".

// How long it holds keys with no title to take them: past this, it lets go (the panel never opened).
export const FRESH_TITLE_KEYS_MS = 2000;

type Armed = { typed: () => string; stop: () => void };
let armed: Armed | null = null;

// A text field already has the typing: someone else took it.
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

// Start holding keys (again: a second new card starts afresh).
export function armFreshTitleKeys(win: Window = window): void {
  disarm();
  let buffer = '';
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (
      isTextField(e.target) ||
      e.isComposing ||
      e.key === 'Process' ||
      e.key === 'Dead' ||
      e.key === 'Escape'
    ) {
      disarm();
      return;
    }
    if (e.key === 'Backspace') {
      if (buffer === '') return;
      buffer = buffer.slice(0, -1);
    } else if (e.key.length === 1) {
      buffer += e.key;
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  win.addEventListener('keydown', onKeyDown, true);
  const timer = setTimeout(disarm, FRESH_TITLE_KEYS_MS);
  armed = {
    typed: () => buffer,
    stop: () => {
      win.removeEventListener('keydown', onKeyDown, true);
      clearTimeout(timer);
    },
  };
}

function disarm(): void {
  armed?.stop();
  armed = null;
}

// What was typed while it held keys ('' when nothing, or not armed); it stops holding them.
export function takeFreshTitleKeys(): string {
  const typed = armed?.typed() ?? '';
  disarm();
  return typed;
}

// Put typed-ahead text in the title field as typing would: through the native setter and an input event, so the
// field's onChange takes it (React tracks the value it set, so a plain `.value =` would be missed), caret at its end.
export function typeIntoField(field: HTMLInputElement | HTMLTextAreaElement, typed: string): void {
  // A field's limit holds for typing ahead too.
  const text = field.maxLength > 0 ? typed.slice(0, field.maxLength) : typed;
  const proto =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.setSelectionRange(text.length, text.length);
}
