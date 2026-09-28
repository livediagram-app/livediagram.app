// Customer journey map template. Its own file because a real journey map is
// a grid (five stages across, five lenses down) plus an emotion curve, which
// is more than the one-row sketch the diagrams file used to hold.
//
// The builder is pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md
// "Templates" for the catalogue entry.
import {
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

const MUTED = '#64748b';

// One persona walking through five stages, read down five lenses: what they
// DO, what they THINK, how they FEEL (an emoji curve that rises, dips at the
// painful sign-up and climbs to a happy regular), their PAIN POINTS and the
// OPPORTUNITIES those open up. Each lens has its own sticky colour, so the
// rows read at a glance and a new sticky's colour says which row it belongs
// to. The stage headers, row bands and gutter labels are the scaffold layer;
// every sticky, emoji and curve segment rides the content layer.
export function buildJourney(cx: number, cy: number): Element[] {
  type Stage = {
    name: string;
    doing: string;
    thinking: string;
    // Emoji sticker for the Feeling row plus how high it sits, 0 (low) .. 1 (high).
    mood: string;
    level: number;
    pain: string;
    opportunity: string;
  };
  const stages: Stage[] = [
    {
      name: 'Discover',
      doing: 'Sees a friend’s class photo on Instagram',
      thinking: '“I could use something calmer”',
      mood: 'emoji-smile',
      level: 0.7,
      pain: 'Every studio looks the same online',
      opportunity: 'Beginner-friendly badge in search',
    },
    {
      name: 'Compare',
      doing: 'Checks schedules and prices on three sites',
      thinking: '“Will I be the only beginner?”',
      mood: 'emoji-worried',
      level: 0.4,
      pain: 'Prices hidden behind sign-up',
      opportunity: 'Show the intro offer up front',
    },
    {
      name: 'Book',
      doing: 'Creates an account, buys an intro pass',
      thinking: '“Why do I need an account to pay?”',
      mood: 'emoji-weary',
      level: 0.08,
      pain: 'Seven-step sign-up on mobile',
      opportunity: 'Guest checkout with Apple Pay',
    },
    {
      name: 'First class',
      doing: 'Arrives early, borrows a mat',
      thinking: '“Everyone is so welcoming”',
      mood: 'emoji-heart-eyes',
      level: 0.78,
      pain: 'Couldn’t find the entrance',
      opportunity: 'Arrival tips in the confirmation',
    },
    {
      name: 'Come back',
      doing: 'Buys a ten-class pack',
      thinking: '“This is my Tuesday thing now”',
      mood: 'emoji-partying-face',
      level: 0.95,
      pain: 'Rebooking takes five taps',
      opportunity: 'One-tap “same time next week”',
    },
  ];
  type Row = {
    key: 'doing' | 'thinking' | 'feeling' | 'pain' | 'opportunity';
    label: string;
    band: string;
    sticky?: string;
    h: number;
  };
  const rows: Row[] = [
    { key: 'doing', label: 'Doing', band: '#eff6ff', sticky: '#bfdbfe', h: 124 },
    { key: 'thinking', label: 'Thinking', band: '#f5f3ff', sticky: '#ddd6fe', h: 124 },
    { key: 'feeling', label: 'Feeling', band: '#fefce8', h: 200 },
    { key: 'pain', label: 'Pain points', band: '#fff1f2', sticky: '#fecdd3', h: 124 },
    { key: 'opportunity', label: 'Opportunities', band: '#f0fdf4', sticky: '#bbf7d0', h: 124 },
  ];

  const gutterW = 190;
  const colW = 250;
  const colGap = 18;
  const rowGap = 12;
  const headerH = 64;
  const titleH = 52;
  const pad = 10;
  const gridW = gutterW + stages.length * (colW + colGap);
  const gridH =
    titleH + 24 + headerH + rowGap + rows.reduce((sum, r) => sum + r.h + rowGap, 0) - rowGap;
  const left = cx - gridW / 2;
  const top = cy - gridH / 2;
  const colX = (i: number) => left + gutterW + colGap + i * (colW + colGap);

  const scaffold: Element[] = [];
  const content: Element[] = [];

  scaffold.push({
    ...createText(left, top),
    width: gridW,
    height: titleH,
    label: 'Journey map · Sam books a first yoga class',
    textSize: 'lg',
    textAlignX: 'left',
  });

  // Stage headers, numbered and chained left to right.
  const headerY = top + titleH + 24;
  const headers = stages.map((s, i) => ({
    ...createShape('stadium', colX(i), headerY),
    width: colW,
    height: headerH,
    label: `${i + 1}  ${s.name}`,
    textSize: 'md' as const,
    textBold: true,
    colorPreset: 'soft',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  }));
  scaffold.push(...headers);
  for (let i = 0; i < headers.length - 1; i++) {
    scaffold.push({
      ...createPinnedArrow(headers[i]!.id, 'e', headers[i + 1]!.id, 'w'),
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
  }

  let y = headerY + headerH + rowGap;
  for (const row of rows) {
    // A full-width tinted band with the lens name in the left gutter.
    scaffold.push({
      ...createShape('square', left, y),
      width: gridW,
      height: row.h,
      label: '',
      // Unlocked on purpose: the band tints are brand-theme decoration, and
      // other themes repaint them so the gutter label keeps its contrast.
      // The row colour that carries meaning lives on the stickies, which
      // themes never touch.
      fillColor: row.band,
      strokeColor: row.band,
    });
    scaffold.push({
      ...createText(left + 18, y + row.h / 2 - 18),
      width: gutterW - 24,
      height: 36,
      label: row.label,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    });

    if (row.key === 'feeling') {
      // Muted +/- cues at the top and bottom of the gutter make the curve's
      // height read as a scale.
      scaffold.push(
        {
          ...createText(left + 18, y + 8),
          width: 40,
          height: 28,
          label: '+',
          textSize: 'md',
          textAlignX: 'left',
          textColor: MUTED,
        },
        {
          ...createText(left + 18, y + row.h - 36),
          width: 40,
          height: 28,
          label: '−',
          textSize: 'md',
          textAlignX: 'left',
          textColor: MUTED,
        },
      );
      const size = 64;
      const moods = stages.map((s, i) => ({
        ...createShape(
          'sticker',
          colX(i) + colW / 2 - size / 2,
          y + pad + (1 - s.level) * (row.h - 2 * pad - size),
        ),
        width: size,
        height: size,
        stickerId: s.mood,
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      }));
      // The curve: pinned segments between neighbouring faces, so dragging a
      // face up or down redraws the line through it.
      for (let i = 0; i < moods.length - 1; i++) {
        content.push({
          ...createPinnedArrow(moods[i]!.id, 'e', moods[i + 1]!.id, 'w'),
          arrowEnds: 'none',
          strokeColor: '#f59e0b',
          strokeWidth: 4,
          routeBehind: false,
          layerId: TEMPLATE_CONTENT_LAYER_ID,
        });
      }
      content.push(...moods);
    } else {
      stages.forEach((s, i) => {
        content.push({
          ...createSticky(colX(i) + pad, y + pad),
          width: colW - pad * 2,
          height: row.h - pad * 2,
          label: s[row.key as Exclude<Row['key'], 'feeling'>],
          textSize: 'sm',
          fillColor: row.sticky,
          layerId: TEMPLATE_CONTENT_LAYER_ID,
        });
      });
    }
    y += row.h + rowGap;
  }

  return [...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })), ...content];
}
