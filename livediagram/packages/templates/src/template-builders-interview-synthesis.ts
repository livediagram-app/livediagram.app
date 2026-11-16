// Interview Synthesis (docs/specs/008-canvas/canvas-and-palette.md "Templates"): what five restaurant interviews said,
// on the retro kit's board (template-retro-kit.ts). The left rail holds the research question, a card per participant
// (an initial in their colour, who they are and one fact) and the session's timer and vote. Three theme columns hold
// the quotes on stickies tinted by who said them, then the insight the theme adds up to and a "How might we" question
// that turns it into an opportunity to vote on.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import {
  CONTENT,
  RETRO,
  RETRO_HUES,
  RETRO_INK,
  RETRO_MUTED,
  panelHeading,
  railNote,
  retroHeader,
  retroHeading,
  retroNotesTop,
  retroPanel,
  retroSticky,
  sessionButtons,
  type RetroHue,
} from './template-retro-kit';

type Participant = { id: string; name: string; who: string; hue: RetroHue };
const PEOPLE: readonly Participant[] = [
  { id: 'P1', name: 'Marco', who: 'Owner, pizzeria · 60 orders a night', hue: RETRO_HUES.amber },
  { id: 'P2', name: 'Aisha', who: 'Manager, Lebanese grill · 3 apps today', hue: RETRO_HUES.sky },
  { id: 'P3', name: 'Ben', who: 'Head chef, ramen bar · no tablet', hue: RETRO_HUES.green },
  { id: 'P4', name: 'Lucy', who: 'Owner, bakery · tried us in 2024', hue: RETRO_HUES.rose },
  { id: 'P5', name: 'Dev', who: 'Ops lead, 4-site chain · runs the POS', hue: RETRO_HUES.violet },
];
const byId = (id: string) => PEOPLE.find((p) => p.id === id)!;

type Theme = {
  label: string;
  hint: string;
  icon: string;
  hue: RetroHue;
  quotes: readonly [string, string][];
  insight: string;
  hmw: string;
};
const THEMES: readonly Theme[] = [
  {
    label: 'Tablet fatigue',
    hint: 'One more screen on the pass',
    icon: 'monitor',
    hue: RETRO_HUES.sky,
    quotes: [
      ['P2', '“Three tablets beep at once and nobody knows which one.”'],
      ['P3', '“There’s no room on the pass for another screen.”'],
      ['P5', '“If it doesn’t print on the POS, the kitchen won’t see it.”'],
    ],
    insight: 'Kitchens want orders where they already look, not on a new device.',
    hmw: 'How might we put Plateful orders on the printer and POS they already have?',
  },
  {
    label: 'Commission doubts',
    hint: 'What it costs, and what it brings',
    icon: 'percent',
    hue: RETRO_HUES.amber,
    quotes: [
      ['P1', '“30% on a £12 pizza leaves me nothing.”'],
      ['P4', '“I left because the fees came before the customers did.”'],
      ['P5', '“Show me new customers, not my regulars ordering through you.”'],
    ],
    insight: 'Owners judge the fee against new customers, and can’t see those today.',
    hmw: 'How might we show each restaurant the customers we brought them?',
  },
  {
    label: 'Slow to switch',
    hint: 'Menus, photos, payouts',
    icon: 'clock',
    hue: RETRO_HUES.green,
    quotes: [
      ['P2', '“Typing 80 dishes in again took my whole Sunday.”'],
      ['P4', '“The photos were the worst part.”'],
      ['P1', '“Payouts took two weeks to start.”'],
    ],
    insight: 'Setup costs a week of evenings, so switching waits for a quiet month.',
    hmw: 'How might we have a restaurant live by tonight from the menu they already have?',
  },
];

