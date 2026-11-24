// A design set applied to a tab (docs/specs/011-theme/page-designs.md "Design sets"): its theme (the editor's own
// theme switch, so the elements follow it), font, finish, a background every page takes as a Look gives it, its page
// design, and its layouts laid on each empty slide or infographic page. One transform, so the editor commits it as
// one undo step. The layout builder is handed in (it loads on demand with the templates).
import {
  designSetBackground,
  designSetLayout,
  elementsOnPage,
  layOutPages,
  pageIsDark,
  pageKindOf,
  pageLaidOut,
  pagesGivenNewPageBackground,
  pagesOf,
  themedForTab,
  withNewPageBackground,
  withTabPageDesign,
  type Element,
  type LaidOutPage,
  type PageDesignSet,
  type Tab,
} from '@livedocuments/document';
import type { PageLayoutId } from '@livedocuments/templates';
import type { InkMemory } from '@livedocuments/document';
import { withThemeApplied } from './tab-theme-apply';
import { withTabFinish, withTabFont } from './tab-style-transforms';
import { getTheme } from './themes';

export type LayoutBuilder = (layout: PageLayoutId, page: LaidOutPage) => Element[];

export type DesignSetApplied = { tab: Tab; memory?: InkMemory; laidOut: number };

export function withPageDesignSetApplied(
  tab: Tab,
  set: PageDesignSet,
  build: LayoutBuilder,
  memory?: InkMemory,
): DesignSetApplied {
  let t = withThemeApplied(tab, set.theme);
  t = withTabFinish(withTabFont(t, set.font), set.finish);
  const background = designSetBackground(set, getTheme(set.theme, 'light'));
  t = withNewPageBackground(
    t,
    background
      ? { fill: background.fill, pattern: undefined }
      : { fill: undefined, pattern: undefined },
  );
  const spread = pagesGivenNewPageBackground(t, memory);
  t = withTabPageDesign(spread.tab, set.design);
  // Each empty slide or infographic page takes the set's layout for its place.
  let laidOut = 0;
  let slides = 0;
  let infographics = 0;
  for (const page of layOutPages(pagesOf(t))) {
    const kind = pageKindOf(page);
    if (kind !== 'slide' && kind !== 'infographic') continue;
    const index = kind === 'slide' ? slides++ : infographics++;
    if (page.locked || elementsOnPage(t.elements, layOutPages(pagesOf(t)), page.id).length > 0)
      continue;
    const layout = designSetLayout(set, kind, index) as PageLayoutId;
    const edit = pageLaidOut(
      t,
      page.id,
      themedForTab(build(layout, page), t.theme, { dark: pageIsDark(page) }),
    );
    if ('tab' in edit) {
      t = edit.tab;
      laidOut += 1;
    }
  }
  return { tab: t, ...(spread.memory ? { memory: spread.memory } : {}), laidOut };
}
