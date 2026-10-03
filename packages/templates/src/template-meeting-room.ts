// The "In the room" list of the Meeting agenda (template-builders-meeting.ts):
// who is at this week's sync and the role each one plays, an initials disc,
// name and job on the left and a tinted role chip on the right, so the
// facilitator, note-taker and timekeeper are obvious before anyone speaks.
//
// Pure: returns fresh content elements.

import { createText, type Element } from '@livediagram/document';
import { MUTED, chip, initialsDisc, type Tint } from './template-planner-parts';

const ROLE_TINTS: Record<string, Tint> = {
  Facilitator: { fill: '#e0e7ff', stroke: '#a5b4fc', ink: '#3730a3' },
  'Note-taker': { fill: '#ccfbf1', stroke: '#5eead4', ink: '#115e59' },
  Timekeeper: { fill: '#fef3c7', stroke: '#fcd34d', ink: '#92400e' },
  Presenting: { fill: '#fce7f3', stroke: '#f9a8d4', ink: '#9d174d' },
  Guest: { fill: '#f1f5f9', stroke: '#cbd5e1', ink: '#334155' },
};

const PEOPLE: { initials: string; name: string; job: string; role: string; colour: string }[] = [
  {
    initials: 'MC',
    name: 'Maya Chen',
    job: 'Product lead',
    role: 'Facilitator',
    colour: '#4f46e5',
  },
  {
    initials: 'LP',
    name: 'Leo Park',
    job: 'Product designer',
    role: 'Note-taker',
    colour: '#0d9488',
  },
  {
    initials: 'SO',
    name: 'Sam Ortiz',
    job: 'Engineering lead',
    role: 'Timekeeper',
    colour: '#d97706',
  },
  {
    initials: 'PN',
    name: 'Priya Nair',
    job: 'Data analyst',
    role: 'Presenting',
    colour: '#db2777',
  },
  { initials: 'AS', name: 'Ana Silva', job: 'Support lead', role: 'Guest', colour: '#475569' },
];

// The people rows, spread evenly down `height` so the list ends level with
// the columns beside it.
export function meetingRoom(x: number, y: number, width: number, height: number): Element[] {
  const rowH = 44;
  const rowGap = (height - PEOPLE.length * rowH) / (PEOPLE.length - 1);
  const disc = 34;
  const chipW = 98;
  const textX = x + disc + 12;
  const textW = width - disc - 12 - chipW - 8;
  return PEOPLE.flatMap((p, i) => {
    const ry = y + i * (rowH + rowGap);
    return [
      initialsDisc(x, ry + (rowH - disc) / 2, disc, p.initials, p.colour),
      {
        ...createText(textX, ry),
        width: textW,
        height: 22,
        label: p.name,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'left',
      },
      {
        ...createText(textX, ry + 22),
        width: textW,
        height: 22,
        label: p.job,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
      chip(x + width - chipW, ry + (rowH - 26) / 2, chipW, 26, p.role, ROLE_TINTS[p.role]!),
    ];
  });
}
