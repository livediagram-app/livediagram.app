import { describe, expect, it } from 'vitest';
import {
  illustratePagesOf,
  layOutIllustratePages,
  LOGO_SIDE,
  newLogoPage,
  pageDimensions,
  pageHasOrientation,
  pageKindOf,
  pageLabel,
  pageMargin,
  pageSizeChoices,
  pageSizesFor,
} from './illustrate-page';
import { withPageKindChosen } from './article-pages';

// docs/specs/007-editor/logo-pages.md "A logo page": the 1024 artboard, its safe area, no pattern.
describe('logo pages', () => {
  it('are made as the plain artboard', () => {
    expect(newLogoPage('l')).toEqual({
      id: 'l',
      orientation: 'portrait',
      size: 'logo',
      kind: 'logo',
    });
    expect(pageDimensions(newLogoPage('l'))).toEqual({ width: LOGO_SIDE, height: LOGO_SIDE });
    expect(pageHasOrientation(newLogoPage('l'))).toBe(false);
  });

  it('are read as the artboard whatever size was stored, dropping a pattern and a flow', () => {
    const [p] = illustratePagesOf({
      pages: [
        {
          id: 'l',
          orientation: 'landscape',
          size: 'a3',
          kind: 'logo',
          flow: 'f',
          name: 'Mark',
          background: { fill: { kind: 'solid', color: '#112233' }, pattern: 'dots' },
        },
      ],
    });
    expect(p).toEqual({
      id: 'l',
      orientation: 'portrait',
      size: 'logo',
      kind: 'logo',
      name: 'Mark',
      background: { fill: { kind: 'solid', color: '#112233' } },
    });
    expect(pageKindOf(p!)).toBe('logo');
  });

  it('drops a pattern-only background entirely', () => {
    const [p] = illustratePagesOf({
      pages: [{ id: 'l', orientation: 'portrait', kind: 'logo', background: { pattern: 'grid' } }],
    });
    expect(p!.background).toBeUndefined();
  });

  it('keep the artboard to themselves: another page stored in it is read as A4', () => {
    const [p] = illustratePagesOf({ pages: [{ id: 'a', orientation: 'portrait', size: 'logo' }] });
    expect(p!.size).toBeUndefined();
    const [s] = illustratePagesOf({
      pages: [{ id: 's', orientation: 'portrait', size: 'logo', kind: 'slide' }],
    });
    expect(s!.size).toBe('slide');
  });

  it('offer only the artboard, and no other kind offers it', () => {
    expect(pageSizesFor('logo')).toEqual(['logo']);
    for (const kind of ['infographic', 'article', 'slide'] as const) {
      expect(pageSizesFor(kind)).not.toContain('logo');
    }
  });

  it('keep a 10% safe area as their margin', () => {
    expect(pageMargin(newLogoPage('l'))).toBe(102);
    expect(pageMargin({ orientation: 'portrait', size: 'square' })).toBe(76);
  });

  it('label by size and kind', () => {
    expect(pageLabel(newLogoPage('l'), 0, 1)).toBe('1024 x 1024 · Logo');
    expect(pageLabel({ ...newLogoPage('l'), name: 'Mark' }, 1, 2)).toBe(
      'Mark · 1024 x 1024 · Logo',
    );
  });

  it('lay out in the row like any page', () => {
    const [a, b] = layOutIllustratePages([newLogoPage('a'), newLogoPage('b')]);
    expect(a!.rect).toEqual({ x: -512, y: -512, width: 1024, height: 1024 });
    expect(b!.rect.x).toBe(512 + 96);
  });

  it("can be the first page's choice, keeping its name and fill but not a pattern", () => {
    const tab = {
      elements: [],
      pages: [
        {
          id: 'p',
          orientation: 'landscape' as const,
          name: 'Brand',
          background: {
            fill: { kind: 'solid' as const, color: '#000000' },
            pattern: 'dots' as const,
          },
        },
      ],
    };
    const chosen = withPageKindChosen(tab, 'p', 'logo', 'flow-x');
    expect(chosen!.pages).toEqual([
      {
        id: 'p',
        orientation: 'portrait',
        size: 'logo',
        kind: 'logo',
        name: 'Brand',
        background: { fill: { kind: 'solid', color: '#000000' } },
      },
    ]);
  });
});

// docs/specs/007-editor/illustrate-pages.md "Sizes": no two size tiles of one shape.
describe('pageSizeChoices', () => {
  it('offers the Slide, not a second 16:9 Story, on a landscape infographic page', () => {
    const landscape = { orientation: 'landscape' as const };
    expect(pageSizeChoices(landscape)).toContain('slide');
    expect(pageSizeChoices(landscape)).not.toContain('wide');
    expect(pageSizeChoices({ ...landscape, size: 'wide' })).toContain('wide');
    expect(pageSizeChoices({ ...landscape, size: 'wide' })).not.toContain('slide');
    expect(pageSizeChoices({ orientation: 'portrait' })).toEqual(pageSizesFor('infographic'));
  });

  it('puts Fit to Content first on a page already in it', () => {
    expect(pageSizeChoices({ orientation: 'portrait', size: 'fit' })[0]).toBe('fit');
  });
});
