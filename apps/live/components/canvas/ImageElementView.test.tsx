// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  THEMES,
  contrastRatio,
  MIN_TEXT_CONTRAST,
  type ImageElement,
  type ThemeDefinition,
} from '@liveplanner/document';
import {
  CanvasSurfaceProvider,
  CanvasThemeProvider,
  PageSurfacesProvider,
} from './CanvasSurfaceContext';
import { ImageElementView } from './ImageElementView';
import {
  IMAGE_PLACEHOLDER_TONE,
  PLACEHOLDER_BORDER_CONTRAST,
  PLACEHOLDER_INK_CONTRAST,
  imageEmptyLayout,
  imagePlaceholderTone,
  placeholderThemeInk,
} from './image-placeholder-look';

// The image placeholder is inked for the paper it sits on, never the app's chrome, and its face
// grows with the box. Pictures are never uploaded, so it is the only face an image element has.

const image = (over: Partial<ImageElement> = {}): ImageElement => ({
  id: 'img',
  type: 'image',
  x: 0,
  y: 0,
  width: 600,
  height: 300,
  imageId: null,
  ...over,
});

function draw(
  el: ImageElement,
  { canvas = 'light', page, theme = null, fontFamily } = {} as {
    canvas?: 'light' | 'dark';
    page?: 'light' | 'dark';
    theme?: ThemeDefinition | null;
    fontFamily?: string;
  },
) {
  return render(
    <CanvasThemeProvider theme={theme}>
      <CanvasSurfaceProvider surface={canvas}>
        <PageSurfacesProvider surfaces={page ? new Map([[el.id, page]]) : null}>
          <ImageElementView element={el} fontFamily={fontFamily} />
        </PageSurfacesProvider>
      </CanvasSurfaceProvider>
    </CanvasThemeProvider>,
  );
}

const box = (c: HTMLElement) => c.firstElementChild as HTMLElement;

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('dark');
});

