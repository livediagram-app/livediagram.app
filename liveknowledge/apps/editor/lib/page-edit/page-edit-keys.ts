// The keys of read and edit mode (docs/specs/030-knowledgebase/blueprints/editing.md "Presentation and UX"): E while
// reading is Edit, Mod-S while editing is Save (never the browser's Save Page), Escape while editing is Cancel. A key
// someone else took (a menu, a dialog, the writing's own Escape) is theirs. Pure: an event in, the action out.

export type PageEditKey = 'edit' | 'save' | 'cancel';

type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'repeat' | 'defaultPrevented' | 'target'
>;

// Typing somewhere: a field, an editable region (the writing), a select.
function typingIn(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  return (
    el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null
  );
}

// A dialog, a menu or the drawing palette's flyout (its tiles, `data-flyout-item`) is open: its keys are its own.
// Escape closing the flyout once asked to discard the page too.
export function overlayOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-flyout-item]',
    ) !== null
  );
}

/** What a key press does to the mode, or null for nothing. */
export function pageEditKeyAction(
  e: KeyEventLike,
  // `overlayAtKeyDown`: whether an overlay was open as the key went down (read in the window's capture phase), since
  // the flyout's own Escape closes it before this handler, on the window's bubble, sees the key.
  state: { editing: boolean; mayEdit: boolean; overlayAtKeyDown?: boolean },
): PageEditKey | null {
  if (e.defaultPrevented || !state.mayEdit) return null;
  const mod = e.metaKey || e.ctrlKey;
  if (state.editing && mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's')
    return 'save';
  if (state.editing && e.key === 'Escape' && !mod && !state.overlayAtKeyDown && !overlayOpen())
    return 'cancel';
  if (
    !state.editing &&
    !mod &&
    !e.altKey &&
    !e.shiftKey &&
    !e.repeat &&
    e.key.toLowerCase() === 'e' &&
    !typingIn(e.target) &&
    !overlayOpen()
  )
    return 'edit';
  return null;
}
