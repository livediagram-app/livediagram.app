// The people templates (docs/specs/029-sheets/sheet.md "Sheet templates"): Contacts, Guest List, Grade Book and
// Habit Tracker. Example rows worked by live formulas: type over them and the counts, summary and chart follow.
import {
  CENTRE,
  DATE,
  HEAD_ROW,
  NUMBER1,
  PERCENT,
  WHOLE,
  day,
  text,
  type SheetDesign,
} from './design';
import type { StarterCell } from '../sheet-starters';

// How many days since someone was last contacted before they are due a follow-up.
export const FOLLOW_UP_DAYS = 14;

export function contactsDesign(today: number): SheetDesign {
  const people: [string, string, string, string, string, string, number, string][] = [
    [
      'Jordan Lee',
      'Northwind',
      'Head of Design',
      'jordan@example.com',
      '+44 20 7946 0000',
      'Customer',
      -3,
      'Sent the proposal',
    ],
    [
      'Priya Shah',
      'Contoso',
      'Product Manager',
      'priya@example.com',
      '+44 161 496 0000',
      'Active',
      -10,
      'Follow up on pricing',
    ],
    [
      'Sam Okafor',
      'Fabrikam',
      'Engineering Lead',
      'sam@example.com',
      '+44 117 496 0000',
      'Lead',
      -21,
      'Met at the conference',
    ],
    [
      'Alex Moreau',
      'Tailspin',
      'Founder',
      'alex@example.com',
      '+44 131 496 0000',
      'Lead',
      -35,
      'Intro from Priya',
    ],
    [
      'Mei Chen',
      'Litware',
      'Operations Director',
      'mei@example.com',
      '+44 29 2018 0000',
      'Customer',
      -6,
      'Renewal due in spring',
    ],
    [
      'Tomás Silva',
      'Woodgrove',
      'Finance Lead',
      'tomas@example.com',
      '+44 113 496 0000',
      'Active',
      -18,
      'Wants a demo for the team',
    ],
  ];
  // Body rows 5 to 10, the total on 11.
  return {
    heading: 'Contacts',
    subtitle: `Example people: replace them with yours. Anyone not contacted for ${FOLLOW_UP_DAYS} days is marked to follow up.`,
    span: 10,
    accent: 'indigo',
    widths: [140, 120, 150, 190, 150, 90, 120, 90, 100, 200],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: [
          'Name',
          'Company',
          'Role',
          'Email',
          'Phone',
          'Stage',
          'Last Contacted',
          'Days Since',
          'Follow Up',
          'Notes',
        ],
        rows: people.map(
          ([name, company, role, email, phone, stage, ago, notes], i): StarterCell[] => {
            const r = i + 5;
            return [
              name,
              company,
              role,
              text(email),
              text(phone),
              stage,
              day(today, ago),
              `=TODAY()-G${r}`,
              `=IF(H${r}>${FOLLOW_UP_DAYS},"Follow Up","")`,
              notes,
            ];
          },
        ),
        total: [
          '=COUNTA(A5:A10)&" contacts"',
          null,
          null,
          null,
          null,
          '=COUNTIF(F5:F10,"Customer")&" customers"',
          null,
          '=AVERAGE(H5:H10)',
          '=COUNTIF(I5:I10,"Follow Up")&" due"',
          null,
        ],
        formats: [null, null, null, null, null, null, DATE, WHOLE, CENTRE, null],
      },
    ],
  };
}

