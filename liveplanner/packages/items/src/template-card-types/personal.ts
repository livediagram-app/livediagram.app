// The meeting, goal and personal templates' own card types (docs/specs/026-plan/plan-templates.md "Card types a
// template makes"): Team Retro, Meeting Agenda, Weekly Planner, OKRs, Personal Goals, Study Planner and Trip Planner.
// Pure data.
import type { ItemTypeDef } from '../item-types';
import {
  card,
  checklist,
  choice,
  completedOn,
  detailed,
  link,
  longText,
  money,
  number,
  template,
  text,
} from './kit';

// ---- Team Retro: what the sprint felt like, and what the team will change -----------------------------------------

const RT: ItemTypeDef[] = [
  {
    id: 'rt-note',
    label: 'Retro Note',
    newTitle: 'New retro note',
    glyph: 'note',
    color: '#2563eb',
    fields: ['title', 'description', 'status', 'assignee', 'f-theme', 'votes', 'labels'],
    custom: [choice('f-theme', 'Theme', ['Process', 'Tools', 'People', 'Delivery', 'Quality'])],
    display: detailed(['f-theme']),
    templates: [
      template('tp-shout-out', 'Shout-Out', {
        description: 'Who helped, and what difference it made:',
        'f-theme': 'People',
        labels: ['kudos'],
      }),
      template('tp-pain-point', 'Pain Point', {
        description: 'What slowed us down, and how often:',
        labels: ['pain'],
      }),
    ],
  },
  {
    id: 'rt-idea',
    label: 'Idea to Try',
    newTitle: 'New idea to try',
    glyph: 'lightbulb',
    color: '#eab308',
    fields: ['title', 'description', 'status', 'assignee', 'f-theme', 'votes', 'labels'],
    custom: [choice('f-theme', 'Theme', ['Process', 'Tools', 'People', 'Delivery', 'Quality'])],
    templates: [
      template('tp-experiment', 'Experiment', {
        description: 'We will try …\nFor … sprints\nWe will know it worked if …',
        labels: ['experiment'],
      }),
    ],
  },
  {
    id: 'rt-action',
    label: 'Action Item',
    newTitle: 'New action item',
    glyph: 'action',
    color: '#dc2626',
    fields: ['title', 'description', 'status', 'assignee', 'due', 'f-from-retro', 'checklist'],
    custom: [text('f-from-retro', 'From Retro')],
    display: detailed(['f-from-retro'], ['due']),
    templates: [
      template('tp-process-change', 'Process Change', {
        description: 'What changes, starting when:',
        checklist: checklist([
          ['Agreed with the team'],
          ['Written in the team guide'],
          ['Checked at the next retro'],
        ]),
      }),
    ],
  },
];

// ---- Meeting Agenda: topics to get through, and who does what after -----------------------------------------------

const MA: ItemTypeDef[] = [
  {
    id: 'ma-topic',
    label: 'Agenda Topic',
    newTitle: 'New topic',
    glyph: 'chat',
    color: '#7c3aed',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-kind',
      'f-minutes',
      'f-outcome',
      'votes',
      'labels',
    ],
    custom: [
      choice('f-kind', 'Kind', ['Decision', 'Discussion', 'Update']),
      number('f-minutes', 'Minutes Needed'),
      longText('f-outcome', 'Outcome'),
    ],
    display: detailed(['f-kind', 'f-minutes']),
    templates: [
      template('tp-decision', 'Decision Needed', {
        'f-kind': 'Decision',
        'f-minutes': 15,
        description: 'The question:\n\nThe options:\n\nWho decides:',
      }),
      template('tp-update', 'Status Update', {
        'f-kind': 'Update',
        'f-minutes': 5,
        description: 'Done since last time:\n\nNext:\n\nBlocked on:',
      }),
    ],
  },
  {
    id: 'ma-action',
    label: 'Action Item',
    newTitle: 'New action item',
    glyph: 'action',
    color: '#dc2626',
    fields: ['title', 'description', 'status', 'assignee', 'due', 'f-meeting', 'checklist'],
    custom: [text('f-meeting', 'From Meeting')],
    display: detailed(['f-meeting'], ['due']),
    templates: [
      template('tp-follow-up', 'Follow-Up', {
        description: 'Who to follow up with, and what to ask:',
        checklist: checklist([['Message sent'], ['Answer shared with the group']]),
      }),
    ],
  },
];

// ---- Weekly Planner: the week's to-dos, errands and notes ------------------------------------------------------------

