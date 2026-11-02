// The worked content of the stakeholder map template
// (./template-builders-stakeholders): who Plateful has to bring along to
// launch group ordering, and how. Pure data; the builder owns the grid.

export type Stance = 'champion' | 'neutral' | 'sceptic';

// Stance edges a stakeholder card; the paler pair tints their engagement
// plan row, so the table and the grid tell the same story.
export const STANCES: Record<
  Stance,
  { label: string; meaning: string; edge: string; tint: string; ink: string }
> = {
  champion: {
    label: 'Champion',
    meaning: 'Pushes for it',
    edge: '#16a34a',
    tint: '#dcfce7',
    ink: '#166534',
  },
  neutral: {
    label: 'Neutral',
    meaning: 'Waits to see',
    edge: '#64748b',
    tint: '#f1f5f9',
    ink: '#334155',
  },
  sceptic: {
    label: 'Sceptic',
    meaning: 'Needs convincing',
    edge: '#e11d48',
    tint: '#ffe4e6',
    ink: '#9f1239',
  },
};

export type Stakeholder = {
  name: string;
  role: string;
  stance: Stance;
  // Offset inside the quadrant's card area, so each card sits where its
  // power and interest put it.
  dx: number;
  dy: number;
};

export type Quadrant = {
  label: string;
  rule: string;
  icon: string;
  fill: string;
  stroke: string;
  ink: string;
  people: Stakeholder[];
};

// Reading order of the plot: top-left, top-right, bottom-left, bottom-right.
// Power rises up the plot, interest to the right.
export const QUADRANTS: [Quadrant, Quadrant, Quadrant, Quadrant] = [
  {
    label: 'Keep satisfied',
    rule: 'High power, low interest: meet their needs, briefly',
    icon: 'shield',
    fill: '#dbeafe',
    stroke: '#93c5fd',
    ink: '#1d4ed8',
    people: [
      { name: 'Helen Park', role: 'CFO', stance: 'sceptic', dx: 0, dy: 20 },
      { name: 'Tom Reid', role: 'Legal counsel', stance: 'neutral', dx: 148, dy: 116 },
    ],
  },
  {
    label: 'Manage closely',
    rule: 'High power, high interest: involve them early and often',
    icon: 'user-check',
    fill: '#ede9fe',
    stroke: '#c4b5fd',
    ink: '#6d28d9',
    people: [
      { name: 'Dana Okafor', role: 'CEO', stance: 'champion', dx: 188, dy: 0 },
      { name: 'Raj Mehta', role: 'VP marketing', stance: 'champion', dx: 188, dy: 84 },
      { name: 'Marco Rossi', role: 'Head of operations', stance: 'neutral', dx: 0, dy: 132 },
    ],
  },
  {
    label: 'Monitor',
    rule: 'Low power, low interest: a light touch now and then',
    icon: 'eye',
    fill: '#fef3c7',
    stroke: '#fcd34d',
    ink: '#b45309',
    people: [
      { name: 'Leo Grant', role: 'Payments partner', stance: 'neutral', dx: 148, dy: 20 },
      { name: 'Nia Adams', role: 'Brand agency', stance: 'neutral', dx: 20, dy: 112 },
    ],
  },
  {
    label: 'Keep informed',
    rule: 'Low power, high interest: share progress often',
    icon: 'mail',
    fill: '#ccfbf1',
    stroke: '#5eead4',
    ink: '#0f766e',
    people: [
      { name: 'Jo Lin', role: 'Support lead', stance: 'champion', dx: 188, dy: 10 },
      { name: 'Aisha Bello', role: 'Courier lead', stance: 'sceptic', dx: 60, dy: 104 },
    ],
  },
];

// The sceptic the team is working on, and where they want her by launch.
export const MOVE = {
  who: 'Helen Park',
  label: 'Show her the basket data',
  // The ghost card's offset in the Manage closely quadrant's card area.
  dx: 0,
  dy: 20,
};

// The next step with the sceptic, on a sticky under the plan.
export const NEXT_STEP =
  'Next: Helen’s worry is margin. Priya takes the fake-door numbers to the 14 Oct pricing call.';

// The engagement plan: what each key stakeholder needs, how and how often
// they hear from the team, and who owns it.
export const PLAN_HEAD = ['Stakeholder', 'What they need', 'Channel · cadence', 'Owner'];
export const PLAN_ROWS: [string, string, string, string][] = [
  ['Dana Okafor', 'The launch date and the retention case', 'Steering review · monthly', 'Priya'],
  [
    'Helen Park',
    'Proof bigger baskets pay for the discount',
    '1:1 · before each pricing call',
    'Priya',
  ],
  ['Raj Mehta', 'A launch story for the autumn campaign', 'Campaign stand-up · weekly', 'Ana'],
  ['Marco Rossi', 'Courier load forecast for big orders', 'Ops sync · weekly', 'Sam'],
  ['Tom Reid', 'Terms for splitting a payment', 'Doc review · each milestone', 'Ana'],
  ['Aisha Bello', 'How a group order changes a shift', 'Courier forum · fortnightly', 'Sam'],
];