describe('image placeholder ink', () => {
  it('takes dark ink on a light page in dark chrome (the reported bug)', () => {
    // Dark chrome, a dark canvas around the page, a cream / peach page under the placeholder.
    document.documentElement.classList.add('dark');
    const { container, getByText } = draw(image(), { canvas: 'dark', page: 'light' });
    const el = box(container);
    expect(el.dataset.imagePlaceholder).toBe('light');
    expect(el.style.getPropertyValue('--ph-ink')).toBe(IMAGE_PLACEHOLDER_TONE.light.ink);
    expect(el.style.getPropertyValue('--ph-body')).toBe(IMAGE_PLACEHOLDER_TONE.light.body);
    expect(getByText('No image yet')).toBeTruthy();
    // No chrome-driven variant left to flip it back.
    expect(el.className).not.toMatch(/\bdark:/);
  });

  it('takes light ink on a dark page in light chrome', () => {
    const { container } = draw(image(), { canvas: 'light', page: 'dark' });
    expect(box(container).dataset.imagePlaceholder).toBe('dark');
    expect(box(container).style.getPropertyValue('--ph-ink')).toBe(IMAGE_PLACEHOLDER_TONE.dark.ink);
  });

  it('follows the canvas where the page has no fill of its own (or there is no page)', () => {
    document.documentElement.classList.add('dark');
    expect(box(draw(image(), { canvas: 'light' }).container).dataset.imagePlaceholder).toBe(
      'light',
    );
    cleanup();
    expect(box(draw(image(), { canvas: 'dark' }).container).dataset.imagePlaceholder).toBe('dark');
  });

  it('shows the face with no button and no hover tint', () => {
    const { container, getByText, queryByRole } = draw(image());
    expect(getByText('No image yet')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
    expect(box(container).className).not.toContain('hover:');
  });

  it('scales the face up with a big box', () => {
    const { getByText } = draw(image({ width: 900, height: 600 }));
    expect(parseFloat(getByText('No image yet').style.fontSize)).toBeGreaterThan(20);
  });

  it('names a lone badge for assistive tech on a small box', () => {
    const { container } = draw(image({ width: 40, height: 40 }));
    expect(box(container).getAttribute('aria-label')).toBe('No image yet');
  });
});

describe('imageEmptyLayout', () => {
  const pick = { canPick: true, round: false };
  it('shows the whole face where it fits, at no less than its own size', () => {
    expect(imageEmptyLayout(300, 220, pick)).toEqual({
      kind: 'face',
      scale: 1,
      parts: { title: true, line: true, button: true },
    });
  });

  it('drops the line, then the heading, as the box shrinks', () => {
    expect(imageEmptyLayout(160, 150, pick)).toMatchObject({
      parts: { title: true, line: false, button: true },
    });
    expect(imageEmptyLayout(140, 120, pick)).toMatchObject({
      parts: { title: false, line: false, button: true },
    });
    expect(imageEmptyLayout(60, 60, pick)).toMatchObject({ kind: 'badge' });
  });

  it('fits a round box in its inscribed square', () => {
    expect(imageEmptyLayout(200, 200, pick)).toMatchObject({ parts: { line: true } });
    expect(imageEmptyLayout(200, 200, { canPick: true, round: true })).toMatchObject({
      parts: { line: false },
    });
  });

  it('grows with the box, within its cap', () => {
    const big = imageEmptyLayout(1200, 800, pick);
    expect(big.kind === 'face' && big.scale).toBeGreaterThan(2);
    const huge = imageEmptyLayout(10000, 10000, pick);
    expect(huge.kind === 'face' && huge.scale).toBe(3);
  });

  it('shows only the heading to someone who cannot pick', () => {
    expect(imageEmptyLayout(300, 220, { canPick: false, round: false })).toMatchObject({
      parts: { title: true, line: false, button: false },
    });
  });

  it('treats a degenerate box as a small badge, never NaN', () => {
    expect(imageEmptyLayout(-5, 0, pick)).toEqual({ kind: 'badge', badgePx: 12 });
  });
});

const theme = (id: string) => THEMES.find((t) => t.id === id)!;
const vars = (el: HTMLElement) => ({
  body: el.style.getPropertyValue('--ph-body'),
  border: el.style.getPropertyValue('--ph-border'),
  ink: el.style.getPropertyValue('--ph-ink'),
});

describe('image placeholder theme', () => {
  it("wears the tab theme's own fill, accent and text on paper they suit", () => {
    // Forest: a pale green fill, a green stroke and a deep green text, on light paper.
    const { container } = draw(image(), { theme: theme('forest') });
    expect(vars(box(container))).toEqual({ body: '#dcfce7', border: '#15803d', ink: '#14532d' });
  });

  it('keeps the theme hue but turns legible on a dark page', () => {
    const { container } = draw(image(), { theme: theme('forest'), page: 'dark' });
    const v = vars(box(container));
    expect(v.body).not.toBe('#dcfce7');
    expect(contrastRatio(v.ink, v.body)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(v.border, v.body)).toBeGreaterThanOrEqual(3);
    // Still green: the green channel leads.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(v.ink.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r!);
    expect(g).toBeGreaterThan(b!);
  });

  it('stays neutral slate on the Default theme, which colours no element', () => {
    const { container } = draw(image(), { theme: theme('brand') });
    expect(vars(box(container)).ink).toBe(IMAGE_PLACEHOLDER_TONE.light.ink);
  });

  it("sets the label in the element's font", () => {
    const { container } = draw(image(), { fontFamily: '"Caveat", cursive' });
    expect(box(container).style.fontFamily).toBe('"Caveat", cursive');
  });
});

describe('image placeholder contrast', () => {
  // Every theme in the catalogue, on both papers: AA ink and hover ink, a 3:1 outline.
  for (const t of THEMES) {
    for (const surface of ['light', 'dark'] as const) {
      it(`reads on ${surface} paper in the ${t.id} theme`, () => {
        const tone = imagePlaceholderTone(surface, placeholderThemeInk(t));
        expect(contrastRatio(tone.ink, tone.body)).toBeGreaterThanOrEqual(PLACEHOLDER_INK_CONTRAST);
        expect(contrastRatio(tone.muted, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_INK_CONTRAST,
        );
        expect(contrastRatio(tone.onAccent, tone.accent)).toBeGreaterThanOrEqual(
          PLACEHOLDER_INK_CONTRAST,
        );
        expect(contrastRatio(tone.accent, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_BORDER_CONTRAST,
        );
        expect(contrastRatio(tone.border, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_BORDER_CONTRAST,
        );
      });
    }
  }

  it('reads for any theme colours at all (a seeded sweep of custom themes)', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 256;
    const hex = () =>
      '#' +
      [rand(), rand(), rand()].map((v) => Math.floor(v).toString(16).padStart(2, '0')).join('');
    for (let i = 0; i < 500; i++) {
      const ink = { accent: hex(), fill: i % 3 ? hex() : null, text: i % 2 ? hex() : null };
      for (const surface of ['light', 'dark'] as const) {
        const tone = imagePlaceholderTone(surface, ink);
        expect(contrastRatio(tone.ink, tone.body)).toBeGreaterThanOrEqual(PLACEHOLDER_INK_CONTRAST);
        expect(contrastRatio(tone.muted, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_INK_CONTRAST,
        );
        expect(contrastRatio(tone.onAccent, tone.accent)).toBeGreaterThanOrEqual(
          PLACEHOLDER_INK_CONTRAST,
        );
        expect(contrastRatio(tone.accent, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_BORDER_CONTRAST,
        );
        expect(contrastRatio(tone.border, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_BORDER_CONTRAST,
        );
      }
    }
  });

  // Every body is opaque, so the ink is measured against the body alone, whatever lies under it.
  for (const surface of ['light', 'dark'] as const) {
    const t = IMAGE_PLACEHOLDER_TONE[surface];
    it(`meets AA text contrast on ${surface} paper, heading, line and button`, () => {
      expect(contrastRatio(t.ink, t.body)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(t.muted, t.body)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
    it(`keeps its dashed outline at 3:1 on ${surface} paper`, () => {
      expect(contrastRatio(t.border, t.body)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.hoverBorder, t.body)).toBeGreaterThanOrEqual(3);
    });
    it(`declares only opaque colours on ${surface} paper`, () => {
      for (const c of Object.values(t)) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    });
  }
});
