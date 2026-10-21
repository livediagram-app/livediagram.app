// Compare layouts, part two (docs/specs/007-editor/pages-mode.md "Layouts"): Versus and
// Pricing Tiers. Same contract as page-layouts.ts: the page's content
// box in, uncoloured elements out, in proportions of the box so each fits every size and
// orientation; a wide page sets things side by side where a stack would be squashed.
import type { Element, ShapeElement } from '@liveplanner/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconDisc, SOURCE_H, sourceLine } from './page-layout-parts';

// The room a source line takes at the page's foot, with the gap above it.
const FOOT = SOURCE_H + 4;
const CENTRED = { textAlignX: 'center' } as const;

// A headline set centred in its box.
const centredTitle = (k: Kit, x: number, y: number, w: number, h: number, label: string) => ({
  ...k.title(x, y, w, h, label),
  ...CENTRED,
});

// A disc with a word set large in it: a circle, and a headline fitted over its middle.
function letterDisc(
  k: Kit,
  x: number,
  y: number,
  d: number,
  label: string,
  strokeWidth: ShapeElement['strokeWidth'],
): Element[] {
  const h = d * 0.5;
  return [
    k.shape('circle', x, y, d, d, { label: '', strokeWidth }),
    centredTitle(k, x + d * 0.12, y + (d - h) / 2, d * 0.76, h, label),
  ];
}

// ── Versus ──────────────────────────────────────────────────────────────

// Each stat, then how the left and the right contender score on it.
const VERSUS_STATS = [
  ['Focus time', 82, 64],
  ['Teamwork', 58, 86],
  ['Work-life balance', 79, 61],
  ['Learning from others', 54, 83],
] as const;

function versus(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // The contenders out at either side unless the page is clearly taller than wide.
  const beside = W >= H * 0.85;
  const head = beside
    ? heading(k, 'Remote vs office')
    : heading(k, 'Remote vs office', '640 of our people rated both.');
  const bottom = H - u * FOOT;
  // A contender: an icon in a large disc, its name and a line under it, centred in its column.
  const contender = (
    x: number,
    y: number,
    w: number,
    d: number,
    iconId: string,
    name: string,
    line: string,
  ) => {
    const nameH = u * 9;
    return [
      ...iconDisc(k, x + (w - d) / 2, y, d, iconId).els,
      centredTitle(k, x, y + d + u * 3, w, nameH, name),
      k.text(x, y + d + u * 3 + nameH + u, w, u * 7, line, { textAlignY: 'middle', ...CENTRED }),
    ];
  };
  const blockH = (d: number) => d + u * 3 + u * 9 + u + u * 7;
  // The stats: each row its name over two bars, the left contender's and the right's, face to
  // face either side of the middle.
  const stats = (x: number, y: number, w: number, h: number) => {
    const rowH = h / VERSUS_STATS.length;
    const nameH = Math.min(u * 7, rowH * 0.42);
    const barH = Math.min(u * 6, rowH * 0.34);
    const gap = u * 4;
    const barW = (w - gap) / 2;
    return VERSUS_STATS.flatMap(([name, a, b], i) => {
      const ry = y + i * rowH + (rowH - nameH - u * 2 - barH) / 2;
      const by = ry + nameH + u * 2;
      return [
        k.text(x, ry, w, nameH, name, {
          textSize: 'lg',
          textBold: true,
          textAlignY: 'middle',
          ...CENTRED,
        }),
        k.shape('progress-bar', x, by, barW, barH, { progress: a }),
        k.shape('progress-bar', x + barW + gap, by, barW, barH, { progress: b }),
      ];
    });
  };
  const vsBadge = (cx: number, cy: number, d: number) =>
    letterDisc(k, cx - d / 2, cy - d / 2, d, 'VS', 'extra-thick');
  const source = sourceLine(k, 'Source: staff survey of 640 people, September 2026.');
  const left = ['home', 'Remote', 'Work from anywhere'] as const;
  const right = ['briefcase', 'Office', 'Together at the desk'] as const;
  if (beside) {
    // The contenders out at either side, centred down the page; the badge and the stats between.
    const sideW = W * 0.22;
    const midX = sideW + u * 6;
    const midW = W - 2 * midX;
    const d = Math.min(sideW * 0.7, u * 26);
    const y = head.top + Math.max(0, (bottom - head.top - blockH(d)) / 2);
    const vs = u * 14;
    const rowsTop = head.top + vs + u * 4;
    return [
      ...head.els,
      ...contender(0, y, sideW, d, ...left),
      ...contender(W - sideW, y, sideW, d, ...right),
      ...vsBadge(W / 2, head.top + vs / 2, vs),
      ...stats(midX, rowsTop, midW, bottom - rowsTop),
      source,
    ];
  }
  // The contenders face to face across the top, the badge between them, the stats under.
  const vsW = W * 0.2;
  const sideW = (W - vsW) / 2;
  const d = Math.min(sideW * 0.6, u * 28, (bottom - head.top) * 0.22);
  const vs = Math.min(vsW * 0.8, u * 16);
  const rowsTop = head.top + blockH(d) + u * 8;
  return [
    ...head.els,
    ...contender(0, head.top, sideW, d, ...left),
    ...contender(sideW + vsW, head.top, sideW, d, ...right),
    ...vsBadge(W / 2, head.top + d / 2, vs),
    ...stats(0, rowsTop, W, bottom - rowsTop),
    source,
  ];
}

