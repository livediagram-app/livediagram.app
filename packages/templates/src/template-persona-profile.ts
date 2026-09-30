// The profile card that leads the User persona template
// (template-builders-persona.ts): a cover band in Plateful orange, her sticker
// portrait overlapping it, name and archetype, four passport-style facts, the
// three numbers the team quotes, a pull quote in her own voice, the tags she
// is filed under and the research the sheet rests on, pinned to the foot.
// The card, band and glyphs are the "Card" scaffold; everything written on it
// rides "Details". Pure: pushes into `out`.

import { createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { PERSONA_FACTS, PERSONA_QUOTE, PERSONA_STATS, PERSONA_TAGS } from './template-persona-data';

export const PERSONA_CARD_W = 420;
export const PERSONA_MUTED = '#64748b';
const INK = '#1c1917';
const MUTED = PERSONA_MUTED;
const CARD_W = PERSONA_CARD_W;
// Plateful's brand orange: the cover band and the numbers the card quotes.
const BRAND = '#ea580c';
const BRAND_DEEP = '#c2410c';

const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };

// The profile card down the left edge.
export function personaProfileCard(out: Element[], x: number, top: number, height: number): void {
  const inset = 14;
  const bandH = 120;
  out.push(
    {
      ...createShape('square', x, top),
      width: CARD_W,
      height: height,
      fillColor: '#fffaf5',
      strokeColor: '#fed7aa',
      strokeWidth: 'thick',
      borderRadius: 'lg',
      themeLockFill: true,
      ...scaffold,
    },
    {
      ...createShape('square', x + inset, top + inset),
      width: CARD_W - inset * 2,
      height: bandH,
      fillColor: BRAND,
      strokeColor: BRAND,
      borderRadius: 'md',
      themeLockFill: true,
      ...scaffold,
    },
    {
      ...createText(x + inset + 18, top + inset + 12),
      width: 220,
      height: 28,
      label: 'PRIMARY PERSONA',
      textSize: 'sm',
      textBold: true,
      textColor: '#ffedd5',
      textAlignX: 'left',
      ...scaffold,
    },
    {
      ...createText(x + CARD_W - inset - 18 - 150, top + inset + 12),
      width: 150,
      height: 28,
      label: 'Plateful',
      textSize: 'sm',
      textBold: true,
      textColor: '#ffffff',
      textAlignX: 'right',
      ...content,
    },
  );
  // The segment she stands for, and how much of the business it is.
  out.push({
    ...createText(x + 170, top + inset + bandH - 40),
    width: CARD_W - 170 - inset - 18,
    height: 28,
    label: 'Segment: 38% of orders',
    textSize: 'sm',
    textColor: '#ffffff',
    textAlignX: 'right',
    ...content,
  });
  // The portrait overlaps the band's bottom edge, like a profile page. A
  // monogram rather than a face: a persona is a composite of real people, and
  // the sticker catalogue's one person glyph read as someone else entirely.
  const portrait = 116;
  out.push({
    ...createShape('circle', x + 32, top + inset + bandH - portrait / 2 - 6),
    width: portrait,
    height: portrait,
    label: 'MC',
    textSize: 'lg',
    textBold: true,
    textColor: '#9a3412',
    fillColor: '#ffedd5',
    strokeColor: '#ffffff',
    strokeWidth: 'thick',
    themeLockFill: true,
    ...content,
  });
  const innerX = x + 32;
  const innerW = CARD_W - 64;
  const nameY = top + inset + bandH + portrait / 2 + 12;
  out.push(
    {
      ...createText(innerX, nameY),
      width: innerW,
      height: 44,
      label: 'Maya Chen',
      textSize: 'scale',
      textBold: true,
      textColor: INK,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(innerX, nameY + 44),
      width: innerW,
      height: 30,
      label: 'The weeknight planner',
      textSize: 'md',
      textColor: BRAND_DEEP,
      textAlignX: 'left',
      ...content,
    },
  );
  const factsY = nameY + 44 + 30 + 18;
  const factH = 34;
  PERSONA_FACTS.forEach((fact, i) => {
    const fy = factsY + i * factH;
    out.push(
      {
        ...createShape('icon', innerX, fy + 6),
        width: 22,
        height: 22,
        iconId: fact.icon,
        strokeColor: BRAND_DEEP,
        ...scaffold,
      },
      {
        ...createText(innerX + 34, fy),
        width: innerW - 34,
        height: factH,
        label: fact.text,
        textSize: 'sm',
        textColor: '#44403c',
        textAlignX: 'left',
        ...content,
      },
    );
  });
  const statsY = factsY + PERSONA_FACTS.length * factH + 18;
  const statsH = 92;
  out.push({
    ...createShape('stat-row', innerX, statsY),
    width: innerW,
    height: statsH,
    stats: PERSONA_STATS.map((s) => ({ ...s })),
    fillColor: '#ffffff',
    strokeColor: BRAND,
    textColor: INK,
    borderRadius: 'md',
    themeLockFill: true,
    ...content,
  });
  // What the sheet rests on, pinned to the card's foot, with the tags the
  // team files her under just above it.
  const footY = top + height - 22 - 30;
  const tagH = 30;
  let tagX = innerX;
  for (const tag of PERSONA_TAGS) {
    const tagW = tag.length * 7 + 26;
    out.push({
      ...createShape('stadium', tagX, footY - 24 - tagH),
      width: tagW,
      height: tagH,
      label: tag,
      textSize: 'sm',
      fillColor: '#ffedd5',
      strokeColor: '#fdba74',
      textColor: '#9a3412',
      themeLockFill: true,
      ...content,
    });
    tagX += tagW + 8;
  }
  // The pull quote: her words, in a serif italic, hung off an accent rule,
  // centred in the room between the numbers and the tags.
  const quoteTop = statsY + statsH + 24;
  const quoteH = footY - 24 - tagH - 24 - quoteTop;
  const ruleH = 132;
  out.push(
    {
      ...createShape('square', innerX, quoteTop + (quoteH - ruleH) / 2),
      width: 5,
      height: ruleH,
      fillColor: BRAND,
      strokeColor: BRAND,
      themeLockFill: true,
      ...scaffold,
    },
    {
      ...createText(innerX + 22, quoteTop),
      width: innerW - 22,
      height: quoteH,
      label: PERSONA_QUOTE,
      textSize: 'lg',
      textItalic: true,
      font: 'lora',
      textColor: '#292524',
      textAlignX: 'left',
      textAlignY: 'middle',
      ...content,
    },
  );
  out.push(
    {
      ...createShape('icon', innerX, footY + 5),
      width: 20,
      height: 20,
      iconId: 'clipboard',
      strokeColor: MUTED,
      ...scaffold,
    },
    {
      ...createText(innerX + 30, footY),
      width: innerW - 30,
      height: 30,
      label: 'Based on 12 interviews, Aug 2026',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...content,
    },
  );
}
