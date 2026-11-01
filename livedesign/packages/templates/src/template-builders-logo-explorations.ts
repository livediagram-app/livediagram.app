// Logo explorations (docs/specs/007-editor/logo-pages.md "Logo layouts"): one template per logo layout family, one
// logo page per layout in it, named for the layout. A designer compares the family side by side on real artboards
// (so the guides, mirror, Combine and Logo Kit all work), keeps the one that fits and deletes the rest. Pure: the
// pages are declared once and each layout built on its page.
import { layOutPages, type Element, type Page } from '@livedesign/design';
import { LOGO_EXPLORATIONS, type LogoExplorationKind } from './logo-exploration-data';
import { LOGO_LAYOUTS } from './logo-layouts';
import { buildPageLayout } from './page-layout-build';
import { templateLogoPage } from './template-page-kit';

export {
  LOGO_EXPLORATIONS,
  isLogoExplorationKind,
  type LogoExplorationKind,
} from './logo-exploration-data';

const LABEL: ReadonlyMap<string, string> = new Map(LOGO_LAYOUTS.map((l) => [l.id, l.label]));

/** An exploration's pages: one logo page per layout, named for it. */
export function logoExplorationPages(kind: LogoExplorationKind): Page[] {
  return LOGO_EXPLORATIONS[kind].map((id, i) => templateLogoPage(i + 1, LABEL.get(id) ?? id));
}

/** An exploration's elements: each layout on its page. */
export function buildLogoExploration(kind: LogoExplorationKind): Element[] {
  const layouts = LOGO_EXPLORATIONS[kind];
  return layOutPages(logoExplorationPages(kind)).flatMap((page, i) =>
    buildPageLayout(layouts[i]!, page),
  );
}
