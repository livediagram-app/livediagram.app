// Conversion-funnel template: four narrowing stages from first touch
// to purchase, with stage counts down the right side and the
// stage-to-stage conversion rates in the gaps. Its own file because it
// is neither a tree nor a board: a stacked-silhouette diagram like the
// pyramid, but built from flipped trapezoids so each tier genuinely
// tapers.
//
// The builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so the template is
// self-describing. See spec/09 "Templates" for the catalogue.

import { createShape, createText, type Element } from '@livediagram/diagram';

export function buildFunnel(cx: number, cy: number): Element[] {
  // The trapezoid shape renders narrow-top / wide-bottom (22..78 over
  // 2..98 in its 100-unit box), so each tier is rotated 180° to taper
  // downward. Rotation flips the label too, so tiers stay unlabelled
  // and a separate text element carries each stage name. Chaining the
  // widths so one tier's bottom edge (56% of its box) meets the next
  // tier's top edge (96% of its box) makes the silhouette read as one
  // continuous funnel: nextW = W * 0.56 / 0.96.
  const tierH = 138;
  const tierGap = 26;
  const topW = 820;
  const taper = 0.56 / 0.96;

  type Stage = { label: string; count: string; conversion?: string };
  const stages: Stage[] = [
    { label: 'Awareness', count: '12,400 visitors' },
    { label: 'Interest', count: '3,100 sign-ups', conversion: '25%' },
    { label: 'Decision', count: '930 trials', conversion: '30%' },
    { label: 'Action', count: '210 customers', conversion: '23%' },
  ];

  const totalH = stages.length * tierH + (stages.length - 1) * tierGap;
  const y0 = cy - totalH / 2;
  const countX = cx + topW / 2 + 60;
  const labelW = 260;

  const elements: Element[] = [];
  let tierW = topW;
  stages.forEach((stage, i) => {
    const y = y0 + i * (tierH + tierGap);

    elements.push({
      ...createShape('trapezoid', cx - tierW / 2, y),
      width: tierW,
      height: tierH,
      rotation: 180,
      // The mouth of the funnel gets a gentle tint; the stage names are
      // separate overlay text, so the hero tier must stay light enough
      // for default-ink text ('bold' navy would swallow the label).
      ...(i === 0 ? { colorPreset: 'soft' } : {}),
    });
    // Stage name overlaid on the tier (the rotated shape can't carry
    // its own label the right way up).
    elements.push({
      ...createText(cx - labelW / 2, y + tierH / 2 - 24),
      width: labelW,
      height: 48,
      label: stage.label,
      textSize: 'lg',
      textAlignX: 'center',
    });
    // Count rail down the right-hand side, aligned to tier centres.
    elements.push({
      ...createText(countX, y + tierH / 2 - 20),
      width: 240,
      height: 40,
      label: stage.count,
      textSize: 'md',
      textAlignX: 'left',
    });
    // Conversion rate in the gap above this tier, next to the taper.
    if (stage.conversion) {
      elements.push({
        ...createText(countX, y - tierGap / 2 - 14),
        width: 240,
        height: 28,
        label: `↓ ${stage.conversion} convert`,
        textSize: 'sm',
        textAlignX: 'left',
        textColor: '#64748b',
      });
    }

    tierW = tierW * taper;
  });

  return elements;
}
