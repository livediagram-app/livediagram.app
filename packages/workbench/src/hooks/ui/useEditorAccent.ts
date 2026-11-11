'use client';

// Make the editor chrome follow the ACTIVE TAB's theme (docs/specs/011-theme/canvas-and-theme-dialog.md), two ways:
//   1. The brand-* accent (buttons, rings, focus) is retargeted to the theme's
//      accent, in BOTH light and dark mode.
//   2. In DARK mode, the slate surfaces (panels, borders, deep backgrounds)
//      become a darker, muted version of the theme hue, so dark mode reads as a
//      dark version of the chosen theme.
//
// Both palettes are Tailwind v4 CSS variables (--color-brand-*, --color-slate-*),
// so we just retarget those variables. We inject ONE <style> element rather than
// inline styles so the slate override can be scoped to `.dark` (CSS handles the
// mode switch, no JS mode detection) and so body-portaled UI (menus, dialogs,
// popovers, toasts) inherits both. It's removed on unmount / when the tab is
// unthemed, so the built-in brand and the dark palette stand elsewhere. The CSS
// itself is editorAccentCss (editor-accent.ts).
//
// Each editor's hooks/ui/useEditorAccent.ts resolves the tab's theme in its own catalogue and hands the
// accent stroke here.

import { useEffect } from 'react';
import { editorAccentCss } from './editor-accent';

const STYLE_ID = 'lvd-editor-accent';

/** Tints the chrome with `accent`, the active tab's theme stroke; null leaves the built-in brand and the
 *  dark palette in place (the "brand"/Default theme and an unthemed tab have no accent stroke). */
export function useEditorAccentStroke(accent: string | null): void {
  useEffect(() => {
    if (!accent) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    const css = editorAccentCss(accent);

    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [accent]);
}
