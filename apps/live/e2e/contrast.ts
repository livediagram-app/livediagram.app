import type { Page } from '@playwright/test';

// The contrast audit's measuring stick (docs/specs/003-system-architecture/e2e-smoke.md, contrast audit):
// every visible text node on the page, its colour against the background actually painted under it,
// held to WCAG 2.2 SC 1.4.3. Runs inside the page, so it reads computed styles, not class names.

export type ContrastFailure = {
  text: string;
  where: string;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
};

export type ContrastReport = {
  measured: number;
  failures: ContrastFailure[];
  // Text the audit cannot measure honestly, by reason; reported, never failed (D7 in
  // docs/specs/004-interface-design/blueprints/DEFAULTS.md).
  skipped: Record<string, number>;
};

// Evaluated in the browser: keep it self-contained (no imports, no closures over module scope).
function auditInPage(): ContrastReport {
  type RGBA = [number, number, number, number];
  // Any CSS colour (rgb, oklch, oklab, color-mix already resolved...) to sRGB bytes: paint it into a
  // 1x1 canvas and read the pixel back. Tailwind v4 computes its palette in oklch, so a parser that
  // only knew rgb() would silently drop every layer it could not read.
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const cache = new Map<string, RGBA | null>();
  const parse = (value: string): RGBA | null => {
    if (!value || value === 'none' || value === 'transparent') return null;
    // A canvas silently ignores a colour it cannot parse and keeps its previous fillStyle, which
    // would report the last colour instead; reject what is not a colour up front.
    if (!CSS.supports('color', value)) return null;
    const hit = cache.get(value);
    if (hit !== undefined) return hit;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    const out: RGBA | null = a === 0 ? null : [r!, g!, b!, a! / 255];
    cache.set(value, out);
    return out;
  };
  const COLOUR_TOKEN = /(?:rgba?|oklab|oklch|lab|lch|hsla?|hwb|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi;
  const over = (top: RGBA, under: RGBA): RGBA => {
    const a = top[3];
    return [
      top[0] * a + under[0] * (1 - a),
      top[1] * a + under[1] * (1 - a),
      top[2] * a + under[2] * (1 - a),
      1,
    ];
  };
  const lum = ([r, g, b]: RGBA) => {
    const ch = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const ratio = (a: RGBA, b: RGBA) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  const hex = (c: RGBA) =>
    '#' +
    c
      .slice(0, 3)
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('');
  const describe = (el: Element) => {
    const cls = typeof el.className === 'string' ? el.className : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 4).join('.') : ''}`;
  };

  const skipped: Record<string, number> = {};
  const skip = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };
  const failures: ContrastFailure[] = [];
  let measured = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').trim();
    const el = node.parentElement;
    if (!text || !el) continue;
    if (el.closest('script, style, noscript, template, title, option')) continue;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      skip('visually hidden');
      continue;
    }
    // Glyphs drawn smaller than 6px are part of a picture (the minimap, a diagram thumbnail), which
    // WCAG 1.4.3 exempts as incidental text.
    if (rect.height < 6) {
      skip('picture-scale text');
      continue;
    }
    if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) {
      continue; // off-screen: another viewport's problem
    }
    const style = getComputedStyle(el);
    if (style.visibility !== 'visible') continue;
    if (el.closest('[inert]')) continue;
    if (el.closest(':disabled, [aria-disabled="true"]')) {
      skip('disabled control'); // WCAG 1.4.3 exempts inactive components
      continue;
    }

    // Colour of the glyphs, and the opacity every ancestor applies to them.
    const isSvg = el instanceof SVGElement;
    const fg0 = parse(isSvg ? style.fill : style.color);
    if (!fg0 || style.getPropertyValue('-webkit-text-fill-color').includes('rgba(0, 0, 0, 0)')) {
      skip('unpainted glyphs');
      continue;
    }
    let opacity = isSvg ? Number(style.fillOpacity || 1) : 1;
    let filtered = false;
    const layers: RGBA[][] = [];
    let image = false;
    for (let a: Element | null = el; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      opacity *= Number(s.opacity);
      if (s.filter !== 'none' || s.mixBlendMode !== 'normal') filtered = true;
      const img = s.backgroundImage;
      if (img && img !== 'none') {
        if (/gradient/.test(img)) {
          const stops = [...img.matchAll(COLOUR_TOKEN)]
            .map((m) => parse(m[0]))
            .filter((c): c is RGBA => c !== null);
          if (stops.length > 0) layers.push(stops);
          if (stops.every((c) => c[3] >= 1)) break;
          continue;
        }
        image = true;
        break;
      }
      const bg = parse(s.backgroundColor);
      if (bg && bg[3] > 0) {
        layers.push([bg]);
        if (bg[3] >= 1) break;
      }
    }
    if (opacity === 0) continue;
    if (filtered) {
      skip('under a CSS filter');
      continue;
    }
    if (image) {
      skip('over an image');
      continue;
    }
    // Composite the layers bottom-up onto the page (white when nothing below is opaque), taking
    // the worst stop of any gradient.
    let backgrounds: RGBA[] = [[255, 255, 255, 1]];
    for (const layer of layers.reverse()) {
      backgrounds = backgrounds.flatMap((under) => layer.map((top) => over(top, under)));
    }
    const fg: RGBA = [fg0[0], fg0[1], fg0[2], fg0[3] * opacity];
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const required = large ? 3 : 4.5;
    let worst = Infinity;
    let worstBg = backgrounds[0]!;
    for (const bg of backgrounds) {
      const r = ratio(over(fg, bg), bg);
      if (r < worst) [worst, worstBg] = [r, bg];
    }
    measured += 1;
    if (worst + 1e-6 < required) {
      failures.push({
        text: text.slice(0, 40),
        where: describe(el),
        fg: hex(over(fg, worstBg)),
        bg: hex(worstBg),
        ratio: Math.round(worst * 100) / 100,
        required,
      });
    }
  }
  return { measured, failures, skipped };
}

/** Finish every running animation, then audit the page as it rests. */
export async function auditContrast(page: Page): Promise<ContrastReport> {
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => {
      // An infinite animation (a spinner, an ambient float) cannot finish; it is left running.
      if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish();
    }),
  );
  return page.evaluate(auditInPage);
}
