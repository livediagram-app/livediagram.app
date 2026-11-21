'use client';

// The editor chrome follows the knowledgebase's theme (docs/specs/030-knowledgebase/page-surface.md "The chrome
// follows the theme"; docs/specs/011-theme/canvas-and-theme-dialog.md "Editor chrome follows the active theme"):
// the hook is @liveworkspace/workbench's, handed the accent the knowledgebase's theme resolves to. The product's
// own theme hands it nothing, so the built-in lime ramp stands.
//
// The light appearance follows it too (owner, 2026-11-21: "in light mode the style isn't applying background
// colours, everything stays white"): the shared hook tints only the dark surfaces, so liveknowledge adds its own
// light ground, a pale wash of the theme's accent over the white ground and the palest slate surfaces, in one
// <style> scoped to the light appearance. Text greys (slate-300 and darker) stay neutral and legible.
import { useEffect } from 'react';
import { mixHex } from '@liveworkspace/model-core/color-wash';
import { useEditorAccentStroke } from '@liveworkspace/workbench/hooks/ui/useEditorAccent';
import { knowledgeChromeAccent } from '@/lib/knowledge-style/knowledge-accent';

const LIGHT_STYLE_ID = 'lk-light-ground';

/** The light appearance's ground and palest surfaces under a theme's accent: white and slate-50/100/200 washed with
 *  the accent, pale enough that every text colour keeps its contrast. */
export function knowledgeLightGroundCss(accent: string): string {
  const ground = mixHex('#ffffff', accent, 0.94);
  const slate50 = mixHex('#f8fafc', accent, 0.9);
  const slate100 = mixHex('#f1f5f9', accent, 0.88);
  const slate200 = mixHex('#e2e8f0', accent, 0.86);
  return (
    `html:root:not(.dark){--color-white:${ground};--color-slate-50:${slate50};` +
    `--color-slate-100:${slate100};--color-slate-200:${slate200};}` +
    `html:root:not(.dark) [data-canvas-root]{background-color:var(--color-white) !important;}`
  );
}

export function useEditorAccent(themeId: string | undefined): void {
  const accent = knowledgeChromeAccent(themeId);
  useEditorAccentStroke(accent);
  useEffect(() => {
    if (!accent) {
      document.getElementById(LIGHT_STYLE_ID)?.remove();
      return;
    }
    let el = document.getElementById(LIGHT_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = LIGHT_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = knowledgeLightGroundCss(accent);
    return () => document.getElementById(LIGHT_STYLE_ID)?.remove();
  }, [accent]);
}
