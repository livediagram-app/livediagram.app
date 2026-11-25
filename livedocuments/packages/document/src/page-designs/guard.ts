// The contrast guard (docs/specs/011-theme/page-designs.md "Readability"): for each text on a page, an estimate of the
// design under it; where the text would not read, a scrim (a soft plate in the page's tone) or, with the guard set to
// warn, a warning only. Pure; read once per settled change, never on a drag frame.
import { colourIsOpaque, contrastRatio } from '@liveworkspace/element-model/colour-math';
import {
  isLargeText,
  labelDrawnPx,
  labelIsBold,
  LARGE_TEXT_CONTRAST,
  TEXT_CONTRAST,
} from '@liveworkspace/element-model/text-contrast';
import { mixHex } from '@liveworkspace/model-core/color-wash';
import type { Element } from '../index';
import type { PageRect } from '../page';
import { PAGE_DESIGN_BY_ID } from './catalogue';
import type { DesignScrim, PaintedDesign } from './render';
import { calmStops } from './render';

export const SCRIM_PAD = 14;
export const SCRIM_OPACITY = 0.82;

export type DesignGuardResult = {
  scrims: DesignScrim[];
  // The ids of the texts that do not read on the design (with a scrim, before it).
  failing: string[];
};

/** The calm's share of the design at a point of the page (fractions), as the mask draws it. */
export function calmShareAt(calm: number, fx: number, fy: number): number {
  const d = Math.min(1, Math.hypot((fx - 0.5) * 2, (fy - 0.5) * 2));
  const stops = calmStops(calm);
  for (let i = 1; i < stops.length; i += 1) {
    const [o1, a1] = stops[i]!;
    const [o0, a0] = stops[i - 1]!;
    if (d <= o1) return a0 + ((a1 - a0) * (d - o0)) / Math.max(1e-6, o1 - o0);
  }
  return 1;
}

type TextLike = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  textColor?: string;
  fillColor?: string;
};

/** Which texts on the page fail on its design, and their scrims (page px). */
export function designGuard(
  d: Pick<PaintedDesign, 'id' | 'palette' | 'intensity' | 'calm' | 'tuning'>,
  rect: PageRect,
  elements: readonly Element[],
): DesignGuardResult {
  const busy = PAGE_DESIGN_BY_ID[d.id].busy;
  const p = d.palette;
  const out: DesignGuardResult = { scrims: [], failing: [] };
  for (const el of elements) {
    if (el.type !== 'text') continue;
    const t = el as unknown as TextLike;
    if (!t.label?.trim() || (t.fillColor && colourIsOpaque(t.fillColor))) continue;
    const cx = t.x + t.width / 2 - rect.x;
    const cy = t.y + t.height / 2 - rect.y;
    if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) continue;
    const share = busy * d.intensity * calmShareAt(d.calm, cx / rect.width, cy / rect.height);
    const ink = t.textColor && /^#[0-9a-f]{6}$/i.test(t.textColor) ? t.textColor : p.ink;
    const worst = Math.min(
      ...[p.a, p.b, p.c, p.ink].map((c) => contrastRatio(ink, mixHex(c, p.base, share))),
    );
    const need = isLargeText(labelDrawnPx(el), labelIsBold(el))
      ? LARGE_TEXT_CONTRAST
      : TEXT_CONTRAST;
    if (worst >= need) continue;
    out.failing.push(t.id);
    if (d.tuning.guard === 'warn') continue;
    out.scrims.push({
      x: t.x - rect.x - SCRIM_PAD,
      y: t.y - rect.y - SCRIM_PAD,
      width: t.width + SCRIM_PAD * 2,
      height: t.height + SCRIM_PAD * 2,
      fill: p.base,
      opacity: SCRIM_OPACITY,
    });
  }
  return out;
}
