// Logo explorations (docs/specs/007-editor/logo-pages.md "Logo layouts"): one template per logo layout family, one
// logo page per layout in it, named for the layout. A designer compares the family side by side on real artboards
// (so the guides, mirror, Combine and Logo Kit all work), keeps the one that fits and deletes the rest. Each page
// shows the made-up studio Lumen, its name set in a display face of its own. Pure: the pages are declared once and
// each layout built on its page.
import { layOutPages, type Element, type Page } from '@livedesign/design';
import {
  LOGO_EXPLORATIONS,
  LOGO_EXPLORATION_BRAND,
  LOGO_EXPLORATION_FACES,
  type LogoExplorationKind,
} from './logo-exploration-data';
import { inDisplayFace } from './logo-display-face';
import { INITIALS, NAME, SECOND, TAGLINE } from './logo-layout-kit';
import { LOGO_LAYOUTS } from './logo-layouts';
import { buildPageLayout } from './page-layout-build';
import { templateLogoPage } from './template-page-kit';

export {
  LOGO_EXPLORATIONS,
  isLogoExplorationKind,
  type LogoExplorationKind,
} from './logo-exploration-data';

const LABEL: ReadonlyMap<string, string> = new Map(LOGO_LAYOUTS.map((l) => [l.id, l.label]));

// The layouts' placeholder words to the studio's (a mark's single initial is the name's first letter).
const BRAND_WORDS: ReadonlyMap<string, string> = new Map([
  [NAME, LOGO_EXPLORATION_BRAND.name],
  [SECOND, LOGO_EXPLORATION_BRAND.second],
  [INITIALS, LOGO_EXPLORATION_BRAND.initials],
  [TAGLINE, LOGO_EXPLORATION_BRAND.tagline],
  [NAME.slice(0, 1), LOGO_EXPLORATION_BRAND.name.slice(0, 1)],
]);

/** An exploration's pages: one logo page per layout, named for it. */
export function logoExplorationPages(kind: LogoExplorationKind): Page[] {
  return LOGO_EXPLORATIONS[kind].map((id, i) => templateLogoPage(i + 1, LABEL.get(id) ?? id));
}

// A layout's element in the studio's words, its name in the page's display face (the tagline in the label face).
function asLumen(el: Element, face: string): Element {
  const label = (el as { label?: string }).label;
  if (el.type !== 'text' || label === undefined) return el;
  const worded = { ...el, label: BRAND_WORDS.get(label) ?? label };
  return label === TAGLINE ? worded : inDisplayFace(worded, face);
}

/** An exploration's elements: each layout on its page. */
export function buildLogoExploration(kind: LogoExplorationKind): Element[] {
  const layouts = LOGO_EXPLORATIONS[kind];
  return layOutPages(logoExplorationPages(kind)).flatMap((page, i) => {
    const face = LOGO_EXPLORATION_FACES[layouts[i]!];
    return buildPageLayout(layouts[i]!, page).map((el) => asLumen(el, face));
  });
}
