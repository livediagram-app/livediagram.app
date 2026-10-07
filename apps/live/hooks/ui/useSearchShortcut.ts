'use client';

import { useEffect } from 'react';
import { anyModalOpen } from '@/lib/modal-guard';
import { useLatest } from './useLatest';
import { useShortcutsEnabled } from './useShortcutsEnabled';

// The Search panel's shortcut, Cmd/Ctrl+K or Cmd/Ctrl+. (docs/specs/007-editor/command-palette.md
// "Shortcut"), for surfaces outside the editor. The editor binds the same chords inside its own
// shortcut table (hooks/canvas/editor-shortcut-keys.ts); this hook is the Explorer page's.
// Like the editor it stands down when the Keyboard Shortcuts setting is off, while typing in a
// text field (the editor's chords skip text fields too), and while a dialog is open.

export function isSearchChord(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  return e.key === '.' || e.key.toLowerCase() === 'k';
}

function isTextTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function useSearchShortcut(onOpenSearch: () => void): void {
  const { enabled } = useShortcutsEnabled();
  const open = useLatest(onOpenSearch);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isSearchChord(e)) return;
      if (isTextTarget(e.target) || anyModalOpen()) return;
      e.preventDefault();
      open.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, open]);
}
