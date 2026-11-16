// The Board Update deck (docs/specs/008-canvas/canvas-and-palette.md "Templates on pages"): a quarterly update to a
// startup's board, built from the slide layouts like the other layout decks (template-builders-layout-decks.ts). Lumen,
// the note-taking app the Launch Keynote launches, reports its second quarter after launch: the agenda, the quarter in
// three numbers, revenue against plan on a real chart, the year's goals as rings, the one risk and the ask. Its points
// come in one at a time when presented (builds), and its chart and rings carry the figures its words say.
// Pure data.
import type { LayoutDeck } from './template-builders-layout-decks';

export const BOARD_UPDATE: LayoutDeck = {
  motion: 'mesh',
  dark: 'night',
  light: 'mist',
  slides: [
    {
      name: 'Board Update',
      layout: 'slide-keynote',
      labels: [
        'LUMEN · BOARD UPDATE',
        'Q2 2027',
        'Ahead on growth, behind on hiring',
        'Priya Shah, CEO · Board Meeting · 14 July 2027',
      ],
    },
    {
      name: 'Agenda',
      layout: 'slide-agenda-grid',
      labels: [
        'Today, in 40 minutes',
        '01',
        'The quarter',
        '10 min',
        '02',
        'Against the plan',
        '10 min',
        '03',
        'The one risk',
        '5 min',
        '04',
        'The decision',
        '15 min',
      ],
    },
    {
      name: 'The Quarter',
      layout: 'slide-three-stats',
      build: 3,
      labels: [
        'The quarter in three numbers',
        '£1.9M',
        'recurring revenue',
        'up from £1.2M in Q1',
        '48k',
        'paying customers',
        '+61% on the quarter',
        '19 mo',
        'of runway',
        'burning £210k a month',
        'Source: finance close and billing system, 30 June 2027.',
      ],
    },
    {
      name: 'Revenue',
      layout: 'slide-chart-insights',
      build: 2,
      chart: {
        lineCategories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        lineSeries: [
          { name: 'Actual, £k', values: [88, 94, 112, 131, 146, 158] },
          { name: 'Plan, £k', values: [88, 95, 104, 114, 125, 137] },
        ],
        chartLegend: true,
        chartLegendPosition: 'top',
      },
      labels: [
        'Revenue against plan',
        '1',
        'Launch in March doubled sign-ups within a fortnight',
        '2',
        'The Teams plan brought 38% of new revenue since April',
        '3',
        'Churn held at 2.1% a month right through the launch',
        'Source: billing system, January to June 2027.',
      ],
    },
    {
      name: 'Against the Plan',
      layout: 'slide-goals',
      build: 3,
      progress: [63, 80, 75],
      labels: [
        'Where we are against the 2027 plan',
        '63%',
        'Revenue',
        '£1.9M of £3M a year',
        '80%',
        'Customers',
        '48k of 60k',
        '75%',
        'Hiring',
        '9 of 12 roles filled',
        'Source: 2027 operating plan, figures to 30 June 2027.',
      ],
    },
    {
      name: 'The One Risk',
      layout: 'slide-takeaway',
      labels: [
        'THE ONE RISK',
        'Hiring is a quarter behind, and it is slowing the Teams roadmap.',
        'What we are doing',
        'Two senior engineers start in August',
        'A recruiter on retainer until the plan is met',
        'Shared notebooks moved from Q3 to Q4',
      ],
    },
    {
      name: 'The Decision',
      layout: 'slide-cta',
      labels: [
        'WHAT WE ASK OF THE BOARD',
        'Approve £1.2M from the round to open a Berlin team of six in October.',
        'Vote today',
        'Board pack and model: example.com/board/q2-2027',
      ],
    },
  ],
};
