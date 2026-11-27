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
//
// An insertion effect (useHeadStyle), not an effect: the <style> lands in the commit that first draws the editor, before the browser
// paints, so the editor never shows a frame in the built-in colours on its way to its theme (liveknowledge Work
// Tracker 1521, docs/specs/030-knowledgebase/page-surface.md "Themed from the first frame"). A theme change swaps it
// in the same frame too.

import { useInsertionEffect, useMemo } from 'react';
import { editorAccentCss } from './editor-accent';

const STYLE_ID = 'lvd-editor-accent';

/** Keeps one `<style id={id}>` in the head holding `css`, or none while `css` is null; gone when the caller unmounts.
 *  An insertion effect, so it lands before any layout effect of the same commit reads a computed style (liveknowledge
 *  Work Tracker 1521, page-surface.md "Themed from the first frame"). A change rewrites the element in place, never
 *  removes and re-adds it: a switch from one knowledgebase to another mounts new buttons in the same commit, and a
 *  style first computed in the gap between the two took the built-in colours and then animated (`transition-colors`)
 *  from them into the theme. */
export function useHeadStyle(id: string, css: string | null): void {
  useInsertionEffect(() => {
    if (css === null) {
      document.getElementById(id)?.remove();
      return;
    }
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
  }, [id, css]);
  // Removed on unmount only. The next editor's own insertion effect, in the same mutation phase, puts its style back
  // before anything reads layout.
  useInsertionEffect(() => () => document.getElementById(id)?.remove(), [id]);
}

/** Tints the chrome with `accent`, the active tab's theme stroke; null leaves the built-in brand and the
 *  dark palette in place (the "brand"/Default theme and an unthemed tab have no accent stroke). */
export function useEditorAccentStroke(accent: string | null): void {
  useHeadStyle(
    STYLE_ID,
    useMemo(() => (accent ? editorAccentCss(accent) : null), [accent]),
  );
}
