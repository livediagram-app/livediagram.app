// The board grids' content (docs/specs/008-canvas/canvas-and-palette.md "Templates", the use-case batch): the
// Eisenhower Matrix, PESTLE Analysis, KWL Chart and 30-60-90 Day Plan are one layout (template-builders-board-grid.ts)
// over the data below. Pure data with type-only imports, so a surface that only needs the words (a preview, a test)
// never pulls the builders in.
import type { TemplateKind } from './templates';

// A panel's colour family, by the retro kit's names (RETRO_HUES in template-retro-kit.ts).
export type BoardGridHue =
  'green' | 'rose' | 'violet' | 'sky' | 'orange' | 'blue' | 'lime' | 'amber' | 'teal' | 'slate';

export type BoardGridPanel = {
  label: string;
  // The muted prompt under the name: the question the panel answers.
  hint: string;
  // A line-art glyph from the icon catalogue.
  icon: string;
  hue: BoardGridHue;
  notes: readonly string[];
};

export type BoardGrid = {
  title: string;
  howTo: string;
  // Panels across a row; the panels fill the rows in order.
  columns: number;
  panelW: number;
  // Notes across a panel, and each note's height.
  noteCols: number;
  noteH: number;
  panels: readonly BoardGridPanel[];
  // Axis words named where they apply: one over each column, one down each row.
  axes?: { top: readonly string[]; side: readonly string[] };
  // A session rail down the left: the question, a timer and a dot vote, then how it runs.
  rail?: { question: string; minutes: number; dots: number; steps: readonly string[] };
  // The closing panel under the grid: the board's output as a checklist.
  closing?: {
    label: string;
    hint: string;
    items: readonly string[];
    done?: readonly boolean[];
  };
};

export type BoardGridKind = Extract<
  TemplateKind,
  'eisenhower-matrix' | 'pestle-analysis' | 'kwl-chart' | 'onboarding-plan'
>;

