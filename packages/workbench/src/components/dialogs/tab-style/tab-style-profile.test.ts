// The Tab Style profile's resolve and its helpers (liveworkspace/docs/specs/011-workbench/tab-style.md "Surfaces",
// "The profile").
import { describe, expect, it } from 'vitest';
import { FONTS } from '@liveworkspace/model-core/fonts';
import {
  TAB_STYLE_COPY,
  TAB_STYLE_HELP,
  TAB_STYLE_PANELS,
  resolveTabStyleSurface,
  shownTabStyleView,
  tabStyleCopy,
  type TabStyleLook,
  type TabStyleSurface,
} from './tab-style-profile';
import { tabStyleFontLabel, tabStyleFontOptions } from './tab-style-fonts';

const base: TabStyleSurface<TabStyleLook, string> = {
  panels: TAB_STYLE_PANELS,
  hiddenControls: [],
  renderCanvasPanel: () => null,
  renderPreview: () => null,
  copy: TAB_STYLE_COPY,
};

describe('resolveTabStyleSurface', () => {
  it('takes the base with no surface, or one the profile does not name', () => {
    expect(resolveTabStyleSurface({ base }, undefined)).toBe(base);
    expect(resolveTabStyleSurface({ base, surfaces: {} }, 'sheet')).toBe(base);
    expect(resolveTabStyleSurface({ base }, 'sheet')).toBe(base);
  });

  it("lays a surface's changes over the base, its copy line by line", () => {
    const article = resolveTabStyleSurface(
      {
        base,
        surfaces: {
          article: {
            panels: ['theme', 'canvas'],
            hiddenControls: ['defaultTextSize'],
            copy: { viewLines: { canvas: 'Around the pages.' }, panelTitles: { canvas: 'Pages' } },
          },
        },
      },
      'article',
    );
    expect(article.panels).toEqual(['theme', 'canvas']);
    expect(article.hiddenControls).toEqual(['defaultTextSize']);
    expect(article.renderPreview).toBe(base.renderPreview);
    expect(article.copy.viewLines.canvas).toBe('Around the pages.');
    expect(article.copy.viewLines.looks).toBe(TAB_STYLE_COPY.viewLines.looks);
    expect(article.copy.panelTitles).toEqual({ ...TAB_STYLE_COPY.panelTitles, canvas: 'Pages' });
  });

  it('keeps the base copy for a surface that changes none', () => {
    const slide = resolveTabStyleSurface(
      { base, surfaces: { slide: { hiddenControls: ['patternScale'] } } },
      'slide',
    );
    expect(slide.copy).toEqual(TAB_STYLE_COPY);
    expect(slide.hiddenControls).toEqual(['patternScale']);
  });
});

describe('tabStyleCopy', () => {
  it('is the shared copy, with only the lines a product words differently changed', () => {
    expect(tabStyleCopy()).toEqual(TAB_STYLE_COPY);
    const planner = tabStyleCopy({ viewLines: { theme: 'Everything.' } });
    expect(planner.viewLines.theme).toBe('Everything.');
    expect(planner.viewLines.finish).toBe(TAB_STYLE_COPY.viewLines.finish);
    expect(planner.panelTitles).toEqual(TAB_STYLE_COPY.panelTitles);
  });
});

describe('shownTabStyleView', () => {
  it('shows the home and the panels the surface keeps, and the home for one it leaves out', () => {
    expect(shownTabStyleView('looks', [])).toBe('looks');
    expect(shownTabStyleView('canvas', TAB_STYLE_PANELS)).toBe('canvas');
    expect(shownTabStyleView('canvas', ['theme'])).toBe('looks');
  });

  it('links every view to a help article', () => {
    expect(TAB_STYLE_HELP).toEqual({
      looks: 'changingTheme',
      theme: 'changingTheme',
      finish: 'choosingAFinish',
      font: 'choosingFonts',
      canvas: 'changingTheBackground',
    });
  });
});

describe('the typeface cards', () => {
  it('lead with Editor default, then the offered faces, the whole catalogue by default', () => {
    const all = tabStyleFontOptions();
    expect(all[0]).toEqual({ id: null, label: 'Editor default', kind: 'System', stack: undefined });
    expect(all.slice(1).map((o) => o.id)).toEqual(FONTS.map((f) => f.id));
    expect(tabStyleFontOptions(FONTS.slice(0, 2)).map((o) => o.id)).toEqual([
      null,
      FONTS[0]!.id,
      FONTS[1]!.id,
    ]);
  });

  it('name a tab font from the whole catalogue, Editor default for none or an unknown one', () => {
    expect(tabStyleFontLabel(FONTS[3]!.id)).toBe(FONTS[3]!.label);
    expect(tabStyleFontLabel(null)).toBe('Editor default');
    expect(tabStyleFontLabel('no-such-face')).toBe('Editor default');
  });
});
