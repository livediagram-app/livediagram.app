import { describe, expect, it } from 'vitest';
import type { PageChange } from '@livedocuments/api-schema';
import {
  STYLE_RECIPES,
  createShape,
  darkSlideBackground,
  designGuard,
  designPalette,
  layOutPages,
  pageFillTone,
  pagesOf,
  paintPageDesign,
  renderPagesToSvg,
  resolvePageDesigns,
  resolveThemeIn,
  SCRIM_OPACITY,
  tabPageDesignOf,
  type Element,
  type Page,
  type Tab,
} from '@livedocuments/document';
import { applyPageChanges } from './page-changes';
import { parsePagesRequest } from './parse';

// docs/specs/024-agents/pages-for-agents.md "Restyling a tab".

const slide: Page = { id: 'p1', orientation: 'landscape', size: 'slide', kind: 'slide' };
const box = { ...createShape('square', 0, 0), id: 'b', label: 'Board report' } as Element;
const tabOf = (extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'Quarterly board report',
  elements: [box],
  pages: [slide],
  ...extra,
});
const parsed = (changes: unknown[]) => {
  const out = parsePagesRequest({ pages: changes });
  if ('refusal' in out) throw new Error(`${out.refusal.code}: ${out.refusal.message}`);
  return (out as { pages: PageChange[] }).pages;
};
const refused = (changes: unknown[]) => {
  const out = parsePagesRequest({ pages: changes });
  if (!('refusal' in out)) throw new Error('expected a refusal');
  return out.refusal.message;
};
const run = (tab: Tab, changes: unknown[]) => {
  const out = applyPageChanges(tab, parsed(changes));
  if ('refusal' in out) throw new Error(`${out.refusal.code}: ${out.refusal.message}`);
  return out;
};

