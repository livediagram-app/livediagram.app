'use client';

// Register a modal with the shared modal guard (lib/modal-guard) for
// its open lifetime, so the editor's window-level shortcut and paste
// listeners go quiet behind it. The shared Dialog shell calls this for
// every dialog built on it; ad-hoc full-screen modals (TemplatePicker,
// ImagePicker, CanvasThemeDialog, …) must call it themselves — a modal
// that skips it leaks `R`/Backspace/Cmd+V through to the canvas.
// Pass `true` for modals that signal "open" by mounting.

import { useEffect } from 'react';
import { modalClosed, modalOpened } from '@/lib/modal-guard';

export function useModalGuard(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    modalOpened();
    return modalClosed;
  }, [open]);
}
