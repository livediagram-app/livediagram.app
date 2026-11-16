// The delivery templates' own card types (docs/specs/026-plan/plan-templates.md "Card types a template makes"):
// Project Planner, Kanban Board, Bug Tracker and Sprint Board. Pure data.
import type { ItemTypeDef } from '../item-types';
import {
  checklist,
  choice,
  completedOn,
  detailed,
  email,
  longText,
  parentOf,
  template,
  text,
} from './kit';

const WORK = [
  'title',
  'description',
  'status',
  'assignee',
  'parent',
  'priority',
  'estimate',
  'due',
];

const STEPS = 'f-steps-to-reproduce';
const steps = longText(STEPS, 'Steps to Reproduce');
const environment = text('f-environment', 'Environment');

// ---- Project Planner: initiatives on a roadmap, delivered as stories, tasks and bugs in sprints ---------------------

const PP: ItemTypeDef[] = [
  {
    id: 'pp-initiative',
    label: 'Initiative',
    newTitle: 'New initiative',
    glyph: 'epic',
    color: '#4f46e5',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'f-outcome',
      'f-team',
      'priority',
      'color',
      'start',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      longText('f-outcome', 'Outcome'),
      choice('f-team', 'Team', ['Web', 'Mobile', 'Platform', 'Design']),
    ],
    display: detailed(['f-team'], ['start', 'due']),
    templates: [
      template('tp-new-feature', 'New Feature', {
        'f-outcome': 'Who it is for, and what they can do once it ships:',
        checklist: checklist([
          ['Problem written up'],
          ['Designs reviewed'],
          ['Broken into stories'],
          ['Release plan agreed'],
        ]),
      }),
      template('tp-tech-investment', 'Tech Investment', {
        'f-outcome': 'What gets faster, safer or cheaper, and how we will know:',
        labels: ['tech-debt'],
      }),
    ],
  },
  {
    id: 'pp-story',
    label: 'User Story',
    newTitle: 'New user story',
    glyph: 'story',
    color: '#7c3aed',
    fields: [...WORK, 'f-acceptance', 'f-completed-on', 'checklist', 'labels'],
    custom: [
      parentOf('pp-initiative'),
      longText('f-acceptance', 'Acceptance Criteria'),
      completedOn(),
    ],
    display: detailed([], ['estimate']),
    templates: [
      template('tp-user-story', 'User Story', {
        description: 'As a …\nI want …\nSo that …',
        'f-acceptance': 'Given …\nWhen …\nThen …',
        checklist: checklist([['Designs linked'], ['Estimated by the team']]),
      }),
      template('tp-spike', 'Spike', {
        description: 'The question to answer:\n\nTime box:',
        labels: ['spike'],
        checklist: checklist([['Options written up'], ['Recommendation shared']]),
      }),
    ],
  },
  {
    id: 'pp-task',
    label: 'Task',
    newTitle: 'New task',
    glyph: 'task',
    color: '#0891b2',
    fields: [...WORK, 'f-completed-on', 'checklist', 'labels'],
    custom: [parentOf('pp-initiative'), completedOn()],
    templates: [
      template('tp-release', 'Release', {
        description: 'What goes out in this release:',
        labels: ['release'],
        checklist: checklist([
          ['Release notes written'],
          ['Build signed and uploaded'],
          ['Rolled out to 10%'],
          ['Rolled out to everyone'],
        ]),
      }),
    ],
  },
  {
    id: 'pp-bug',
    label: 'Bug',
    newTitle: 'New bug',
    glyph: 'bug',
    color: '#dc2626',
    fields: [...WORK, STEPS, 'f-environment', 'f-completed-on', 'checklist', 'labels'],
    custom: [parentOf('pp-initiative'), steps, environment, completedOn()],
    display: detailed(['f-environment']),
    templates: [
      template('tp-regression', 'Regression', {
        description: 'What used to work, and in which release it stopped:',
        [STEPS]: '1. …\n2. …\n\nExpected:\nActual:',
        labels: ['regression'],
        checklist: checklist([['Last good release found'], ['Test added so it stays fixed']]),
      }),
    ],
  },
];

// ---- Kanban Board: work items that flow, and requests from outside the team -----------------------------------------

