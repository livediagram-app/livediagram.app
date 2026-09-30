// The vertical milestone timeline (docs/specs/008-canvas/canvas-and-palette.md "Templates"): a
// company history down the page. Shares its callout card and layer split
// with the horizontal timeline in template-builders-milestones.ts.
import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
} from '@livediagram/document';
import { layered, milestoneCard, MUTED, type Shape } from './template-builders-milestones';

// Vertical milestone timeline: "Northwind Coffee · our story so far", a
// company history in the classic alternating vertical layout. A downward
// spine (time flows down, arrowhead at the bottom) carries one glyph disc per
// chapter; each chapter's story card branches off one side on a pinned stem
// while its year sits big and bold on the other, so the eye can run down the
// years alone. One highlight moment (B Corp) gets an amber card and a trophy,
// the tenth birthday gets a cake, and a dashed "next chapter" at the arrow's
// tip leaves the story open for the team to write.
export function buildMilestoneTimelineVertical(cx: number, cy: number): Element[] {
  const pitch = 128;
  const disc = 48;
  const glyph = 24;
  const cardGap = 44; // disc edge -> card
  const cardW = 320;
  const cardH = 108; // tall enough that the callout heading outranks the story
  const yearGap = 28; // disc edge -> year text
  const yearW = 200;
  const titleH = 48;
  const captionH = 28;

  const BROWN = '#92400e';
  const AMBER = '#d97706';
  const chapters: {
    year: string;
    when: string;
    title: string;
    note: string;
    icon: string;
    kind?: 'highlight' | 'birthday' | 'next';
  }[] = [
    {
      year: '2016',
      when: 'May',
      title: 'A market stall',
      note: 'Ana and Tom sell 40 flat whites on day one at Broadway Market',
      icon: 'map-pin',
    },
    {
      year: '2018',
      when: 'March',
      title: 'Our first shop',
      note: 'Twelve seats on Mare Street, and a queue out of the door',
      icon: 'home',
    },
    {
      year: '2020',
      when: 'April',
      title: 'Bikes, not doors',
      note: 'Shops shut, so we delivered beans by cargo bike to 3,000 homes',
      icon: 'package',
    },
    {
      year: '2022',
      when: 'September',
      title: 'Our own roastery',
      note: 'Roasting two tonnes a month, direct from six farms',
      icon: 'globe',
    },
    {
      year: '2024',
      when: 'June',
      title: 'B Corp certified',
      note: 'Scored 104, and every cup is traceable to its farm',
      icon: 'award',
      kind: 'highlight',
    },
    {
      year: '2026',
      when: 'May',
      title: 'Ten years, twelve shops',
      note: 'Still pulling the first shot at 6:30 every morning',
      icon: 'star',
      kind: 'birthday',
    },
    {
      year: '2027',
      when: 'Next chapter',
      title: 'Up north',
      note: 'Our first shop outside London opens in Manchester',
      icon: 'flag',
      kind: 'next',
    },
  ];

  const spineH = chapters.length * pitch + 40;
  const totalH = titleH + captionH + 32 + spineH;
  const top = cy - totalH / 2;
  const spineTop = top + titleH + captionH + 32;
  const rowY = (i: number) => spineTop + 20 + pitch / 2 + i * pitch;
  const halfW = disc / 2 + cardGap + cardW;

  const scaffold: Element[] = [
    {
      ...createText(cx - halfW, top),
      width: halfW * 2,
      height: titleH,
      label: 'Northwind Coffee · our story so far',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'center',
    },
    {
      ...createText(cx - halfW, top + titleH),
      width: halfW * 2,
      height: captionH,
      label:
        'Ten years in seven chapters. Add one: copy a row, change the year, tell what happened.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'center',
    },
    {
      // The spine runs on past the last chapter: time keeps going.
      ...createArrow(cx, spineTop, cx, spineTop + spineH),
      strokeColor: '#a8a29e',
      strokeWidth: 3,
      routeBehind: false,
    },
  ];
  const content: Element[] = [];

  chapters.forEach((c, i) => {
    const y = rowY(i);
    // Cards alternate right / left; the year takes the other side.
    const right = i % 2 === 0;
    const accent = c.kind === 'highlight' ? AMBER : c.kind === 'next' ? '#64748b' : BROWN;
    const node: Shape = {
      ...createShape('circle', cx - disc / 2, y - disc / 2),
      width: disc,
      height: disc,
      label: '',
      fillColor: c.kind === 'highlight' ? '#fef3c7' : '#ffffff',
      strokeColor: accent,
      strokeWidth: 'thick',
      ...(c.kind === 'next' ? { strokeStyle: 'dashed' as const } : {}),
    };
    const cardX = right ? cx + disc / 2 + cardGap : cx - disc / 2 - cardGap - cardW;
    const card = milestoneCard(cardX, y - cardH / 2, cardW, cardH, c.title, c.note, c.icon, accent);
    if (c.kind === 'highlight') {
      card.fillColor = '#fffbeb';
      card.strokeWidth = 'thick';
      card.themeLockFill = true;
    }
    if (c.kind === 'next') card.strokeStyle = 'dashed';
    content.push(
      {
        ...createPinnedArrow(node.id, right ? 'e' : 'w', card.id, right ? 'w' : 'e'),
        arrowEnds: 'none',
        strokeColor: accent,
        strokeWidth: 2,
        ...(c.kind === 'next' ? { strokeStyle: 'dashed' as const } : {}),
      },
      node,
      {
        ...createShape('icon', cx - glyph / 2, y - glyph / 2),
        width: glyph,
        height: glyph,
        iconId: c.icon,
        strokeColor: accent,
      },
      card,
    );
    // The year, big, on the far side of the spine, with its month beneath.
    const yearX = right ? cx - disc / 2 - yearGap - yearW : cx + disc / 2 + yearGap;
    content.push(
      {
        ...createText(yearX, y - 30),
        width: yearW,
        height: 40,
        label: c.year,
        textSize: 'lg',
        textBold: true,
        textColor: accent,
        textAlignX: right ? 'right' : 'left',
      },
      {
        ...createText(yearX, y + 8),
        width: yearW,
        height: 24,
        label: c.when,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: right ? 'right' : 'left',
      },
    );
    const sticker =
      c.kind === 'highlight' ? 'emoji-trophy' : c.kind === 'birthday' ? 'emoji-cake' : undefined;
    if (sticker) {
      content.push({
        ...createShape('sticker', cardX + cardW - 34, y - cardH / 2 - 22),
        width: 52,
        height: 52,
        stickerId: sticker,
        rotation: 8,
      });
    }
  });

  return layered(scaffold, content);
}