export const BOARD_GRIDS: Readonly<Record<BoardGridKind, BoardGrid>> = {
  // One person's week, sorted by two questions. The axes are the whole method, so they are named out loud.
  'eisenhower-matrix': {
    title: 'Priya’s week · Eisenhower Matrix',
    howTo:
      'Ask two questions of every task: is it urgent, and is it important? Do the first box today, book the second, hand off the third and drop the fourth.',
    columns: 2,
    panelW: 560,
    noteCols: 2,
    noteH: 104,
    axes: { top: ['Urgent', 'Not urgent'], side: ['Important', 'Not important'] },
    panels: [
      {
        label: 'Do First',
        hint: 'Urgent and important: do it today',
        icon: 'zap',
        hue: 'rose',
        notes: [
          'Fix the payroll export before Friday’s run',
          'Call back the customer escalation',
          'Sign off the launch checklist',
          'Send the board slides to Dana',
        ],
      },
      {
        label: 'Schedule',
        hint: 'Important, not urgent: book a time for it',
        icon: 'calendar',
        hue: 'blue',
        notes: [
          'Plan Q1 hiring with Sam',
          'Write the onboarding guide',
          'Book a 1:1 with each new starter',
          'Two hours to learn the new BI tool',
        ],
      },
      {
        label: 'Delegate',
        hint: 'Urgent, not important: who else can do it?',
        icon: 'users',
        hue: 'amber',
        notes: [
          'Collect the team’s expense receipts → Jo',
          'Book the offsite venue → Alex',
          'Answer the vendor survey → Mina',
          'Update the shared calendar → Jo',
        ],
      },
      {
        label: 'Drop',
        hint: 'Neither: stop doing it, or say no',
        icon: 'x',
        hue: 'slate',
        notes: [
          'Tidy the old Slack channels',
          'The second Monday status meeting',
          'Reformat last year’s slides',
          'Checking email every ten minutes',
        ],
      },
    ],
    closing: {
      label: 'Today’s three',
      hint: 'The three Do First tasks that cannot wait, each with a time',
      items: ['Customer call · 11:00', 'Payroll export · by 2pm', 'Launch checklist · before 5pm'],
    },
  },
  // The world outside Brightside Coffee, the scan that feeds its SWOT (the SWOT template's decision).
  'pestle-analysis': {
    title: 'Brightside Coffee · PESTLE: opening in York',
    howTo:
      'Look outside the business one lens at a time. Write what is changing, vote on what matters most, then carry the winners into the SWOT.',
    columns: 3,
    panelW: 400,
    noteCols: 1,
    noteH: 88,
    rail: {
      question: 'What is changing around a café in York?',
      minutes: 8,
      dots: 3,
      steps: [
        '1. Write alone, two minutes a lens.',
        '2. Read them out and merge duplicates.',
        '3. Vote: which change matters most to us?',
        '4. Carry the top three into the SWOT.',
      ],
    },
    panels: [
      {
        label: 'Political',
        hint: 'What are governments changing?',
        icon: 'building',
        hue: 'violet',
        notes: [
          'York council backs a café quarter by the station',
          'Business rates relief ends in April',
          'A ban on single-use cups is coming next year',
        ],
      },
      {
        label: 'Economic',
        hint: 'Where is money moving?',
        icon: 'trending-up',
        hue: 'blue',
        notes: [
          'Green bean prices up 30%',
          'Offices back three days a week',
          'City-centre rents rising again',
        ],
      },
      {
        label: 'Social',
        hint: 'How are people’s habits shifting?',
        icon: 'users',
        hue: 'rose',
        notes: [
          'Oat-milk orders up 40% this year',
          'Students want somewhere to work, not just a drink',
          'Locals choose independents over chains',
        ],
      },
      {
        label: 'Technological',
        hint: 'What technology changes the work?',
        icon: 'smartphone',
        hue: 'sky',
        notes: [
          'One order in four is now placed ahead in an app',
          'Card-only tills cut cash handling',
          'Smart grinders log every shot',
        ],
      },
      {
        label: 'Legal',
        hint: 'What rules must we follow?',
        icon: 'scale',
        hue: 'amber',
        notes: [
          'Allergen labels on every item we sell',
          'Minimum wage up 6.7% in April',
          'A pavement licence for outdoor seats',
        ],
      },
      {
        label: 'Environmental',
        hint: 'What does the planet ask of us?',
        icon: 'leaf',
        hue: 'green',
        notes: [
          'Customers ask how cups are recycled',
          'The riverside site floods every few winters',
          'Suppliers moving to electric vans',
        ],
      },
    ],
    closing: {
      label: 'Into the SWOT',
      hint: 'The changes that won the vote',
      items: [
        'Café quarter by the station → Opportunity',
        'City-centre rents rising → Threat',
        'Ordering ahead in the app → Opportunity',
      ],
    },
  },
  // A class's topic board: before the topic, what they know and want to know; after it, what they learned.
  'kwl-chart': {
    title: 'Year 5 · The water cycle · KWL chart',
    howTo:
      'Before the topic, write what you already know and what you want to find out. At the end, come back and write what you learned.',
    columns: 3,
    panelW: 400,
    noteCols: 1,
    noteH: 96,
    rail: {
      question: 'Where does rain come from, and where does it go?',
      minutes: 5,
      dots: 3,
      steps: [
        '1. Know: one fact a note, five minutes.',
        '2. Want to Know: write your questions, then vote for the first one to answer.',
        '3. Learned: at the end of the topic, answer the questions you can.',
      ],
    },
    panels: [
      {
        label: 'Know',
        hint: 'What do you already know?',
        icon: 'lightbulb',
        hue: 'sky',
        notes: [
          'Rain comes from clouds',
          'Puddles dry up when it’s sunny',
          'Water can be ice, liquid or steam',
          'Rivers flow down to the sea',
        ],
      },
      {
        label: 'Want to Know',
        hint: 'What do you want to find out?',
        icon: 'help-circle',
        hue: 'violet',
        notes: [
          'Where does a puddle go when it dries?',
          'Why are rain clouds grey?',
          'Why doesn’t the sea run out?',
          'Is the water we drink really old?',
        ],
      },
      {
        label: 'Learned',
        hint: 'What did you learn?',
        icon: 'graduation-cap',
        hue: 'green',
        notes: [
          'The sun heats water and it evaporates into vapour',
          'Vapour cools into tiny drops that make clouds',
          'Rivers carry the rain back to the sea',
          'The same water has gone round for billions of years',
        ],
      },
    ],
  },
  // A new starter's first three months, agreed with their manager in week one.
  'onboarding-plan': {
    title: 'Sam’s first 90 days · Product designer at Plateful',
    howTo:
      'Three stages: learn, then contribute, then lead. Agree the goals with your manager in week one and look at them again at every check-in.',
    columns: 3,
    panelW: 420,
    noteCols: 1,
    noteH: 88,
    panels: [
      {
        label: 'Learn',
        hint: 'Days 1-30: the people, product and customers',
        icon: 'book-open',
        hue: 'sky',
        notes: [
          'Meet everyone on the squad one to one',
          'Sit in on five customer interviews',
          'Ship one small fix to learn how we release',
          'Read the last two quarters of research',
        ],
      },
      {
        label: 'Contribute',
        hint: 'Days 31-60: own a piece of work end to end',
        icon: 'tool',
        hue: 'violet',
        notes: [
          'Redesign the reorder flow with Priya',
          'Run my first usability test',
          'Join the design critique rota',
          'Tidy the button styles in the design system',
        ],
      },
      {
        label: 'Lead',
        hint: 'Days 61-90: bring a plan of your own',
        icon: 'flag',
        hue: 'green',
        notes: [
          'Pitch a discovery bet for next quarter',
          'Mentor the new design intern',
          'Set my objectives for next half',
          'Share what I’ve learned at the all hands',
        ],
      },
    ],
    closing: {
      label: 'Check-ins',
      hint: 'The conversations that keep the plan honest',
      items: [
        'Day 1 · coffee with my buddy, Jo',
        'Day 30 · first review with Dana',
        'Day 60 · feedback from the squad',
        'Day 90 · next half’s plan signed off',
      ],
      done: [true],
    },
  },
};