describe('tab_style', () => {
  it('reads a recipe and its parts, and refuses what names nothing', () => {
    expect(parsed([{ op: 'tab_style', style: 'editorial', font: 'lora' }])[0]).toEqual({
      op: 'tab_style',
      style: 'editorial',
      font: 'lora',
    });
    expect(refused([{ op: 'tab_style' }])).toContain(
      'at least one of style, theme, font and finish',
    );
    expect(refused([{ op: 'tab_style', style: 'long-reading' }])).toContain('editorial');
    expect(refused([{ op: 'tab_style', theme: 'nope' }])).toContain('"theme": unknown "nope"');
    expect(refused([{ op: 'tab_style', font: 'comic' }])).toContain('"font": unknown "comic"');
    expect(refused([{ op: 'tab_style', finish: 'glossy' }])).toContain('"finish": unknown');
    expect(refused([{ op: 'tab_style', colour: 'red' }])).toContain('tab_style takes no "colour"');
    expect(refused([{ op: 'tab_style', font: ' ' }])).toContain('"font" is an id.');
    expect(refused([{ op: 'tab_style', theme: 3 }])).toContain('"theme" is an id.');
    expect(parsed([{ op: 'tab_style', theme: 'ocean', finish: 'sketch' }])[0]).toEqual({
      op: 'tab_style',
      theme: 'ocean',
      finish: 'sketch',
    });
  });

  it('restyles the tab as a recipe: theme, typeface, finish and page design, and says so', () => {
    const recipe = STYLE_RECIPES.find((r) => r.id === 'technical')!;
    const out = run(tabOf(), [{ op: 'tab_style', style: 'technical' }]);
    expect(out.tab.theme).toBe(recipe.theme);
    expect(out.tab.font).toBe(recipe.font);
    expect(out.tab.finish).toBe(recipe.finish);
    expect(tabPageDesignOf(out.tab)?.id).toBe(recipe.design);
    expect(out.lines.join(' ')).toContain('Restyled the tab as technical');
    // Its elements take the new theme's colours.
    const before = tabOf().elements[0] as { fillColor?: string };
    expect((out.tab.elements[0] as { fillColor?: string }).fillColor).not.toBe(before.fillColor);
  });

  it('lets a part named beside the recipe win, and takes one part alone', () => {
    const out = run(tabOf(), [{ op: 'tab_style', style: 'technical', font: 'lora' }]);
    expect(out.tab.font).toBe('lora');
    const alone = run(tabOf({ font: 'inter' }), [{ op: 'tab_style', finish: 'sketch' }]);
    expect(alone.tab.finish).toBe('sketch');
    expect(alone.tab.font).toBe('inter');
    expect(alone.tab.theme).toBeUndefined();
  });

  it('picks a recipe for the tab’s words on "auto"', () => {
    const out = run(tabOf(), [{ op: 'tab_style', style: 'auto' }]);
    expect(out.lines.join(' ')).toContain('as formal-report');
  });

  it('takes the first recipe on "auto" when the tab’s words suit none', () => {
    const quiet = { ...box, label: 'Zzz' } as Element;
    const out = run(tabOf({ name: 'Qqq', elements: [quiet] }), [
      { op: 'tab_style', style: 'auto' },
    ]);
    expect(out.lines.join(' ')).toContain(`as ${STYLE_RECIPES[0]!.id}`);
  });

  it('puts the slides on the dark canvas for a stage recipe, keeps them dark on a theme alone and returns them to Steel for another recipe', () => {
    const stage = STYLE_RECIPES.find((r) => r.darkSlides)!;
    const dark = run(tabOf(), [{ op: 'tab_style', style: stage.id }]);
    expect(dark.lines.join(' ')).toContain('dark slides');
    const themed = run(dark.tab, [{ op: 'tab_style', theme: 'forest' }]);
    expect(themed.lines.join(' ')).toContain('dark slides');
    const same = run(themed.tab, [{ op: 'tab_style', theme: 'forest' }]);
    expect(same.lines.join(' ')).not.toContain('slides');
    const back = run(dark.tab, [{ op: 'tab_style', style: 'technical' }]);
    expect(back.lines.join(' ')).toContain('Steel slides');
  });

  // docs/specs/011-theme/light-and-dark.md "A page's own paper": a restyle gives a dark slide's words the theme's dark
  // half, so no re-inking bakes them dim and the page design lays no plate under them (Work Tracker 1482).
  describe('a keynote deck restyled', () => {
    const keynote = () => {
      const made = run(tabOf({ elements: [] }), [{ op: 'tab_style', style: 'keynote' }]);
      return run(made.tab, [
        { op: 'layout', page: 1, layout: 'slide-title' },
        { op: 'add', kind: 'slide', layout: 'slide-three-stats' },
      ]).tab;
    };
    const texts = (tab: Tab) => tab.elements.filter((e) => e.type === 'text');
    const scrimFill = `fill-opacity="${SCRIM_OPACITY}"`;

    it.each(['midnight', 'forest', 'ocean', 'sunset'])(
      'to %s keeps its words the theme’s and lays no plate under the title, subtitle or footer',
      (theme) => {
        const tab = run(keynote(), [{ op: 'tab_style', theme }]).tab;
        const dark = resolveThemeIn(theme, 'dark')!;
        expect(texts(tab).length).toBeGreaterThan(4);
        for (const t of texts(tab))
          expect((t as { textColor?: string }).textColor).toBe(dark.elementText);
        const pages = layOutPages(pagesOf(tab));
        const designs = resolvePageDesigns(tabPageDesignOf(tab), pages, tab.elements);
        for (const page of pages) {
          const r = designs.get(page.id)!;
          const palette = designPalette(
            resolveThemeIn(theme, 'light')!,
            page,
            false,
            r.tuning.colors,
          );
          // The plate's colour is the page's, and the page is this theme's night.
          expect(palette.base).toBe(pageFillTone(darkSlideBackground(theme).fill!));
          const painted = paintPageDesign({
            design: r.design,
            tuning: r.tuning,
            palette,
            width: page.rect.width,
            height: page.rect.height,
          });
          expect(designGuard(painted, page.rect, tab.elements).scrims).toEqual([]);
        }
        // The MCP's preview draws the same: light words, no plate.
        expect(renderPagesToSvg(tab)).not.toContain(scrimFill);
      },
    );

    it('to midnight draws as the deck was made', () => {
      const made = keynote();
      expect(renderPagesToSvg(made)).not.toContain(scrimFill);
      const restyled = run(made, [{ op: 'tab_style', theme: 'midnight' }]).tab;
      const colours = (tab: Tab) => texts(tab).map((t) => (t as { textColor?: string }).textColor);
      expect(new Set(colours(restyled))).toEqual(
        new Set([resolveThemeIn('midnight', 'dark')!.elementText]),
      );
    });

    it('leaves a light deck’s words in the light half', () => {
      const light = run(tabOf({ elements: [] }), [
        { op: 'layout', page: 1, layout: 'slide-title' },
      ]).tab;
      const out = run(light, [{ op: 'tab_style', theme: 'forest' }]).tab;
      const ink = resolveThemeIn('forest', 'light')!.elementText;
      for (const t of texts(out)) expect((t as { textColor?: string }).textColor).toBe(ink);
    });
  });

  it('sets its articles in the typeface too', () => {
    const out = run(tabOf({ articles: { a: { blocks: [], style: { look: 'bold' } } } }), [
      { op: 'tab_style', font: 'lora' },
    ]);
    expect(out.tab.articles!.a!.style).toEqual({
      look: 'bold',
      headingFont: 'lora',
      bodyFont: 'lora',
    });
  });
});
