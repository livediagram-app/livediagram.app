// A tab drawn where it is shown away from its own canvas (docs/specs/007-editor/split-view.md "The other pane"): a
// Form tab its form on its tab's look, as respondents see it; any other tab its canvas (renderTabToSvg). Shared by
// useTabSvg (the split view's other pane and its drop preview, a Dashboard's Diagram slot), so each draws a tab the
// same way.
import { formLook, resolveFontStack, tabKindOf, type Tab } from '@livediagram/document';
import { readForm } from '@livediagram/forms';
import { formArt } from '@livediagram/plan-art';
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