// ── Pricing Tiers ───────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Starter',
    blurb: 'For trying it out on your own',
    price: '£0',
    per: 'free for ever, no card needed',
    features: ['3 boards', 'Key templates', 'PNG export', 'Email help'],
    cta: 'Start free',
  },
  {
    name: 'Team',
    blurb: 'For teams who work together',
    price: '£12',
    per: 'per person, per month',
    features: ['No board limit', 'All templates', 'PDF export', 'Live editing'],
    cta: 'Try Team free',
  },
  {
    name: 'Business',
    blurb: 'For larger companies',
    price: '£24',
    per: 'per person, per month',
    features: ['All of Team', 'Single sign-on', 'Admin tools', 'Priority help'],
    cta: 'Talk to us',
  },
] as const;
// The plan the page recommends: its card is drawn heavier and badged.
const POPULAR = 1;

function pricingTiers(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // A wide page keeps its height for the cards.
  const head = k.wide
    ? heading(k, 'Simple pricing')
    : heading(k, 'Simple pricing', 'Start free. Upgrade when you grow.');
  const badgeH = u * 8;
  const top = head.top + badgeH / 2;
  const gap = u * 4;
  const cardW = (W - gap * 2) / PLANS.length;
  const cardH = H - top;
  const pad = Math.min(u * 4, cardW * 0.1);
  const innerW = cardW - pad * 2;
  const ctaH = u * 10;
  // Keep the blurb only where the features still get their room.
  const fixedH = u * 7 + u * 32 + ctaH + pad * 2;
  const blurb = cardH - fixedH - u * 11 > PLANS[0].features.length * u * 8;
  return [
    ...head.els,
    ...PLANS.flatMap((plan, i) => {
      const x = i * (cardW + gap);
      const popular = i === POPULAR;
      let y = top + pad;
      const els: Element[] = [
        k.shape('square', x, top, cardW, cardH, {
          label: '',
          borderRadius: 'lg',
          strokeWidth: popular ? 'extra-thick' : 'thin',
        }),
        k.text(x + pad, y + (popular ? u * 2 : 0), innerW, u * 7, plan.name, {
          textSize: 'lg',
          textBold: true,
        }),
      ];
      y += u * 7 + (popular ? u * 2 : 0);
      if (blurb) {
        els.push(k.text(x + pad, y, innerW, u * 10, plan.blurb));
        y += u * 11;
      }
      els.push(
        k.title(x + pad, y + u * 2, innerW, u * 14, plan.price),
        k.text(x + pad, y + u * 16, innerW, u * 10, plan.per),
        // An accent rule under the price.
        k.shape('square', x + pad, y + u * 28, innerW, u * 0.8, {
          label: '',
          borderRadius: 'full',
        }),
      );
      y += u * 32;
      const ctaY = top + cardH - pad - ctaH;
      const rowH = Math.min(u * 12, (ctaY - u * 4 - y) / plan.features.length);
      const icon = Math.min(u * 5, rowH * 0.6);
      plan.features.forEach((f, r) => {
        const ry = y + r * rowH;
        els.push(
          k.shape('icon', x + pad, ry + (rowH - icon) / 2, icon, icon, { iconId: 'check' }),
          k.text(x + pad + icon + u * 2, ry, innerW - icon - u * 2, rowH, f, {
            textAlignY: 'middle',
          }),
        );
      });
      els.push(
        k.shape('stadium', x + pad, ctaY, innerW, ctaH, {
          label: plan.cta,
          textBold: true,
          strokeWidth: popular ? 'thick' : 'thin',
        }),
      );
      if (popular) {
        const bw = Math.min(innerW, u * 30);
        els.push(
          k.shape('stadium', x + (cardW - bw) / 2, top - badgeH / 2, bw, badgeH, {
            label: 'Most popular',
            textBold: true,
            strokeWidth: 'thick',
          }),
        );
      }
      return els;
    }),
  ];
}

export const buildVersus = (b: LayoutBox) => versus(kit(b));
export const buildPricingTiers = (b: LayoutBox) => pricingTiers(kit(b));
