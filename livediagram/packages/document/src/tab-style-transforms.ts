// A tab's typeface and finish as pure tab transforms (docs/specs/011-theme/canvas-and-theme-dialog.md "Text panel",
// "Finish panel" and "Agents"): the tab's own setting, and every element following it again. The editor's Tab Style
// setters (apps/editor/lib/tab-style-transforms.ts) and the api's `style` changeset both run them.
import {
  FINISHES,
  isFinish,
  supportsFinish,
  type Finish,
} from '@liveworkspace/element-model/finish';
import { DEFAULT_SCHEME_ID, THEMES } from '@liveworkspace/element-model/themes';
import { FONTS } from '@liveworkspace/model-core/fonts';
import { isBoxed, type Element } from './element-union';
import { isTabThemeId } from './tab-theme-apply';
import type { Tab } from './tab-type';

// Every element that carries text of its own (a font or a size): boxed elements and arrows.
export const carriesText = (el: Element) => isBoxed(el) || el.type === 'arrow';

/** The tab lettered in `font` (null: the editor's default), every element following it again (its own font
 *  cleared). */
export function withTabFont(tab: Tab, font: string | null): Tab {
  const elements = tab.elements.map((el) => {
    if (!carriesText(el) || !('font' in el)) return el;
    const next = { ...el };
    delete next.font;
    return next;
  });
  const next: Tab = { ...tab, elements };
  if (font) next.font = font;
  else delete next.font;
  return next;
}

/** The tab drawn in `finish`, every element following it again (its own finish cleared). */
export function withTabFinish(tab: Tab, finish: Finish): Tab {
  const elements = tab.elements.map((el) => {
    if (!supportsFinish(el) || !('finish' in el)) return el;
    const next = { ...el } as Element & { finish?: Finish };
    delete next.finish;
    return next;
  });
  return { ...tab, finish, elements };
}

/** A tab's style as an agent asks for it (docs/specs/024-agents/agent-changesets.md "A style restyles an existing
 *  tab"): any of a theme, a finish and a typeface. */
export type TabStyle = { theme?: string; finish?: Finish; font?: string };

/** The style's first id nobody knows, with the ids that field takes; null when every id given is known. One check for
 *  the api's `style` changeset and the MCP's style_document, so both refuse the same ids in the same words. */
export function tabStyleIssue(style: {
  theme?: unknown;
  finish?: unknown;
  font?: unknown;
}): { field: 'theme' | 'finish' | 'font'; valid: string[] } | null {
  if (style.theme !== undefined && !(typeof style.theme === 'string' && isTabThemeId(style.theme)))
    return { field: 'theme', valid: tabThemeIds() };
  if (style.finish !== undefined && !isFinish(style.finish))
    return { field: 'finish', valid: [...FINISHES] };
  if (style.font !== undefined && !FONTS.some((f) => f.id === style.font))
    return { field: 'font', valid: FONTS.map((f) => f.id) };
  return null;
}

/** Every theme id a tab can take: the Default scheme's, then the catalogue's. */
export function tabThemeIds(): string[] {
  return [...new Set([DEFAULT_SCHEME_ID, ...THEMES.map((t) => t.id)])];
}
