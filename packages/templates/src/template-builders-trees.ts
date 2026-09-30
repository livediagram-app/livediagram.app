// The org chart builder (docs/specs/008-canvas/canvas-and-palette.md "Templates"). Pure:
// (cx, cy) -> Element[]. The flowchart that used to share this file lives in
// ./template-builders-flowchart (re-exported below so imports stay put); the
// mind maps live in ./template-builders-mindmaps.

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  runsPlainText,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livediagram/document';
import { BOTTOM_EXITS, rake, sideRake } from './template-rake';

export { buildFlowchart } from './template-builders-flowchart';

// Org chart: a real leadership team rather than a ladder of job titles. Every
// card is a PERSON (name in bold over their role, a person glyph), so the chart
// answers "who do I ask?" as well as "who reports to whom?". The CEO sits on
// top in the bold preset with a Chief of Staff beside them on a staff line
// (the convention for an advisory role outside the chain). Below, each team is
// a tinted container in its own hue, with a header naming the team and its
// headcount: the VP card spans the team, and its reports stack down a spine
// off the VP's lower-left, which keeps a wide org readable at laptop width.
// Two conventions a real org needs and a toy chart never shows: a DOTTED-LINE
// report (a dashed connector from Engineering's solutions engineer across to
// the VP Sales, whose deals they support) and an OPEN ROLE (a dashed card for
// the hire Product is making). A key underneath spells out the three line and
// card treatments. Lines carry no arrowheads: an org chart shows belonging.
type OrgTeam = {
  name: string;
  headcount: string;
  icon: string;
  hue: { band: string; bandStroke: string; card: string; stroke: string; ink: string };
  vp: [string, string];
  reports: [string, string][];
};

const ORG_TEAMS: OrgTeam[] = [
  {
    name: 'Product',
    headcount: '8 people',
    icon: 'layers',
    hue: {
      band: '#f5f3ff',
      bandStroke: '#ddd6fe',
      card: '#ede9fe',
      stroke: '#8b5cf6',
      ink: '#5b21b6',
    },
    vp: ['Ana Souza', 'VP Product'],
    reports: [
      ['Kai Tanaka', 'Product manager'],
      ['Zoe Adams', 'Design lead'],
      ['Open role', 'Product designer'],
    ],
  },
  {
    name: 'Engineering',
    headcount: '23 people',
    icon: 'code',
    hue: {
      band: '#f0f9ff',
      bandStroke: '#bae6fd',
      card: '#e0f2fe',
      stroke: '#0ea5e9',
      ink: '#075985',
    },
    vp: ['Omar Haddad', 'VP Engineering'],
    reports: [
      ['Sofia Rossi', 'Staff engineer'],
      ['Ben Carter', 'Engineering manager'],
      ['Priya Nair', 'Solutions engineer'],
    ],
  },
  {
    name: 'Sales',
    headcount: '12 people',
    icon: 'trending-up',
    hue: {
      band: '#fffbeb',
      bandStroke: '#fde68a',
      card: '#fef3c7',
      stroke: '#f59e0b',
      ink: '#92400e',
    },
    vp: ['Grace Liu', 'VP Sales'],
    reports: [
      ['Tom Reid', 'Account executive'],
      ['Nia Brooks', 'Customer success'],
      ['Raj Mehta', 'Marketing lead'],
    ],
  },
];

const MUTED = '#64748b';
// Org lines show belonging, not flow: no arrowheads.
const LINE = { arrowEnds: 'none' } as const;

// A person card: the name in bold over the role, a person glyph beside them.
function personCard(
  [name, role]: [string, string],
  x: number,
  y: number,
  w: number,
  h: number,
  look: Partial<ShapeElement>,
): ShapeElement {
  const runs: TextRun[] = [{ text: name, bold: true, size: 'md' }, { text: `\n${role}` }];
  return {
    ...createShape('square', x, y),
    width: w,
    height: h,
    label: runsPlainText(runs),
    richText: runs,
    textSize: 'sm',
    iconId: 'user',
    ...look,
  };
}

