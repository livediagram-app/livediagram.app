'use client';

// Make the editor chrome follow the ACTIVE TAB's theme (docs/specs/011-theme/canvas-and-theme-dialog.md), two ways:
//   1. The brand-* accent (buttons, rings, focus) is retargeted to the theme's
//      accent — in BOTH light and dark mode.
//   2. In DARK mode, the slate surfaces (panels, borders, deep backgrounds)
//      become a darker, muted version of the theme hue, so dark mode reads as a
//      dark version of the chosen theme.
//
// Both palettes are Tailwind v4 CSS variables (--color-brand-*, --color-slate-*),
// so we just retarget those variables. We inject ONE <style> element rather than
// inline styles so the slate override can be scoped to `.dark` (CSS handles the
// mode switch — no JS mode detection) and so body-portaled UI (menus, dialogs,
// popovers, toasts) inherits both. It's removed on unmount / when the tab is
// unthemed, so the built-in brand and the dark palette stand elsewhere. The CSS
// itself is editorAccentCss (editor-accent.ts).

import { useEffect } from 'react';
import { getTheme } from '@/lib/themes';
import { editorAccentCss } from './editor-accent';

const STYLE_ID = 'lvd-editor-accent';

export function useEditorAccent(themeId: string | undefined): void {
  // The "brand"/Default theme (and an unthemed tab) has no accent stroke,
  // so we leave the built-in brand and the dark palette in place.
  const accent = (themeId ? getTheme(themeId) : null)?.elementStroke ?? null;

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
