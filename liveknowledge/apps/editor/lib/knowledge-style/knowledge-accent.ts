// The accent a knowledgebase's theme gives its writing and its chrome (docs/specs/030-knowledgebase/page-surface.md
// "Knowledgebase Style", "The chrome follows the theme"). The accents themselves are @liveknowledge/document's
// (knowledge-accent.ts, knowledge-style-view.ts), one copy shared with the public site and the api's preview;
// this adds the dark ground, which is spun from the chrome's ramp (@liveworkspace/workbench).
import { knowledgeChromeAccent } from '@liveknowledge/document';
import { editorAccentCss } from '@liveworkspace/workbench/hooks/ui/editor-accent';

export {
  LIME_ACCENT,
  knowledgeChromeAccent,
  knowledgeThemeAccent,
  knowledgeWritingAccent,
} from '@liveknowledge/document';

// The dark appearance's ground under the product's own theme: slate-900 of the shared dark palette
// (packages/tailwind-config/theme.css `.dark`), which the page stands on (app/globals.css).
const LIME_DARK_GROUND = '#131b26';

/** The ground a page stands on in the dark appearance under a theme: the chrome's own dark surface, which a theme
 *  other than the product's tints (@liveworkspace/workbench hooks/ui/editor-accent.ts). For a card that draws a
 *  look in the dark, and for the contrast tests. */
export function knowledgeDarkGround(themeId: string | undefined): string {
  const accent = knowledgeChromeAccent(themeId);
  if (!accent) return LIME_DARK_GROUND;
  return /--color-slate-900:(#[0-9a-f]{6});/.exec(editorAccentCss(accent))?.[1] ?? LIME_DARK_GROUND;
}
