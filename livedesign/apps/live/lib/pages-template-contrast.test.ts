import { describe, expect, it } from 'vitest';
import {
  TEMPLATES,
  buildTemplate,
  isLogoExplorationKind,
  templateCanvasOverrides,
} from '@livedesign/templates';
import {
  LABEL_BACKDROP_CONTRAST,
  THEMES,
  THEME_TEXT_CONTRAST,
  canvasSurface,
  contrastRatio,
  defaultTextColor,
  labelBackdrops,
  layOutPages,
  pagesOf,
  paperMarkBackdrops,
  type Appearance,
  type Element,
  type Tab,
} from '@livedesign/design';
import { themeViewMap } from './themes';
import { withThemeApplied } from './tab-theme-apply';
import { createStockColourProjector, pageViewOf, plainPaper } from './stock-colour-projector';

// docs/specs/011-theme/light-and-dark.md "Words on the plain paper keep the contrast they were made with" and
// docs/specs/007-editor/wireframe-pages.md "Wireframe layouts" (Work Item 445): every Wireframes template, the
// Logo Design template (Sunny Side) and the four logo explorations (Lockups, Wordmarks, Emblems, Marks) read at
// 4.5:1 in the light and the dark editor, as the canvas draws them, and at 3:1 under every theme picked in either
// half (as template-overlay-contrast holds the other templates). Each label is held to what is drawn behind it: its own fill, else the card or block it sits on, else the sheet (the
// plain paper, white in the light editor and slate in the dark, or the page's own fill). template-overlay-contrast
// leaves Pages templates out; this is their check. "Ink marks on the plain paper stay seen" (Work Tracker 748): in
// the dark editor each filled part and icon straight on the plain paper reaches 3:1 against the slate, or the
// contrast it was made with on white where that was less (a soft grey skeleton bar).

const APPEARANCES: Appearance[] = ['light', 'dark'];

/** Every Wireframes template with content, Sunny Side's Logo Design and the logo explorations. */
const CHECKED = TEMPLATES.map((t) => t.kind).filter(
  (kind) =>
    kind === 'logo-design' ||
    isLogoExplorationKind(kind) ||
    (!kind.startsWith('blank') &&
      (templateCanvasOverrides(kind).pages ?? []).some((p) => p.kind === 'wireframe')),
);

/** Each label below 4.5:1 against what the canvas draws behind it, and each ink mark on the dark paper below 3:1,
 *  as `kind` opens in `appearance` with `theme` picked in `picker`'s half (none: as the template stores it). */
function shortLabels(
  kind: (typeof CHECKED)[number],
  appearance: Appearance,
  theme?: { id: string; picker: Appearance },
): string[] {
  const opened: Tab = {
    id: 't',
    name: 't',
    elements: buildTemplate(kind, 0, 0),
    ...templateCanvasOverrides(kind),
  };
  const tab = theme ? withThemeApplied(opened, theme.id, theme.picker) : opened;
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
    // As stored, 4.5:1; under a theme the shared walk's floor, 3:1, as template-overlay-contrast holds.
    if (ratio < (theme ? LABEL_BACKDROP_CONTRAST : THEME_TEXT_CONTRAST))
      problems.push(`"${String(el.label).slice(0, 32)}" ${ink} on ${behind} (${ratio.toFixed(2)})`);
  }
  if (paper.drawn === paper.stored) return problems;
  // Ink marks straight on the dark paper, held to 3:1 or what they had on white.
  const made = paperMarkBackdrops(tab.elements, paper.stored);
  for (const [id, { colour, behind }] of paperMarkBackdrops(drawn, paper.drawn)) {
    if (behind !== paper.drawn || pageView?.tones?.has(id)) continue;
    const was = made.get(id);
    if (!was || was.behind !== paper.stored) continue;
    const floor = Math.min(LABEL_BACKDROP_CONTRAST, contrastRatio(was.colour, was.behind));
    const ratio = contrastRatio(colour, behind);
    if (ratio < floor - 0.01)
      problems.push(`mark ${id} ${colour} on ${behind} (${ratio.toFixed(2)})`);
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

  // Every theme, picked in either half and seen in either: one case per template and theme, so a failure names every
  // pair and no case runs long.
  for (const kind of CHECKED)
    describe(`${kind}, under every theme`, () => {
      for (const { id } of THEMES)
        it(id, () => {
          const problems: string[] = [];
          for (const picker of APPEARANCES)
            for (const appearance of APPEARANCES)
              for (const p of shortLabels(kind, appearance, { id, picker }))
                problems.push(`picked ${picker}, seen ${appearance}: ${p}`);
          expect(problems).toEqual([]);
        });
    });
});