const WK: ItemTypeDef[] = [
  {
    id: 'wk-todo',
    label: 'To-Do',
    newTitle: 'New to-do',
    glyph: 'checklist',
    color: '#0891b2',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'f-when',
      'due',
      'f-completed-on',
      'checklist',
      'labels',
    ],
    custom: [
      choice('f-when', 'Time of Day', ['Morning', 'Afternoon', 'Evening']),
      completedOn('Done On'),
    ],
    display: detailed(['f-when'], ['due']),
    templates: [
      template('tp-deep-work', 'Deep Work Block', {
        'f-when': 'Morning',
        description: 'The one thing to finish, with notifications off:',
        labels: ['focus'],
      }),
    ],
  },
  {
    id: 'wk-errand',
    label: 'Errand',
    newTitle: 'New errand',
    glyph: 'pin',
    color: '#ea580c',
    fields: ['title', 'description', 'status', 'assignee', 'f-where', 'due', 'checklist', 'labels'],
    custom: [text('f-where', 'Where')],
    display: detailed(['f-where'], ['due']),
    templates: [
      template('tp-appointment', 'Appointment', {
        description: 'What to bring, and what to ask:',
        checklist: checklist([['Booked'], ['Added to the calendar'], ['Directions checked']]),
      }),
    ],
  },
  {
    id: 'wk-note',
    label: 'Note',
    newTitle: 'New note',
    glyph: 'note',
    color: '#2563eb',
    fields: ['title', 'description', 'status', 'checklist', 'labels'],
    templates: [
      template('tp-weekly-review', 'Weekly Review', {
        checklist: checklist([
          ['Inbox cleared'],
          ['Last week looked back on'],
          ['Next week’s three things picked'],
        ]),
      }),
    ],
  },
];

// ---- OKRs: the period's objectives and the key results that measure them -------------------------------------------

const OKR: ItemTypeDef[] = [
  {
    id: 'okr-objective',
    label: 'Objective',
    newTitle: 'New objective',
    glyph: 'target',
    color: '#d97706',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-why',
      'priority',
      'color',
      'start',
      'due',
      'labels',
    ],
    custom: [longText('f-why', 'Why It Matters')],
    display: detailed([], ['start', 'due']),
    templates: [
      template('tp-quarterly-objective', 'Quarterly Objective', {
        'f-why': 'What changes for customers or the team if we get there:',
      }),
    ],
  },
  {
    id: 'okr-key-result',
    label: 'Key Result',
    newTitle: 'New key result',
    glyph: 'trend',
    color: '#0d9488',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-objective',
      'f-baseline',
      'f-target',
      'f-current',
      'f-confidence',
      'due',
      'f-completed-on',
      'checklist',
    ],
    custom: [
      card('f-objective', 'Objective', 'okr-objective'),
      number('f-baseline', 'Baseline'),
      number('f-target', 'Target'),
      number('f-current', 'Current'),
      choice('f-confidence', 'Confidence', ['Low', 'Medium', 'High']),
      completedOn(),
    ],
    display: detailed(['f-current', 'f-target'], ['due']),
    templates: [
      template('tp-metric', 'Move a Metric', {
        description: 'Where the number comes from, and how often we read it:',
        'f-confidence': 'Medium',
      }),
      template('tp-ship-it', 'Ship It', {
        description: 'Done when it is live for everyone.',
        'f-baseline': 0,
        'f-target': 1,
        'f-current': 0,
      }),
    ],
  },
];

// ---- Personal Goals: goals for the year and the milestones on the way --------------------------------------------

const PG: ItemTypeDef[] = [
  {
    id: 'pg-goal',
    label: 'Goal',
    newTitle: 'New goal',
    glyph: 'trophy',
    color: '#d97706',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-area',
      'f-why',
      'priority',
      'color',
      'start',
      'due',
      'labels',
    ],
    custom: [
      choice('f-area', 'Area', ['Health', 'Career', 'Money', 'Learning', 'Home', 'Relationships']),
      longText('f-why', 'Why It Matters'),
    ],
    display: detailed(['f-area'], ['start', 'due']),
    templates: [
      template('tp-health-goal', 'Health Goal', {
        'f-area': 'Health',
        'f-why': 'How I want to feel:',
      }),
      template('tp-learning-goal', 'Learning Goal', {
        'f-area': 'Learning',
        'f-why': 'What I will be able to do:',
      }),
    ],
  },
  {
    id: 'pg-milestone',
    label: 'Milestone',
    newTitle: 'New milestone',
    glyph: 'milestone',
    color: '#0d9488',
    fields: ['title', 'description', 'status', 'f-goal', 'due', 'f-completed-on', 'checklist'],
    custom: [card('f-goal', 'Goal', 'pg-goal'), completedOn()],
    display: detailed(['f-goal'], ['due']),
    templates: [
      template('tp-thirty-day-streak', '30-Day Streak', {
        description: 'Every day for 30 days:',
        checklist: checklist([['Week 1'], ['Week 2'], ['Week 3'], ['Week 4']]),
      }),
    ],
  },
];

