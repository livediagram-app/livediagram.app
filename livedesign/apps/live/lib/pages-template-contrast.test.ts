import { describe, expect, it } from 'vitest';
import {
  TEMPLATES,
  buildTemplate,
  isLogoExplorationKind,
  templateCanvasOverrides,
} from '@livedesign/templates';
import {
  THEME_TEXT_CONTRAST,
  canvasSurface,
  contrastRatio,
  defaultTextColor,
  labelBackdrops,
  layOutPages,
  pagesOf,
  type Appearance,
  type Element,
  type Tab,
} from '@livedesign/design';
import { themeViewMap } from './themes';
import { createStockColourProjector, pageViewOf, plainPaper } from './stock-colour-projector';

// docs/specs/011-theme/light-and-dark.md "Words on the plain paper keep the contrast they were made with" and
// docs/specs/007-editor/wireframe-pages.md "Wireframe layouts" (Work Item 445): every Wireframes template, the
// Logo Design template (Sunny Side) and the four logo explorations (Lockups, Wordmarks, Emblems, Marks) read at
// 4.5:1 in the light and the dark editor, as the canvas draws them. Each label is held to what is drawn behind it: its own fill, else the card or block it sits on, else the sheet (the
// plain paper, white in the light editor and slate in the dark, or the page's own fill). template-overlay-contrast
// leaves Pages templates out; this is their check.

const APPEARANCES: Appearance[] = ['light', 'dark'];

/** Every Wireframes template with content, Sunny Side's Logo Design and the logo explorations. */
const CHECKED = TEMPLATES.map((t) => t.kind).filter(
  (kind) =>
    kind === 'logo-design' ||
    isLogoExplorationKind(kind) ||
    (!kind.startsWith('blank') &&
      (templateCanvasOverrides(kind).pages ?? []).some((p) => p.kind === 'wireframe')),
);

/** Each label below 4.5:1 against what the canvas draws behind it, as `kind` opens in `appearance`. */
function shortLabels(kind: (typeof CHECKED)[number], appearance: Appearance): string[] {
  const tab: Tab = {
    id: 't',
    name: 't',
    elements: buildTemplate(kind, 0, 0),
    ...templateCanvasOverrides(kind),
  };
  const paper = plainPaper(appearance);
  const pageView = pageViewOf(tab.elements, layOutPages(pagesOf(tab)), {
    light: themeViewMap(tab.theme, 'light'),
    dark: themeViewMap(tab.theme, 'dark'),
  });
  // As EditorCanvasHost draws the board.
  const drawn = createStockColourProjector()(
    tab.elements,
    appearance,
    themeViewMap(tab.theme, appearance),
    paper,
    pageView,
  );
  const problems: string[] = [];
  for (const [i, found] of labelBackdrops(drawn, paper.drawn)) {
    const el = drawn[i] as Element & { label?: string; textColor?: string };
    // On a page with a fill of its own, the page is the sheet, and a label with no ink of its own takes the page's.
    const tone = pageView?.tones?.get(el.id);
    const behind = tone && found.behind === paper.drawn ? tone : found.behind;
    const ink =
      tone && el.textColor === undefined
        ? defaultTextColor(el as never, canvasSurface(tone))
        : found.ink;
    const ratio = contrastRatio(ink, behind);
    if (ratio < THEME_TEXT_CONTRAST)
      problems.push(`"${String(el.label).slice(0, 32)}" ${ink} on ${behind} (${ratio.toFixed(2)})`);
  }
  return problems;
}

describe('Pages templates read at 4.5:1 on their sheets in the light and the dark editor', () => {
  it('checks every Wireframes template, Sunny Side and the four logo explorations', () => {
    const logos = ['logo-design', 'logo-lockups', 'logo-wordmarks', 'logo-emblems', 'logo-marks'];
    expect(CHECKED).toEqual(expect.arrayContaining(logos));
    expect(CHECKED.length).toBe(
      TEMPLATES.filter((t) => t.kind.startsWith('wireframe-')).length + logos.length,
    );
  });

  for (const kind of CHECKED)
    for (const appearance of APPEARANCES)
      it(`${kind}, ${appearance} editor`, () => {
        expect(shortLabels(kind, appearance)).toEqual([]);
      });
});