export function buildInterviewSynthesis(cx: number, cy: number): Element[] {
  const { railW, gap, pad, titleH, subtitleH, headGap, stickyGap } = RETRO;
  const colW = 420;
  const quoteH = 96;
  const insightH = 112;
  const hmwH = 112;
  const notesTop0 = retroNotesTop(0);
  const colH = notesTop0 + 3 * (quoteH + stickyGap) + 36 + insightH + stickyGap + 36 + hmwH + pad;
  const totalW = railW + gap + 3 * colW + 2 * gap;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;

  // The rail: the question, who we spoke to, then the timer and vote.
  const questionH = 132;
  const peopleY = top + questionH + 20;
  const personH = 64;
  const buttonY = peopleY + 40 + PEOPLE.length * (personH + 10) + 10;
  const noteY = buttonY + RETRO.buttonH + 12;
  const rail: Element[] = [
    retroPanel(x0, top, railW, questionH, { fill: '#f8fafc', stroke: '#94a3b8' }),
    panelHeading(x0 + pad, top + 12, railW - pad * 2, 'Research question'),
    {
      ...createText(x0 + pad, top + 50),
      width: railW - pad * 2,
      height: questionH - 62,
      label: 'What stops restaurants switching to Plateful?',
      textSize: 'md',
      textBold: true,
      textColor: RETRO_INK,
      textAlignX: 'left',
      textAlignY: 'top',
      ...CONTENT,
    },
    {
      ...createText(x0, peopleY),
      width: railW,
      height: 32,
      label: 'Who we spoke to',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      ...CONTENT,
    },
    ...PEOPLE.map((p, i): Element => {
      const { tags: _tags, ...card } = createShape('card', x0, peopleY + 40 + i * (personH + 10));
      return {
        ...card,
        width: railW,
        height: personH,
        cardMedia: 'initial',
        // Name first, so the card's initial is the person's; the id the quotes cite follows it.
        pageTitle: `${p.name} · ${p.id}`,
        pageSubtitle: p.who,
        label: '',
        fillColor: p.hue.sticky.fill,
        strokeColor: p.hue.headerColor,
        textColor: p.hue.sticky.text,
        themeLockFill: true,
        ...CONTENT,
      };
    }),
    ...sessionButtons(x0, buttonY, railW, { minutes: 15, dots: 3 }),
    railNote(
      x0,
      noteY,
      railW,
      Math.max(48, top + colH - noteY),
      'Fifteen minutes to cluster and write insights, then three dots each on the question to chase first.',
    ),
  ];

  const columns = THEMES.flatMap((theme, i): Element[] => {
    const x = x0 + railW + gap + i * (colW + gap);
    const quotesTop = retroNotesTop(top);
    const insightLabelY = quotesTop + theme.quotes.length * (quoteH + stickyGap);
    const insightY = insightLabelY + 36;
    const hmwLabelY = insightY + insightH + stickyGap;
    const hmwY = hmwLabelY + 36;
    const label = (y: number, text: string): Element => ({
      ...createText(x + pad, y),
      width: colW - pad * 2,
      height: 30,
      label: text,
      textSize: 'sm',
      textBold: true,
      textColor: RETRO_MUTED,
      textAlignX: 'left',
      ...CONTENT,
    });
    return [
      retroPanel(x, top, colW, colH, theme.hue),
      ...retroHeader(x, top, colW, theme.label, theme.hint, theme.icon, theme.hue.headerColor),
      ...theme.quotes.map(([who, quote], q) =>
        retroSticky(
          x + pad,
          quotesTop + q * (quoteH + stickyGap),
          colW - pad * 2,
          quoteH,
          `${who}  ${quote}`,
          byId(who).hue.sticky,
        ),
      ),
      label(insightLabelY, 'Insight'),
      {
        ...createShape('square', x + pad, insightY),
        width: colW - pad * 2,
        height: insightH,
        label: theme.insight,
        textSize: 'md',
        textBold: true,
        fillColor: '#ffffff',
        strokeColor: theme.hue.headerColor,
        strokeWidth: 'thick',
        textColor: RETRO_INK,
        themeLockFill: true,
        ...CONTENT,
      },
      label(hmwLabelY, 'How might we'),
      {
        ...retroSticky(x + pad, hmwY, colW - pad * 2, hmwH, theme.hmw, RETRO_HUES.lime.sticky),
        textSize: 'md',
      },
    ];
  });

  return [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Interview synthesis · restaurant switching',
      'Five interviews, three themes. Each quote is tinted by who said it; each theme ends in an insight and a question to chase.',
    ),
    ...rail,
    ...columns,
  ];
}
