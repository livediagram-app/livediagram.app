// Linux browsers (Chrome, Firefox) paste the PRIMARY selection when the middle
// button is released, as a plain `paste` event indistinguishable from Ctrl+V.
// The paste runs synchronously in the release's own task, so a flag raised on
// the capture-phase pointerup and lowered on the next macrotask covers exactly
// that paste and nothing after it.

export interface PrimarySelectionPasteWatch {
  isPrimarySelectionPaste: () => boolean;
  dispose: () => void;
}

const MIDDLE_BUTTON = 1;

export function watchPrimarySelectionPaste(target: EventTarget): PrimarySelectionPasteWatch {
  let releasing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onPointerUp = (e: Event) => {
    if ((e as MouseEvent).button !== MIDDLE_BUTTON) return;
    releasing = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      releasing = false;
    }, 0);
  };

  target.addEventListener('pointerup', onPointerUp, true);
  return {
    isPrimarySelectionPaste: () => releasing,
    dispose: () => {
      target.removeEventListener('pointerup', onPointerUp, true);
      clearTimeout(timer);
      releasing = false;
    },
  };
}
