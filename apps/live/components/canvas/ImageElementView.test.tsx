// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEMES,
  contrastRatio,
  MIN_TEXT_CONTRAST,
  type ImageElement,
  type ThemeDefinition,
} from '@livediagram/document';
import {
  CanvasSurfaceProvider,
  CanvasThemeProvider,
  PageSurfacesProvider,
} from './CanvasSurfaceContext';
import { ImageElementView } from './ImageElementView';
import {
  IMAGE_BROKEN_TONE,
  IMAGE_PLACEHOLDER_TONE,
  PLACEHOLDER_BORDER_CONTRAST,
  PLACEHOLDER_INK_CONTRAST,
  PLACEHOLDER_LABEL_MAX_PX,
  PLACEHOLDER_LABEL_MIN_PX,
  imagePlaceholderMetrics,
  imagePlaceholderTone,
  placeholderThemeInk,
} from './image-placeholder-look';

// The image placeholder (docs/specs/009-elements/images.md "Placeholder rendering") is inked for
// the paper it sits on, never the app's chrome, and its hint grows with the box.

const blob = vi.hoisted(() => ({ state: { status: 'idle' } as { status: string } }));
vi.mock('@/hooks/persistence/useImageBlobUrl', () => ({ useImageBlobUrl: () => blob.state }));

const image = (over: Partial<ImageElement> = {}): ImageElement =>
  ({
    id: 'img',
    type: 'image',
    x: 0,
    y: 0,
    width: 600,
    height: 300,
    imageId: null,
    ...over,
  }) as ImageElement;

function draw(
  el: ImageElement,
  { canvas = 'light', page, canOpenPicker = true, theme = null, fontFamily } = {} as {
    canvas?: 'light' | 'dark';
    page?: 'light' | 'dark';
    canOpenPicker?: boolean;
    theme?: ThemeDefinition | null;
    fontFamily?: string;
  },
) {
  return render(
    <CanvasThemeProvider theme={theme}>
      <CanvasSurfaceProvider surface={canvas}>
        <PageSurfacesProvider surfaces={page ? new Map([[el.id, page]]) : null}>
          <ImageElementView
            element={el}
            ownerId="o"
            documentId="d"
            shareCode={null}
            canOpenPicker={canOpenPicker}
            fontFamily={fontFamily}
          />
        </PageSurfacesProvider>
      </CanvasSurfaceProvider>
    </CanvasThemeProvider>,
  );
}

const box = (c: HTMLElement) => c.firstElementChild as HTMLElement;

beforeEach(() => {
  blob.state = { status: 'idle' };
});
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
    expect(getByText('Double-click to upload')).toBeTruthy();
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

  it('says No image, with no hover tint, to someone who cannot pick one', () => {
    const { container, getByText } = draw(image(), { canOpenPicker: false });
    expect(getByText('No image')).toBeTruthy();
    expect(box(container).className).not.toContain('hover:');
  });

  it('inks the broken state for the page too', () => {
    blob.state = { status: 'broken' };
    document.documentElement.classList.add('dark');
    const { container, getByText } = draw(image({ imageId: 'gone' }), {
      canvas: 'dark',
      page: 'light',
    });
    expect(getByText('Image unavailable')).toBeTruthy();
    expect(box(container).style.color).toBe('rgb(190, 18, 60)'); // IMAGE_BROKEN_TONE.light.ink
  });

  it('sizes the hint to the box', () => {
    const { getByText } = draw(image({ width: 900, height: 400 }));
    expect(getByText('Double-click to upload').style.fontSize).toBe('40px');
  });

  it('shows the icon alone, named for assistive tech, in a box too small for the label', () => {
    const { container, queryByText } = draw(image({ width: 40, height: 40 }));
    expect(queryByText('Double-click to upload')).toBeNull();
    expect(box(container).getAttribute('aria-label')).toBe('Double-click to upload');
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

  it('leaves the broken state rose whatever the theme', () => {
    blob.state = { status: 'broken' };
    const { container } = draw(image({ imageId: 'gone' }), { theme: theme('forest') });
    expect(box(container).style.color).toBe('rgb(190, 18, 60)');
  });
});

describe('image placeholder contrast', () => {
  // Every theme in the catalogue, on both papers: AA ink and hover ink, a 3:1 outline.
  for (const t of THEMES) {
    for (const surface of ['light', 'dark'] as const) {
      it(`reads on ${surface} paper in the ${t.id} theme`, () => {
        const tone = imagePlaceholderTone(surface, placeholderThemeInk(t));
        expect(contrastRatio(tone.ink, tone.body)).toBeGreaterThanOrEqual(PLACEHOLDER_INK_CONTRAST);
        expect(contrastRatio(tone.hoverInk, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_INK_CONTRAST,
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
        expect(contrastRatio(tone.hoverInk, tone.body)).toBeGreaterThanOrEqual(
          PLACEHOLDER_INK_CONTRAST,
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
    it(`meets AA text contrast on ${surface} paper, at rest and hovered`, () => {
      expect(contrastRatio(t.ink, t.body)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(t.hoverInk, t.body)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
    it(`keeps its dashed outline at 3:1 on ${surface} paper`, () => {
      expect(contrastRatio(t.border, t.body)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.hoverBorder, t.body)).toBeGreaterThanOrEqual(3);
    });
    it(`keeps the broken state legible on ${surface} paper`, () => {
      const b = IMAGE_BROKEN_TONE[surface];
      expect(contrastRatio(b.ink, b.body)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
    it(`declares only opaque colours on ${surface} paper`, () => {
      for (const c of [...Object.values(t), ...Object.values(IMAGE_BROKEN_TONE[surface])]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    });
  }
});

describe('imagePlaceholderMetrics', () => {
  it('grows the label with the shorter side, within its bounds', () => {
    expect(imagePlaceholderMetrics(120, 120).labelPx).toBe(12);
    expect(imagePlaceholderMetrics(960, 300).labelPx).toBe(30);
    expect(imagePlaceholderMetrics(4000, 4000).labelPx).toBe(PLACEHOLDER_LABEL_MAX_PX);
    expect(imagePlaceholderMetrics(60, 60).labelPx).toBe(PLACEHOLDER_LABEL_MIN_PX);
  });

  it('draws the icon at twice the label, never past 40% of the shorter side', () => {
    expect(imagePlaceholderMetrics(960, 300).iconPx).toBe(60);
    expect(imagePlaceholderMetrics(50, 50).iconPx).toBe(20);
  });

  it('drops the label only when the box cannot hold it under the icon', () => {
    expect(imagePlaceholderMetrics(120, 120).showLabel).toBe(true);
    expect(imagePlaceholderMetrics(40, 40).showLabel).toBe(false);
    expect(imagePlaceholderMetrics(400, 40).showLabel).toBe(false);
  });

  it('treats a degenerate box as empty, never NaN', () => {
    const m = imagePlaceholderMetrics(-5, 0);
    expect(m).toEqual({
      labelPx: PLACEHOLDER_LABEL_MIN_PX,
      iconPx: 16,
      gapPx: 4,
      showLabel: false,
    });
  });
});