const KB: ItemTypeDef[] = [
  {
    id: 'kb-work-item',
    label: 'Work Item',
    newTitle: 'New work item',
    glyph: 'kanban',
    color: '#2563eb',
    fields: [...WORK, 'f-class', 'checklist', 'labels'],
    custom: [
      parentOf('kb-work-item'),
      // How a card is pulled through the board (a Kanban class of service).
      choice('f-class', 'Class of Service', ['Standard', 'Expedite', 'Fixed Date', 'Intangible']),
    ],
    display: detailed(['f-class'], ['due']),
    templates: [
      template('tp-expedite', 'Expedite', {
        'f-class': 'Expedite',
        description: 'Why this jumps the queue, and what it costs to wait:',
      }),
      template('tp-fixed-date', 'Fixed Date', {
        'f-class': 'Fixed Date',
        description: 'The date it must land by, and why:',
      }),
      template('tp-improvement', 'Improvement', {
        'f-class': 'Intangible',
        labels: ['improvement'],
        description: 'What gets better for the team:',
      }),
    ],
  },
  {
    id: 'kb-request',
    label: 'Request',
    newTitle: 'New request',
    glyph: 'inbox',
    color: '#ea580c',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'f-requested-by',
      'f-email',
      'due',
      'checklist',
      'labels',
    ],
    custom: [text('f-requested-by', 'Requested By'), email()],
    display: detailed(['f-requested-by']),
    templates: [
      template('tp-access', 'Access Request', {
        description: 'What they need access to, and for how long:',
        labels: ['access'],
        checklist: checklist([['Manager approved'], ['Access granted'], ['Requester told']]),
      }),
      template('tp-question', 'Question', {
        description: 'What they asked:',
        labels: ['question'],
      }),
    ],
  },
];

// ---- Bug Tracker: bugs from report to release ------------------------------------------------------------------------

const BT: ItemTypeDef[] = [
  {
    id: 'bt-bug',
    label: 'Bug',
    newTitle: 'New bug',
    glyph: 'bug',
    color: '#dc2626',
    fields: [
      'title',
      'description',
      'status',
      'assignee',
      'priority',
      'f-severity',
      STEPS,
      'f-environment',
      'f-version',
      'f-email',
      'f-completed-on',
      'due',
      'checklist',
      'labels',
    ],
    custom: [
      // The Bug Report form's Severity: how bad it is for the person who hit it.
      { ...choice('f-severity', 'Severity', ['Low', 'Medium', 'High', 'Critical']), onCard: true },
      steps,
      environment,
      text('f-version', 'Found In'),
      email(),
      completedOn(),
    ],
    display: detailed(['f-severity', 'f-environment']),
    templates: [
      template('tp-crash', 'Crash', {
        'f-severity': 'Critical',
        description: 'What were you doing when it closed?',
        [STEPS]: '1. Open …\n2. …\n3. The app closes\n\nExpected:\nActual:',
        labels: ['crash'],
        checklist: checklist([
          ['Reproduced on the latest build'],
          ['Crash log attached'],
          ['Versions affected noted'],
        ]),
      }),
      template('tp-visual-glitch', 'Visual Glitch', {
        'f-severity': 'Low',
        description: 'What looks wrong, and where:',
        labels: ['ui'],
        checklist: checklist([
          ['Screenshot attached'],
          ['Checked in light and dark'],
          ['Checked on a phone'],
        ]),
      }),
      template('tp-slow-screen', 'Slow Screen', {
        'f-severity': 'Medium',
        description: 'Which screen, and what you were waiting for:',
        labels: ['performance'],
        checklist: checklist([
          ['Timed it: how long it takes'],
          ['Noted how much data was on screen'],
          ['Compared with the last release'],
        ]),
      }),
    ],
  },
];

// ---- Sprint Board: one sprint's stories, the tasks under them, and bugs ----------------------------------------------

const SB: ItemTypeDef[] = [
  {
    id: 'sb-story',
    label: 'Story',
    newTitle: 'New story',
    glyph: 'story',
    color: '#7c3aed',
    fields: [...WORK, 'f-acceptance', 'f-completed-on', 'checklist', 'labels'],
    custom: [parentOf('sb-story'), longText('f-acceptance', 'Acceptance Criteria'), completedOn()],
    display: detailed([], ['estimate']),
    templates: [
      template('tp-user-story', 'User Story', {
        description: 'As a …\nI want …\nSo that …',
        'f-acceptance': 'Given …\nWhen …\nThen …',
        checklist: checklist([['Designs linked'], ['Estimated in planning']]),
      }),
    ],
  },
  {
    id: 'sb-task',
    label: 'Task',
    newTitle: 'New task',
    glyph: 'task',
    color: '#0891b2',
    fields: [...WORK, 'f-completed-on', 'checklist', 'labels'],
    custom: [parentOf('sb-story'), completedOn()],
    templates: [
      template('tp-tech-task', 'Tech Task', {
        description: 'What changes, and how we will know it worked:',
        checklist: checklist([['Code reviewed'], ['Tests pass'], ['Deployed']]),
      }),
    ],
  },
  {
    id: 'sb-bug',
    label: 'Bug',
    newTitle: 'New bug',
    glyph: 'bug',
    color: '#dc2626',
    fields: [...WORK, STEPS, 'f-environment', 'f-completed-on', 'checklist', 'labels'],
    custom: [parentOf('sb-story'), steps, environment, completedOn()],
    display: detailed(['f-environment']),
    templates: [
      template('tp-sprint-bug', 'Found in Sprint', {
        description: 'What broke, and which story it came from:',
        [STEPS]: '1. …\n2. …\n\nExpected:\nActual:',
        labels: ['found-in-sprint'],
      }),
    ],
  },
];

export const DELIVERY_TYPES: readonly ItemTypeDef[] = [...PP, ...KB, ...BT, ...SB];