export function buildOrgChart(cx: number, cy: number): Element[] {
  const colW = 320;
  const colGap = 48;
  const pad = 20;
  const headerH = 30;
  const vpH = 76;
  const reportH = 64;
  const reportGap = 14;
  const reportInset = 94;
  const titleH = 44;
  const captionH = 28;
  const ceoW = 280;
  const ceoH = 84;
  // The rake's elbow row sits at the chord's mid-height, which must clear the
  // container tops: the CEO-to-band gap is larger than the band's own
  // header, so the elbows land in open canvas.
  const ceoGap = 104;
  const keyH = 28;
  const totalW = colW * 3 + colGap * 2;
  const bandH =
    pad +
    headerH +
    10 +
    vpH +
    22 +
    ORG_TEAMS[0]!.reports.length * (reportH + reportGap) -
    reportGap +
    pad;
  const totalH = titleH + captionH + 28 + ceoH + ceoGap + bandH + 32 + keyH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;

  const elements: Element[] = [
    {
      ...createText(left, top),
      width: totalW,
      height: titleH,
      label: 'Northwind · Leadership team',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: totalW,
      height: captionH,
      label:
        'One card per person. Solid lines are reporting lines; a dashed line is a dotted-line report.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  const arrows: Element[] = [];

  const ceoY = top + titleH + captionH + 28;
  const ceo = personCard(['Maya Chen', 'Chief Executive'], cx - ceoW / 2, ceoY, ceoW, ceoH, {
    textSize: 'md',
    richText: [{ text: 'Maya Chen', bold: true, size: 'lg' }, { text: '\nChief Executive' }],
    // Top of the chart: the strongest preset.
    colorPreset: 'bold',
  });
  // Staff line: the Chief of Staff advises the CEO from beside the chain.
  const staffW = 220;
  const staff = personCard(
    ['Leo Park', 'Chief of Staff'],
    cx + ceoW / 2 + 80,
    ceoY + (ceoH - 68) / 2,
    staffW,
    68,
    { fillColor: '#ffffff', strokeColor: '#94a3b8', textColor: '#334155' },
  );
  elements.push(ceo, staff);
  arrows.push({ ...createPinnedArrow(ceo.id, 'e', staff.id, 'w'), ...LINE });

  const bandTop = ceoY + ceoH + ceoGap;
  const vps: ShapeElement[] = [];
  const reportCards: ShapeElement[][] = [];
  ORG_TEAMS.forEach((team, i) => {
    const x = left + i * (colW + colGap);
    const { hue } = team;
    elements.push(
      {
        ...createShape('square', x, bandTop),
        width: colW,
        height: bandH,
        fillColor: hue.band,
        strokeColor: hue.bandStroke,
      },
      {
        ...createShape('icon', x + pad, bandTop + pad + (headerH - 22) / 2),
        width: 22,
        height: 22,
        iconId: team.icon,
        strokeColor: hue.ink,
      },
      // The name stays short and left, the headcount right, so the CEO's
      // connector drops through the clear middle of the header.
      {
        ...createText(x + pad + 30, bandTop + pad),
        width: 110,
        height: headerH,
        label: team.name,
        textSize: 'sm',
        textBold: true,
        textColor: hue.ink,
        textAlignX: 'left',
      },
      {
        ...createText(x + colW - pad - 100, bandTop + pad),
        width: 100,
        height: headerH,
        label: team.headcount,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'right',
      },
    );
    const vpY = bandTop + pad + headerH + 10;
    const vp = personCard(team.vp, x + pad, vpY, colW - pad * 2, vpH, {
      fillColor: hue.card,
      strokeColor: hue.stroke,
      textColor: hue.ink,
      strokeWidth: 'thick',
    });
    vps.push(vp);
    elements.push(vp);
    // Each VP line leaves the CEO from its own point on the bottom edge
    // (quarter, middle, quarter): lines sharing one anchor are fanned apart
    // at render time, which would skew the rake's first leg.
    const [anchor, fx] = BOTTOM_EXITS[i]!;
    arrows.push({
      ...createPinnedArrow(ceo.id, anchor, vp.id, 'n'),
      ...LINE,
      arrowStyle: 'angled',
      curvePoints: rake(
        { x: ceo.x + ceoW * fx, y: ceoY + ceoH },
        { x: vp.x + vp.width / 2, y: vpY },
      ),
    });

    const cards = team.reports.map((person, j) => {
      const open = person[0] === 'Open role';
      // Each card sits a hair (2px) further left than the one above. Lines
      // sharing the VP's anchor are fanned apart at render time in the order
      // of where they end, so the stagger puts the longest line outermost
      // and the spine's elbows nest instead of crossing.
      const card = personCard(
        person,
        x + pad + reportInset - j * 2,
        vpY + vpH + 22 + j * (reportH + reportGap),
        colW - pad * 2 - reportInset,
        reportH,
        open
          ? // An open role: a dashed, unfilled card with an add-person glyph.
            {
              iconId: 'user-plus',
              fillColor: '#ffffff',
              strokeColor: hue.stroke,
              strokeStyle: 'dashed',
              textColor: hue.ink,
            }
          : { fillColor: '#ffffff', strokeColor: hue.stroke, textColor: '#334155' },
      );
      // Reports hang off a spine from the VP's lower-left quarter: down,
      // then across into each card's west face.
      arrows.push({
        ...createPinnedArrow(vp.id, 'ssw', card.id, 'w'),
        ...LINE,
        arrowStyle: 'angled',
      });
      return card;
    });
    reportCards.push(cards);
    elements.push(...cards);
  });

  // The dotted-line report: Engineering's solutions engineer supports Sales
  // deals, so a dashed connector runs across the gap between the two bands
  // into the VP Sales. Two waypoints keep it in the gap (across, up, across).
  const priya = reportCards[1]![2]!;
  const sales = vps[2]!;
  const gapX = left + 2 * colW + colGap + colGap / 2;
  arrows.push({
    ...createPinnedArrow(priya.id, 'e', sales.id, 'w'),
    ...LINE,
    arrowStyle: 'angled',
    strokeStyle: 'dashed',
    curvePoints: sideRake(
      { x: priya.x + priya.width, y: priya.y + priya.height / 2 },
      { x: sales.x, y: sales.y + sales.height / 2 },
      gapX,
    ),
  } as ArrowElement);

  // The key: a sample of each line and the open-role card, muted.
  const keyY = bandTop + bandH + 32;
  const keyCell = 250;
  const keyLine = (i: number, dashed: boolean, label: string) => {
    const x = left + 56 + i * keyCell;
    elements.push(
      {
        ...createArrow(x, keyY + keyH / 2, x + 40, keyY + keyH / 2),
        ...LINE,
        ...(dashed ? { strokeStyle: 'dashed' as const } : {}),
      },
      {
        ...createText(x + 52, keyY),
        width: 180,
        height: keyH,
        label,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
    );
  };
  elements.push({
    ...createText(left, keyY),
    width: 48,
    height: keyH,
    label: 'Key',
    textSize: 'sm',
    textBold: true,
    textColor: MUTED,
    textAlignX: 'left',
  });
  keyLine(0, false, 'Reports to');
  keyLine(1, true, 'Dotted-line report');
  const openX = left + 56 + 2 * keyCell;
  elements.push(
    {
      ...createShape('square', openX, keyY + 4),
      width: 40,
      height: keyH - 8,
      label: '',
      fillColor: '#ffffff',
      strokeColor: '#94a3b8',
      strokeStyle: 'dashed',
    },
    {
      ...createText(openX + 52, keyY),
      width: 180,
      height: keyH,
      label: 'Open role, hiring now',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  );

  return [...elements, ...arrows];
}