// ---- Study Planner: assignments to hand in and topics to revise ---------------------------------------------------

const SP: ItemTypeDef[] = [
  {
    id: 'sp-assignment',
    label: 'Assignment',
    newTitle: 'New assignment',
    glyph: 'pencil',
    color: '#7c3aed',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-course',
      'f-weight',
      'due',
      'f-grade',
      'checklist',
      'labels',
    ],
    custom: [text('f-course', 'Course'), number('f-weight', 'Weight %'), text('f-grade', 'Grade')],
    display: detailed(['f-course'], ['due']),
    templates: [
      template('tp-essay', 'Essay', {
        checklist: checklist([
          ['Question picked apart'],
          ['Sources found'],
          ['Outline'],
          ['First draft'],
          ['References checked'],
        ]),
      }),
      template('tp-problem-set', 'Problem Set', {
        checklist: checklist([
          ['Lecture notes read'],
          ['Problems attempted'],
          ['Answers checked'],
          ['Handed in'],
        ]),
      }),
    ],
  },
  {
    id: 'sp-topic',
    label: 'Revision Topic',
    newTitle: 'New topic',
    glyph: 'book',
    color: '#2563eb',
    fields: ['title', 'description', 'status', 'f-course', 'due', 'checklist', 'labels'],
    custom: [text('f-course', 'Course')],
    display: detailed(['f-course'], ['due']),
    templates: [
      template('tp-past-paper', 'Past Paper', {
        checklist: checklist([['Done under timed conditions'], ['Marked'], ['Weak spots noted']]),
      }),
    ],
  },
];

// ---- Trip Planner: what to see, what to book, what to pack --------------------------------------------------------

const TR: ItemTypeDef[] = [
  {
    id: 'tr-idea',
    label: 'Thing to Do',
    newTitle: 'New thing to do',
    glyph: 'star',
    color: '#eab308',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-where',
      'f-cost',
      'f-link',
      'votes',
      'labels',
    ],
    custom: [text('f-where', 'Where'), money('f-cost', 'Cost'), link('f-link', 'Link')],
    display: detailed(['f-where', 'f-cost']),
    templates: [
      template('tp-restaurant', 'Restaurant', {
        labels: ['food'],
        description: 'What to order, and whether to book:',
      }),
      template('tp-day-trip', 'Day Trip', {
        labels: ['day-trip'],
        description: 'How to get there, and the last way back:',
      }),
    ],
  },
  {
    id: 'tr-note',
    label: 'Travel Note',
    newTitle: 'New note',
    glyph: 'note',
    color: '#2563eb',
    fields: ['title', 'description', 'status', 'assignee', 'labels'],
    templates: [
      template('tp-local-tips', 'Local Tips', {
        description: 'Money:\nGetting around:\nPhrases:\nEmergency number:',
      }),
    ],
  },
  {
    id: 'tr-booking',
    label: 'Booking',
    newTitle: 'New booking',
    glyph: 'calendar',
    color: '#0891b2',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-kind',
      'f-reference',
      'f-cost',
      'due',
      'f-link',
      'checklist',
      'labels',
    ],
    custom: [
      choice('f-kind', 'Kind', ['Flight', 'Stay', 'Train', 'Car', 'Tour']),
      text('f-reference', 'Reference'),
      money('f-cost', 'Cost'),
      link('f-link', 'Link'),
    ],
    display: detailed(['f-kind', 'f-cost'], ['due']),
    templates: [
      template('tp-flight', 'Flight', {
        'f-kind': 'Flight',
        checklist: checklist([
          ['Booked'],
          ['Seats picked'],
          ['Checked in'],
          ['Boarding passes saved'],
        ]),
      }),
      template('tp-stay', 'Stay', {
        'f-kind': 'Stay',
        checklist: checklist([['Booked'], ['Check-in time noted'], ['Address saved offline']]),
      }),
    ],
  },
  {
    id: 'tr-item',
    label: 'Packing Item',
    newTitle: 'New item',
    glyph: 'gift',
    color: '#16a34a',
    fields: ['title', 'description', 'status', 'assignee', 'f-bag', 'checklist'],
    custom: [choice('f-bag', 'Bag', ['Carry-On', 'Checked', 'Day Bag'])],
    display: detailed(['f-bag']),
    templates: [
      template('tp-documents', 'Documents', {
        'f-bag': 'Carry-On',
        checklist: checklist([
          ['Passports'],
          ['Insurance'],
          ['Bookings printed or saved'],
          ['Cards and some cash'],
        ]),
      }),
    ],
  },
];

export const PERSONAL_TYPES: readonly ItemTypeDef[] = [
  ...RT,
  ...MA,
  ...WK,
  ...OKR,
  ...PG,
  ...SP,
  ...TR,
];
