// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_BACKING_INSET_PX,
  IMAGE_BACKING_INSET_VAR,
  THEMES,
  contrastRatio,
  MIN_TEXT_CONTRAST,
  type ImageElement,
  type ThemeDefinition,
} from '@livedocuments/document';
import {
  CanvasSurfaceProvider,
  CanvasThemeProvider,
  PageSurfacesProvider,
} from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { ImageElementView } from './ImageElementView';
import {
  IMAGE_BROKEN_TONE,
  IMAGE_PLACEHOLDER_TONE,
  PLACEHOLDER_BORDER_CONTRAST,
  PLACEHOLDER_INK_CONTRAST,
  PLACEHOLDER_LABEL_MAX_PX,
  PLACEHOLDER_LABEL_MIN_PX,
  imageEmptyLayout,
  imagePlaceholderMetrics,
  imagePlaceholderTone,
  placeholderThemeInk,
} from './image-placeholder-look';

// The image placeholder (docs/specs/009-elements/images.md "Placeholder rendering") is inked for
// the paper it sits on, never the app's chrome, and its hint grows with the box.

const blob = vi.hoisted(() => ({ state: { status: 'idle' } }));
vi.mock('@/hooks/persistence/useImageBlobUrl', () => ({ useImageBlobUrl: () => blob.state }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

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
  {
    canvas = 'light',
    page,
    onOpenPicker = () => {},
    canPick = true,
    theme = null,
    fontFamily,
  } = {} as {
    canvas?: 'light' | 'dark';
    page?: 'light' | 'dark';
    onOpenPicker?: (id: string) => void;
    canPick?: boolean;
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
            onOpenPicker={canPick ? onOpenPicker : undefined}
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

// The white in a contained picture's bands, from the square-cornered layer under the picture ('none' when it has
// none); the frame itself never takes a shadow.
const bandsOf = (frame: HTMLElement): string => {
  expect(frame.style.boxShadow).toBe('');
  const layer = frame.querySelector<HTMLElement>(':scope > [aria-hidden]');
  if (!layer) return 'none';
  expect(layer.style.borderRadius).toBe('');
  expect(layer.className).toMatch(/\binset-0\b/);
  return layer.style.boxShadow;
};

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

  it('shows the face with no button and no hover tint to someone who cannot pick one', () => {
    const { container, getByText, queryByRole } = draw(image(), { canPick: false });
    expect(getByText('No image yet')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
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

  it('shows Image unavailable when the bytes arrive but will not decode', () => {
    blob.state = { status: 'ready', src: 'data:image/png;base64,AAAA' } as typeof blob.state;
    const { container, getByText, queryByText } = draw(
      image({ imageId: 'data:image/png;base64,AAAA' }),
    );
    expect(queryByText('Image unavailable')).toBeNull();
    fireEvent.error(container.querySelector('img')!);
    expect(getByText('Image unavailable')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('reads as an empty state, with a Select Image button that opens the picker', () => {
    const open = vi.fn();
    const { getByText, getByRole } = draw(image(), { onOpenPicker: open });
    expect(getByText('No image yet')).toBeTruthy();
    expect(getByText('Upload one, or pick from your gallery.')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Select Image' }));
    expect(open).toHaveBeenCalledWith('img');
    expect(track).toHaveBeenCalledWith('Element', 'Used', 'ImagePlaceholder');
  });

  it('keeps a press on the button from reaching the canvas (no drag, no double-click)', () => {
    const outer = { down: vi.fn(), dbl: vi.fn() };
    const { getByRole } = render(
      <div onPointerDown={outer.down} onDoubleClick={outer.dbl}>
        <ImageElementView
          element={image()}
          ownerId="o"
          documentId="d"
          shareCode={null}
          onOpenPicker={() => {}}
        />
      </div>,
    );
    const button = getByRole('button', { name: 'Select Image' });
    fireEvent.pointerDown(button);
    fireEvent.doubleClick(button);
    expect(outer.down).not.toHaveBeenCalled();
    expect(outer.dbl).not.toHaveBeenCalled();
  });

  it('scales the face up with a big box', () => {
    const { getByText } = draw(image({ width: 900, height: 600 }));
    expect(parseFloat(getByText('No image yet').style.fontSize)).toBeGreaterThan(20);
  });

  it('makes the badge the button on a small avatar', () => {
    const open = vi.fn();
    const { container, getByRole, queryByText } = draw(
      image({ width: 64, height: 64, borderRadius: 'full' }),
      { onOpenPicker: open },
    );
    expect(box(container).dataset.imageEmpty).toBe('badge');
    expect(queryByText('No image yet')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Select Image' }));
    expect(open).toHaveBeenCalledWith('img');
  });

  it('names a lone badge for assistive tech when there is no button', () => {
    const { container } = draw(image({ width: 40, height: 40 }), { canPick: false });
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
    const { container } = draw(image(), { fontFamily: '"Kalam", cursive' });
    expect(box(container).style.fontFamily).toBe('Kalam, cursive');
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

  it('reads for any theme colours at all (a seeded sweep of random colours)', () => {
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

// docs/specs/009-elements/picture-crop-and-mask.md: a mask clips the face to its shape, greyscale greys the picture,
// and a crop lays the picture out inside a part.
describe('picture crop, mask and greyscale', () => {
  const ready = () => {
    blob.state = { status: 'ready', src: 'data:image/png;base64,AAAA' } as typeof blob.state;
  };

  it('clips a masked picture to its shape, with no rounded corners', () => {
    ready();
    const { container } = draw(image({ imageId: 'x', mask: 'circle', borderRadius: 'lg' }));
    expect(box(container).style.clipPath).toMatch(/^path\(/);
    expect(box(container).style.borderRadius).toBe('0px');
  });

  it('draws a greyscale picture in grey', () => {
    ready();
    const { container } = draw(image({ imageId: 'x', greyscale: true }));
    expect(container.querySelector('img')!.style.filter).toBe('grayscale(1)');
  });

  it('lays a cropped picture out in a part, at its own size once loaded', () => {
    ready();
    const { container } = draw(
      image({ imageId: 'x', crop: { x: 0.5, y: 0, width: 0.5, height: 1 } }),
    );
    const img = container.querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 400 });
    Object.defineProperty(img, 'naturalHeight', { value: 300 });
    fireEvent.load(img);
    const shown = container.querySelector('img')!;
    // The right half of a 4:3 picture is 2:3; contained in 600 x 300 it is 200 wide, the whole one 400.
    expect(shown.style.width).toBe('400px');
    expect(shown.style.left).toBe('-200px');
  });
});

// docs/specs/009-elements/images.md "The white under a picture": white under a transparent picture and a contain
// picture's bands, stopping short of the box's edge so a fractional zoom never shows it as a light hairline.
describe('the white under a picture', () => {
  const ready = () => {
    blob.state = { status: 'ready', src: 'data:image/png;base64,AAAA' } as typeof blob.state;
  };

  it('backs a picture that fills its box with white, inset from every edge', () => {
    ready();
    const frame = box(
      draw(image({ imageId: 'x', naturalWidth: 1200, naturalHeight: 600 })).container,
    );
    expect(frame.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(frame.style.backgroundClip).toBe('content-box');
    expect(frame.style.padding).toBe(
      `var(${IMAGE_BACKING_INSET_VAR}, ${IMAGE_BACKING_INSET_PX}px)`,
    );
    expect(frame.className).not.toContain('bg-white');
  });

  it('runs the white to the edge in the bands a contained picture leaves', () => {
    ready();
    // A square picture contained in 600 x 300: 300 wide, centred, with 150 px bands beside it.
    const frame = box(
      draw(image({ imageId: 'x', naturalWidth: 500, naturalHeight: 500 })).container,
    );
    expect(frame.style.backgroundClip).toBe('content-box');
    expect(bandsOf(frame)).toBe(
      'rgb(255, 255, 255) 150px 0px inset, rgb(255, 255, 255) -150px 0px inset',
    );
  });

  it('learns a picture size it was not given when the picture loads, for its bands', () => {
    ready();
    const { container } = draw(image({ imageId: 'x' }));
    const img = container.querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 300 });
    Object.defineProperty(img, 'naturalHeight', { value: 300 });
    fireEvent.load(img);
    expect(bandsOf(box(container))).toBe(
      'rgb(255, 255, 255) 150px 0px inset, rgb(255, 255, 255) -150px 0px inset',
    );
  });

  it('insets the white all round a cover picture, which fills the box', () => {
    ready();
    const frame = box(
      draw(image({ imageId: 'x', objectFit: 'cover', naturalWidth: 500, naturalHeight: 500 }))
        .container,
    );
    expect(bandsOf(frame)).toBe('none');
  });

  it('lays the picture over the whole box, so it alone meets the page at the edge', () => {
    ready();
    const img = box(draw(image({ imageId: 'x', objectFit: 'cover' })).container).querySelector(
      'img',
    )!;
    expect(img.className).toMatch(/\babsolute\b/);
    expect(img.className).toMatch(/\binset-0\b/);
  });

  it('keeps the inset white under a mask, the part placed from the box corner', () => {
    ready();
    const frame = box(draw(image({ imageId: 'x', mask: 'circle' })).container);
    expect(frame.style.backgroundClip).toBe('content-box');
    expect(frame.style.padding).toBe(
      `var(${IMAGE_BACKING_INSET_VAR}, ${IMAGE_BACKING_INSET_PX}px)`,
    );
    expect(frame.style.clipPath).toMatch(/^path\(/);
    expect((frame.firstElementChild as HTMLElement).className).toMatch(/\babsolute\b/);
  });
});
