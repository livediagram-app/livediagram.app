// The decision tree builder (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// ./template-builders-flows (which re-exports it) once it gained outcome
// colours, stickers and a key. Pure: (cx, cy) -> Element[].

import {
  createPinnedArrow,
  createShape,
  createText,
  runsPlainText,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livediagram/document';

// Decision tree: a question every team argues about, "Can we ship on
// Friday?", answered as a balanced binary tree. Questions are diamonds (the
// root bold, the follow-ups soft) and every branch is labelled, with the SAME
// grammar at every level: No leaves by the left corner, Yes by the right, each
// as an elbow that drops square onto the next box. So the outcomes along the
// bottom read left to right from worst to best, and they are coloured by what
// they MEAN using the status presets, which stay the same under every theme:
// red to stop, amber to wait, green to go. Each outcome is a verdict in bold
// over the one-line reason, with a sticker that says it at a glance. A key
// under the leaves names the three colours.
type Outcome = {
  verdict: string;
  reason: string;
  preset: 'success' | 'warning' | 'danger';
  sticker: string;
};

const QUESTION_ROOT = 'Tests all green?';
const QUESTION_NO = 'Only a flaky test?';
const QUESTION_YES = 'Weekend on-call covered?';
// Left to right: the root's No subtree (No, Yes), then its Yes subtree.
const OUTCOMES: Outcome[] = [
  {
    verdict: "Don't ship",
    reason: 'Fix the failing test first',
    preset: 'danger',
    sticker: 'emoji-stop-sign',
  },
  {
    verdict: 'Re-run the suite',
    reason: 'Then ask again',
    preset: 'warning',
    sticker: 'emoji-repeat',
  },
  {
    verdict: 'Ship on Monday',
    reason: 'Nobody to catch a 2am page',
    preset: 'warning',
    sticker: 'emoji-calendar',
  },
  {
    verdict: 'Ship it',
    reason: 'Behind a flag, watch the graphs',
    preset: 'success',
    sticker: 'emoji-rocket',
  },
];

const MUTED = '#64748b';

export function buildDecisionTree(cx: number, cy: number): Element[] {
  const qW = 250;
  const qH = 140;
  const outW = 236;
  const outH = 84;
  // Leaves sit `leafPitch` apart, questions over the middle of their pair.
  const leafPitch = 320;
  const levelGap = 70;
  const titleH = 44;
  const captionH = 28;
  const keyH = 28;
  const totalW = leafPitch * 3 + outW;
  const totalH = titleH + captionH + 36 + qH * 2 + outH + levelGap * 2 + 44 + keyH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const q1Y = top + titleH + captionH + 36;
  const q2Y = q1Y + qH + levelGap;
  const outY = q2Y + qH + levelGap;
  const leafX = (i: number) => cx + (i - 1.5) * leafPitch;

  const question = (label: string, x: number, y: number, preset: string): ShapeElement => ({
    ...createShape('diamond', x - qW / 2, y),
    width: qW,
    height: qH,
    label,
    colorPreset: preset,
  });
  // The root is the strongest preset; the follow-ups a tint.
  const root = question(QUESTION_ROOT, cx, q1Y, 'bold');
  const qNo = question(QUESTION_NO, (leafX(0) + leafX(1)) / 2, q2Y, 'soft');
  const qYes = question(QUESTION_YES, (leafX(2) + leafX(3)) / 2, q2Y, 'soft');

  const outcomes: ShapeElement[] = OUTCOMES.map((o, i) => {
    const runs: TextRun[] = [
      { text: o.verdict, bold: true, size: 'md' },
      { text: `\n${o.reason}` },
    ];
    return {
      ...createShape('square', leafX(i) - outW / 2, outY),
      width: outW,
      height: outH,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'sm',
      colorPreset: o.preset,
    };
  });

  // No leaves by the left corner, Yes by the right: an elbow across, then
  // down square onto the child's top.
  const branch = (from: ShapeElement, to: ShapeElement, yes: boolean) => ({
    ...createPinnedArrow(from.id, yes ? 'e' : 'w', to.id, 'n'),
    arrowStyle: 'angled' as const,
    label: yes ? 'Yes' : 'No',
  });
  const arrows = [
    branch(root, qNo, false),
    branch(root, qYes, true),
    branch(qNo, outcomes[0]!, false),
    branch(qNo, outcomes[1]!, true),
    branch(qYes, outcomes[2]!, false),
    branch(qYes, outcomes[3]!, true),
  ];

  // Each verdict gets a sticker on its top-right corner, tilted off the card.
  const stickerSize = 52;
  const stickers: Element[] = outcomes.map((o, i) => ({
    ...createShape('sticker', o.x + o.width - stickerSize + 14, o.y - stickerSize / 2),
    width: stickerSize,
    height: stickerSize,
    stickerId: OUTCOMES[i]!.sticker,
  }));

  const header: Element[] = [
    {
      ...createText(left, top),
      width: totalW,
      height: titleH,
      label: 'Can we ship on Friday?',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: totalW,
      height: captionH,
      label: 'Start at the top and answer honestly. No goes left, Yes goes right.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  // The key: one chip per outcome colour, in the same status presets.
  const keyY = outY + outH + 44;
  const keyItems: [string, Outcome['preset']][] = [
    ['Go', 'success'],
    ['Wait', 'warning'],
    ['Stop', 'danger'],
  ];
  const key: Element[] = [
    {
      ...createText(left, keyY),
      width: 48,
      height: keyH,
      label: 'Key',
      textSize: 'sm',
      textBold: true,
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  keyItems.forEach(([label, preset], i) => {
    const x = left + 56 + i * 140;
    key.push(
      {
        ...createShape('square', x, keyY + 4),
        width: 36,
        height: keyH - 8,
        label: '',
        colorPreset: preset,
      },
      {
        ...createText(x + 46, keyY),
        width: 80,
        height: keyH,
        label,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
    );
  });

  return [...header, ...arrows, root, qNo, qYes, ...outcomes, ...stickers, ...key];
}
