// The board grids' content (docs/specs/008-canvas/canvas-and-palette.md "Templates"): PESTLE Analysis and the KWL
// Chart are one layout (template-builders-board-grid.ts) over the data below. Pure data with type-only imports, so a surface that only needs the words (a preview, a test)
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

export type BoardGridKind = Extract<TemplateKind, 'pestle-analysis' | 'kwl-chart'>;

export const BOARD_GRIDS: Readonly<Record<BoardGridKind, BoardGrid>> = {
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
};