export function guestsDesign(): SheetDesign {
  const guests: [string, number, string, string, string, string][] = [
    ['Jordan Lee', 2, 'Yes', 'Vegetarian', '1', 'Best man'],
    ['Priya Shah', 1, 'Yes', 'None', '1', ''],
    ['Sam Okafor', 2, 'Maybe', 'Gluten free', '2', 'Back from travel that week'],
    ['Alex Moreau', 4, 'Yes', 'None', '2', 'Two children'],
    ['Mei Chen', 2, 'No', '', '', 'Sends her love'],
    ['Tomás Silva', 1, 'Awaiting', '', '', 'Invite resent'],
    ['Grace Park', 2, 'Yes', 'Vegan', '3', ''],
    ['Leo Brennan', 1, 'Awaiting', '', '', ''],
    ['Nadia Haddad', 2, 'Yes', 'Nut allergy', '3', 'Tell the caterer'],
    ['Ollie Grant', 3, 'Maybe', 'None', '4', ''],
  ];
  const replies = ['Yes', 'Maybe', 'No', 'Awaiting'];
  // Body rows 5 to 14, the total on 15; the RSVP table's body on 18 to 21.
  return {
    heading: 'Event Guest List',
    subtitle:
      'Example guests: replace them with yours. Set RSVP to Yes, Maybe, No or Awaiting and the headcount follows.',
    span: 9,
    accent: 'rose',
    widths: [160, 70, 100, 130, 70, 200, 28, 150, 100],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Guest', 'Party', 'RSVP', 'Dietary Needs', 'Table', 'Notes'],
        rows: guests.map(([name, party, rsvp, diet, table, notes]): StarterCell[] => [
          name,
          String(party),
          rsvp,
          diet || null,
          table || null,
          notes || null,
        ]),
        total: [
          '=COUNTA(A5:A14)&" invitations"',
          '=SUM(B5:B14)',
          '=COUNTIF(C5:C14,"Yes")&" yes"',
          null,
          null,
          null,
        ],
        formats: [null, WHOLE, CENTRE, null, CENTRE, null],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 7],
        heading: 'Headcount',
        items: [
          { label: 'Invitations', value: '=COUNTA(A5:A14)', f: WHOLE },
          { label: 'Guests Invited', value: '=SUM(B5:B14)', f: WHOLE },
          { label: 'Attending', value: '=SUMIF(C5:C14,"Yes",B5:B14)', f: WHOLE, kind: 'result' },
          { label: 'Maybe', value: '=SUMIF(C5:C14,"Maybe",B5:B14)', f: WHOLE },
          { label: 'Awaiting a Reply', value: '=COUNTIF(C5:C14,"Awaiting")', f: WHOLE },
          { label: 'Replied', value: '=IF(I5=0,"",1-I9/I5)', f: PERCENT },
        ],
      },
      {
        kind: 'table',
        at: [16, 0],
        head: ['RSVP', 'Guests'],
        rows: replies.map((x, i) => [x, `=SUMIF($C$5:$C$14,A${18 + i},$B$5:$B$14)`]),
        formats: [null, WHOLE],
      },
    ],
    charts: [{ kind: 'pie-chart', table: 2, at: [16, 2], width: 400, height: 220 }],
  };
}

// The pass mark (an average at or over it passes) and the grade boundaries, best first.
export const PASS_MARK = 60;
const GRADES: readonly [string, number][] = [
  ['A', 90],
  ['B', 80],
  ['C', 70],
  ['D', PASS_MARK],
  ['F', 0],
];
const gradeOf = (cell: string) =>
  `=IFS(${GRADES.map(([g, at]) => (at > 0 ? `${cell}>=${at},"${g}"` : `TRUE,"${g}"`)).join(',')})`;

