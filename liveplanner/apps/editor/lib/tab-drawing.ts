// A tab drawn where it is shown away from its own canvas (docs/specs/009-elements/tab-window.md "The drawing",
// docs/specs/007-editor/split-view.md "The other pane"): a Form tab its form on its tab's look, as respondents see it;
// any other tab its canvas (renderTabToSvg). Shared by useTabSvg (a tab window, the split view's other pane and its
// drop preview, a Dashboard's Diagram slot) and a window in an export (tabWindowArts), so each draws a tab the same
// way.
import {
  exportFontIds,
  formLook,
  resolveFontStack,
  tabKindOf,
  type Tab,
} from '@liveplanner/project';
import { readForm } from '@liveplanner/forms';
import { formArt } from '@liveplanner/plan-art';
import { renderTabToSvg, type ImageExportOpts } from './export-tab';

/** The tab drawn, as a whole SVG document whose viewBox is in the tab's canvas space. */
export function renderTabDrawingSvg(tab: Tab, opts: ImageExportOpts = {}): string {
  if (tabKindOf(tab) === 'form') {
    const form = readForm(tab.form);
    if (form) {
      const look = formLook(tab);
      return formArt(form, look, resolveFontStack(look.font)).svg;
    }
  }
  return renderTabToSvg(tab, opts);
}

/** The typefaces the drawing of this tab writes in: its elements' and a form's. */
export function tabDrawingFontIdsOf(tab: Tab): string[] {
  const ids = new Set(exportFontIds(tab.elements, tab.font, undefined, tab.finish));
  if (tabKindOf(tab) === 'form' && tab.font) ids.add(tab.font);
  return [...ids];
}