export function gradesDesign(): SheetDesign {
  const students: [string, number, number, number, number, number][] = [
    ['Amara Okoye', 92, 88, 95, 90, 94],
    ['Ben Carter', 74, 81, 69, 77, 72],
    ['Chloe Martin', 85, 90, 82, 88, 86],
    ['Dev Patel', 58, 64, 61, 70, 55],
    ['Ella Novak', 96, 93, 98, 95, 97],
    ['Finn Murphy', 67, 72, 58, 64, 61],
    ['Grace Kim', 81, 77, 85, 79, 83],
    ['Hugo Laurent', 49, 55, 52, 60, 47],
  ];
  // Body rows 5 to 12, the class average on 13; the grade counts' body on 17 to 21.
  return {
    heading: 'Grade Book',
    subtitle: `Example scores out of 100: type over them. Averages, grades (${PASS_MARK} passes) and the chart follow.`,
    span: 11,
    accent: 'purple',
    widths: [150, 80, 80, 80, 80, 80, 90, 70, 28, 150, 100],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Student', 'Essay', 'Quiz', 'Midterm', 'Project', 'Final', 'Average', 'Grade'],
        rows: students.map(([name, ...scores], i): StarterCell[] => [
          name,
          ...scores.map(String),
          `=AVERAGE(B${i + 5}:F${i + 5})`,
          gradeOf(`G${i + 5}`),
        ]),
        total: [
          'Class Average',
          ...['B', 'C', 'D', 'E', 'F', 'G'].map((c) => `=AVERAGE(${c}5:${c}12)`),
          gradeOf('G13'),
        ],
        formats: [null, WHOLE, WHOLE, WHOLE, WHOLE, WHOLE, NUMBER1, CENTRE],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 9],
        heading: 'Class',
        items: [
          { label: 'Students', value: '=COUNTA(A5:A12)', f: WHOLE },
          { label: 'Class Average', value: '=AVERAGE(G5:G12)', f: NUMBER1, kind: 'result' },
          { label: 'Highest', value: '=MAX(G5:G12)', f: NUMBER1 },
          { label: 'Lowest', value: '=MIN(G5:G12)', f: NUMBER1 },
          {
            label: 'Passing',
            value: `=IF(COUNTA(A5:A12)=0,"",COUNTIF(G5:G12,">=${PASS_MARK}")/COUNTA(A5:A12))`,
            f: PERCENT,
          },
        ],
      },
      {
        kind: 'table',
        at: [15, 0],
        head: ['Grade', 'Students'],
        rows: GRADES.map(([g], i) => [g, `=COUNTIF($H$5:$H$12,A${17 + i})`]),
        formats: [CENTRE, WHOLE],
      },
    ],
    charts: [{ kind: 'bar-chart', table: 2, at: [15, 2], width: 420, height: 220 }],
  };
}

// A habit's day is a checkbox (data-validation.md): ticked is TRUE.
export const TICK = 'TRUE';
const UNTICKED = 'FALSE';

export function habitsDesign(): SheetDesign {
  // Each habit's weekly goal and the days ticked so far (Monday first).
  const habits: [string, number, string][] = [
    ['Walk 8,000 steps', 7, '1101110'],
    ['Read for 20 minutes', 5, '1011100'],
    ['No phone after 10pm', 7, '1111011'],
    ['Drink 2 litres of water', 7, '1110111'],
    ['Stretch', 4, '1001010'],
    ['Write a journal', 3, '0100101'],
  ];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cols = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
  // Body rows 5 to 10, each day's count on 11.
  return {
    heading: 'Habit Tracker',
    subtitle:
      'Tick a day’s box as you go; progress against each weekly goal follows. Untick the boxes to start a new week.',
    span: 14,
    accent: 'fuchsia',
    widths: [180, 48, 48, 48, 48, 48, 48, 48, 70, 70, 90, 28, 150, 100],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Habit', ...days, 'Done', 'Goal', 'Progress'],
        rows: habits.map(([habit, goal, ticks], i): StarterCell[] => {
          const r = i + 5;
          return [
            habit,
            ...[...ticks].map((t) => (t === '1' ? TICK : UNTICKED)),
            `=COUNTIF(B${r}:H${r},TRUE)`,
            String(goal),
            `=IF(J${r}=0,"",MIN(1,I${r}/J${r}))`,
          ];
        }),
        total: [
          'Each Day',
          ...cols.map((c) => `=COUNTIF(${c}5:${c}10,TRUE)`),
          '=SUM(I5:I10)',
          '=SUM(J5:J10)',
          '=IF(J11=0,"",I11/J11)',
        ],
        formats: [null, ...days.map(() => CENTRE), WHOLE, WHOLE, PERCENT],
        inputs: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 12],
        heading: 'This Week',
        items: [
          { label: 'Ticks', value: '=I11', f: WHOLE },
          { label: 'Goals Met', value: '=COUNTIF(K5:K10,">=1")', f: WHOLE },
          { label: 'Best Day', value: '=INDEX(B4:H4,MATCH(MAX(B11:H11),B11:H11,0))' },
          { label: 'Overall', value: '=K11', f: PERCENT, kind: 'result' },
        ],
      },
    ],
    charts: [{ kind: 'bar-chart', table: 0, cols: [0, 10], at: [12, 0], width: 460, height: 220 }],
    // Monday to Sunday of every habit.
    checkboxes: [[HEAD_ROW + 1, 1, HEAD_ROW + habits.length, 7]],
  };
}
