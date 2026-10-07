// The Plan templates' tabs (docs/specs/026-plan/plan-templates.md "The templates"): pure data, one entry a
// template, each a list of template tabs. A tab holds at most one board, the plan views under it and the
// rail beside it; plan-template-layout.ts places them. A status two boards share is a hand-off: the
// column ids and statuses below are the contract between a template's tabs, so keep them in step.

import {
  statusColumn,
  type CardField,
  type MetricKind,
  type PlanBoardPresetId,
  type PlanBoardSetup,
  type PlanColumn,
  type PlanVisualisation,
} from '@livediagram/items';

export const PLAN_TEMPLATE_KINDS = [
  'blank-plan',
  'project-planner',
  'kanban',
  'bug-triage',
  'team-retro',
  'weekly-planner',
  'content-calendar',
  'hiring-pipeline',
  'okrs',
  'product-launch',
  'feedback-board',
] as const;
export type PlanTemplateKind = (typeof PLAN_TEMPLATE_KINDS)[number];

// A board's set-up is its preset's, with `setup` laid over it and `title` set.
export type BoardSpec = {
  preset: PlanBoardPresetId;
  setup?: Partial<PlanBoardSetup>;
  width: number;
  height: number;
  title: string;
};

// What the rail beside a board holds, top to bottom (plan-templates.md "Layout of a template tab").
export type RailItem =
  | { kind: 'sticky'; text: string }
  | { kind: 'timer'; minutes: number }
  | { kind: 'picker'; label: string }
  | { kind: 'temperature'; label: string };

export type PlanTabSpec = {
  name: string;
  board?: BoardSpec;
  metrics?: readonly MetricKind[];
  charts?: readonly PlanVisualisation[];
  rail?: readonly RailItem[];
};

// A column whose id is its status, as every preset builds them.
const col = statusColumn;

const GREEN = '#16a34a';
const AMBER = '#d97706';
const RED = '#dc2626';
const TEAL = '#0d9488';

// Board widths fit every column at its narrowest (PLAN_COLUMN_MIN_PX, 220px, plus the 12px gaps and the
// body's 12px side padding) with room to spare, so a fresh board never scrolls sideways.
const W3 = 1000;
const W4 = 1120;
const W5 = 1300;
const W6 = 1520;

const WORK: CardField[] = ['key', 'type', 'assignee', 'priority', 'labels', 'checklist'];
const PROJECT: CardField[] = ['key', 'assignee', 'priority', 'labels', 'start', 'due'];

// A board of Project cards that the Gantt under it draws (Roadmap, Roles, Objectives, Workstreams).
function projectBoard(title: string, columns: PlanColumn[], doneColumnId: string): BoardSpec {
  return {
    preset: 'blank',
    title,
    width: columns.length > 4 ? W5 : W4,
    height: 520,
    setup: {
      columns,
      doneColumnId,
      swimlaneBy: 'none',
      cardFields: PROJECT,
      addTypes: ['project'],
      widgets: ['progress', 'due', 'filter'],
    },
  };
}

const steps = (title: string, lines: readonly string[]) =>
  [title, ...lines.map((line, i) => `${i + 1}. ${line}`)].join('\n');

// The sprint's statuses, shared by Project Planner's Backlog, Sprint and Daily Standup boards.
const SPRINT = col('sprint', 'This Sprint');
const DOING = col('doing', 'In Progress', { wipLimit: 3 });
const BLOCKED = col('blocked', 'Blocked', { color: RED });
const REVIEW = col('review', 'In Review');
const DONE = col('done', 'Done');

export const PLAN_TEMPLATE_TABS: Readonly<Record<PlanTemplateKind, readonly PlanTabSpec[]>> = {
  // One tab, so it keeps the name the caller gives a new tab, and empty: the tab shows Plan's own Start with a
  // Board picker (docs/specs/026-plan/plan-mode.md "Starting a board").
  'blank-plan': [{ name: 'Board' }],

  'project-planner': [
    {
      name: 'Roadmap',
      board: projectBoard(
        'Roadmap',
        [col('now', 'Now'), col('next', 'Next'), col('later', 'Later'), col('shipped', 'Shipped')],
        'shipped',
      ),
      charts: ['gantt'],
      rail: [
        {
          kind: 'sticky',
          text: steps('How this works', [
            'Add a Project for each piece of work, with start and due dates',
            'Break it into Tasks on Backlog, each under its project',
            'Move what the team takes on to This Sprint',
            'Walk Daily Standup each morning',
          ]),
        },
      ],
    },
    {
      name: 'Backlog',
      board: {
        preset: 'blank',
        title: 'Backlog',
        width: W3,
        height: 720,
        setup: {
          columns: [col('backlog', 'Backlog'), col('ready', 'Ready'), SPRINT],
          swimlaneBy: 'parent',
          cardFields: ['key', 'type', 'assignee', 'priority', 'estimate', 'labels'],
          addTypes: ['task'],
          widgets: ['count', 'priorities', 'filter'],
        },
      },
    },
    {
      name: 'Sprint',
      board: {
        preset: 'sprint',
        title: 'Sprint',
        width: W5,
        height: 720,
        setup: { columns: [SPRINT, DOING, BLOCKED, REVIEW, DONE], doneColumnId: 'done' },
      },
      charts: ['workload', 'status-mix'],
    },
    {
      name: 'Daily Standup',
      board: {
        preset: 'blank',
        title: 'Daily Standup',
        width: W4,
        height: 640,
        setup: {
          columns: [DOING, BLOCKED, REVIEW, DONE],
          doneColumnId: 'done',
          swimlaneBy: 'assignee',
          cardSize: 'compact',
          cardFields: ['key', 'type', 'priority', 'due'],
          addTypes: ['task', 'action'],
          widgets: ['stale', 'due', 'filter'],
        },
      },
      rail: [
        {
          kind: 'sticky',
          text: steps('How we run it', [
            'Pick who goes first',
            'Each person walks their row: done, doing, blocked',
            'Two minutes each',
            'Every blocker gets an owner after',
          ]),
        },
        { kind: 'timer', minutes: 15 },
        { kind: 'picker', label: 'Who goes first?' },
      ],
    },
  ],

  kanban: [
    {
      name: 'Board',
      board: {
        preset: 'kanban',
        width: W5 + 100,
        height: 720,
        title: 'Kanban',
        setup: {
          columns: [
            // ⇄ Requests' Accepted.
            col('backlog', 'Backlog'),
            col('todo', 'To Do'),
            col('doing', 'In Progress', { wipLimit: 3 }),
            col('review', 'Review', { wipLimit: 2 }),
            col('done', 'Done'),
          ],
        },
      },
    },
    {
      name: 'Requests',
      board: {
        preset: 'blank',
        title: 'Requests',
        width: W4,
        height: 640,
        setup: {
          columns: [
            col('requested', 'New'),
            col('needs-info', 'Needs Info', { color: AMBER }),
            // Accepted: ⇄ the Board tab's Backlog, named alike so the status reads the same everywhere.
            col('backlog', 'Backlog', { color: GREEN }),
            col('declined', 'Declined'),
          ],
          swimlaneBy: 'none',
          cardFields: ['key', 'type', 'assignee', 'priority', 'labels'],
          addTypes: ['task', 'idea'],
          widgets: ['count', 'unassigned', 'filter'],
        },
      },
      rail: [
        {
          kind: 'sticky',
          text: steps('How this works', [
            'Add each request in New',
            'Ask in Needs Info when it is unclear',
            'Accept a request by moving it to Backlog: it lands on the Board tab',
            'Say why in a comment when you decline',
          ]),
        },
      ],
    },
    {
      name: 'Flow',
      metrics: ['count', 'progress', 'stale', 'unassigned'],
      charts: ['status-mix', 'workload', 'priority-matrix', 'calendar'],
    },
  ],

  'bug-triage': [
    {
      name: 'Triage',
      board: {
        preset: 'bug-triage',
        title: 'Triage',
        width: W5,
        height: 760,
        setup: {
          // No done column: a bug leaves triage confirmed, declined or a duplicate.
          doneColumnId: undefined,
          columns: [
            col('new', 'New'),
            col('needs-info', 'Needs Info', { color: AMBER }),
            col('confirmed', 'Confirmed'),
            col('wont-fix', 'Won’t Fix'),
            col('duplicate', 'Duplicate'),
          ],
        },
      },
      rail: [
        {
          kind: 'sticky',
          text: [
            'How we triage',
            'Urgent: broken for everyone, fix now',
            'High: blocks someone',
            'Medium: there is a workaround',
            'Low: polish',
            'Give each confirmed bug an owner',
          ].join('\n'),
        },
      ],
    },
    {
      name: 'Fixing',
      board: {
        preset: 'blank',
        title: 'Fixing',
        width: W5,
        height: 720,
        setup: {
          columns: [
            col('confirmed', 'Confirmed'),
            col('fixing', 'Fixing', { wipLimit: 4 }),
            col('review', 'In Review'),
            col('fixed', 'Fixed'),
            col('released', 'Released'),
          ],
          doneColumnId: 'fixed',
          swimlaneBy: 'assignee',
          cardFields: ['key', 'priority', 'labels', 'due'],
          addTypes: ['task'],
          widgets: ['progress', 'unassigned', 'filter'],
        },
      },
    },
    {
      name: 'Health',
      metrics: ['count', 'priorities', 'stale', 'unassigned'],
      charts: ['priority-matrix', 'workload', 'status-mix', 'calendar'],
    },
  ],

  'team-retro': [
    {
      name: 'Retro',
      board: {
        preset: 'retro',
        width: W3 + 100,
        height: 680,
        title: 'Sprint Retro',
        setup: {
          columns: [
            col('went-well', 'Went Well', { color: GREEN }),
            col('to-improve', 'To Improve', { color: RED }),
            col('ideas', 'Ideas', { color: TEAL }),
          ],
        },
      },
      rail: [
        {
          kind: 'sticky',
          text: steps('How we run it', [
            'Check in on the temperature',
            'Review last retro’s actions',
            'Write notes while the timer runs: they stay hidden',
            'Reveal together',
            'Vote: 5 each',
            'Turn the top votes into Actions',
            'Archive the notes when done',
          ]),
        },
        { kind: 'temperature', label: 'How did the sprint feel?' },
        { kind: 'timer', minutes: 5 },
      ],
    },
    {
      name: 'Actions',
      board: {
        preset: 'blank',
        title: 'Actions',
        width: W3,
        height: 600,
        setup: {
          columns: [col('todo', 'To Do'), col('doing', 'Doing'), col('done', 'Done')],
          doneColumnId: 'done',
          swimlaneBy: 'assignee',
          cardFields: ['key', 'assignee', 'due'],
          addTypes: ['action'],
          widgets: ['progress', 'due'],
        },
      },
    },
    {
      name: 'Archive',
      board: { preset: 'archive', width: 900, height: 560, title: 'Past Retros' },
    },
  ],

  'weekly-planner': [
    {
      name: 'This Week',
      board: {
        preset: 'weekly',
        title: 'This Week',
        width: W6,
        height: 600,
        setup: {
          columns: [
            col('mon', 'Monday'),
            col('tue', 'Tuesday'),
            col('wed', 'Wednesday'),
            col('thu', 'Thursday'),
            col('fri', 'Friday'),
            col('done', 'Done'),
          ],
          doneColumnId: 'done',
          widgets: ['progress', 'due', 'filter'],
        },
      },
    },
    {
      name: 'Inbox',
      board: {
        preset: 'blank',
        title: 'Inbox',
        width: W4,
        height: 600,
        setup: {
          columns: [
            col('inbox', 'Inbox'),
            col('next-up', 'Next Up'),
            col('waiting', 'Waiting On', { color: AMBER }),
            col('someday', 'Someday'),
          ],
          swimlaneBy: 'none',
          cardFields: ['type', 'assignee', 'due', 'labels'],
          addTypes: ['task', 'action', 'note'],
          widgets: ['count', 'due', 'filter'],
        },
      },
      rail: [
        {
          kind: 'sticky',
          text: steps('How this works', [
            'Capture everything in Inbox',
            'Each Monday, give the week’s cards a day on This Week',
            'What waits on someone else goes in Waiting On',
          ]),
        },
      ],
    },
    { name: 'Calendar', metrics: ['due', 'progress', 'count'], charts: ['calendar'] },
  ],

  'content-calendar': [
    {
      name: 'Ideas',
      board: {
        preset: 'blank',
        title: 'Ideas',
        width: W4,
        height: 640,
        setup: {
          columns: [
            col('ideas', 'Ideas'),
            col('shortlisted', 'Shortlisted'),
            // ⇄ Production's first column.
            col('approved', 'Approved', { color: GREEN }),
            col('parked', 'Parked'),
          ],
          swimlaneBy: 'none',
          cardFields: ['assignee', 'labels', 'votes'],
          voting: { on: true, budget: 5 },
          addTypes: ['idea'],
          widgets: ['votes', 'top-voted'],
        },
      },
    },
    {
      name: 'Production',
      board: {
        preset: 'blank',
        title: 'Production',
        width: W5,
        height: 680,
        setup: {
          columns: [
            col('approved', 'Approved', { color: GREEN }),
            col('drafting', 'Drafting'),
            col('in-review', 'In Review'),
            col('scheduled', 'Scheduled'),
            col('published', 'Published'),
          ],
          doneColumnId: 'published',
          swimlaneBy: 'none',
          cardFields: ['key', 'type', 'assignee', 'labels', 'due'],
          addTypes: ['task', 'idea'],
          widgets: ['progress', 'due', 'filter'],
        },
      },
    },
    { name: 'Calendar', metrics: ['due', 'progress', 'people'], charts: ['calendar', 'workload'] },
  ],

  'hiring-pipeline': [
    {
      name: 'Roles',
      board: projectBoard(
        'Roles',
        [
          col('role-planned', 'Opening Soon'),
          col('role-open', 'Open'),
          col('role-offer', 'Offer Out', { color: AMBER }),
          col('role-filled', 'Filled'),
        ],
        'role-filled',
      ),
      charts: ['gantt'],
    },
    {
      name: 'Pipeline',
      board: {
        preset: 'blank',
        title: 'Pipeline',
        width: W6,
        height: 720,
        setup: {
          columns: [
            col('applied', 'Applied'),
            col('screen', 'Screen'),
            col('interview', 'Interview'),
            col('offer', 'Offer'),
            col('hired', 'Hired'),
            col('not-progressing', 'Not Progressing'),
          ],
          doneColumnId: 'hired',
          swimlaneBy: 'parent',
          cardFields: ['assignee', 'labels', 'due', 'parent'],
          addTypes: ['task', 'note'],
          widgets: ['count', 'stale', 'filter'],
        },
      },
    },
    {
      name: 'Onboarding',
      board: {
        preset: 'blank',
        title: 'Onboarding',
        width: W4,
        height: 640,
        setup: {
          columns: [
            col('before-day-one', 'Before Day One'),
            col('first-week', 'First Week'),
            col('first-month', 'First Month'),
            col('onboarded', 'Done'),
          ],
          doneColumnId: 'onboarded',
          swimlaneBy: 'assignee',
          cardFields: ['key', 'type', 'due', 'checklist'],
          addTypes: ['task', 'action'],
          widgets: ['progress', 'due', 'filter'],
        },
      },
    },
  ],

  okrs: [
    {
      name: 'Objectives',
      board: projectBoard(
        'Objectives',
        [
          col('okr-draft', 'Draft'),
          col('okr-committed', 'Committed'),
          col('okr-achieved', 'Achieved', { color: GREEN }),
          col('okr-missed', 'Missed'),
        ],
        'okr-achieved',
      ),
      charts: ['gantt'],
    },
    {
      name: 'Key Results',
      board: {
        preset: 'blank',
        title: 'Key Results',
        width: W5,
        height: 720,
        setup: {
          columns: [
            col('kr-not-started', 'Not Started'),
            col('kr-on-track', 'On Track', { color: GREEN }),
            col('kr-at-risk', 'At Risk', { color: AMBER }),
            col('kr-off-track', 'Off Track', { color: RED }),
            col('kr-done', 'Done'),
          ],
          doneColumnId: 'kr-done',
          swimlaneBy: 'parent',
          cardFields: ['key', 'assignee', 'due', 'checklist'],
          addTypes: ['task', 'action'],
          widgets: ['progress', 'due', 'stale'],
        },
      },
      charts: ['status-mix'],
      rail: [
        {
          kind: 'sticky',
          text: steps('How we check in', [
            'Each week, move every key result to where it stands',
            'Say why in a comment',
            'Anything At Risk or Off Track gets an Action',
          ]),
        },
      ],
    },
  ],

  'product-launch': [
    {
      name: 'Timeline',
      board: projectBoard(
        'Workstreams',
        [
          col('ws-planned', 'Planned'),
          col('ws-doing', 'In Progress'),
          col('ws-ready', 'Ready', { color: GREEN }),
          col('ws-launched', 'Launched'),
        ],
        'ws-launched',
      ),
      charts: ['gantt'],
    },
    {
      name: 'Checklist',
      board: {
        preset: 'blank',
        title: 'Checklist',
        width: W4,
        height: 720,
        setup: {
          columns: [
            col('todo', 'To Do'),
            col('doing', 'Doing'),
            col('blocked', 'Blocked', { color: RED }),
            col('done', 'Done'),
          ],
          doneColumnId: 'done',
          swimlaneBy: 'parent',
          cardFields: [...WORK, 'due'],
          addTypes: ['task', 'action'],
          widgets: ['progress', 'due', 'unassigned'],
        },
      },
    },
    {
      name: 'Launch Day',
      board: {
        preset: 'blank',
        title: 'Go / No-Go',
        width: W3,
        height: 600,
        setup: {
          columns: [
            col('check-pending', 'Not Checked'),
            col('check-go', 'Go', { color: GREEN }),
            col('check-no-go', 'No-Go', { color: RED }),
          ],
          swimlaneBy: 'assignee',
          cardSize: 'compact',
          cardFields: ['key', 'priority'],
          addTypes: ['task'],
          widgets: ['count', 'unassigned'],
        },
      },
      rail: [
        {
          kind: 'sticky',
          text: steps('How we call it', [
            'Each owner checks their item',
            'Move it to Go or No-Go',
            'Talk through every No-Go',
            'Launch when every card is Go',
          ]),
        },
        { kind: 'timer', minutes: 30 },
      ],
    },
  ],

  'feedback-board': [
    {
      name: 'Feedback',
      board: {
        preset: 'blank',
        title: 'Feedback',
        width: W4,
        height: 680,
        setup: {
          columns: [
            col('fb-new', 'New'),
            col('fb-review', 'Under Review'),
            // ⇄ Delivery's first column.
            col('fb-planned', 'Planned', { color: TEAL }),
            col('fb-not-planned', 'Not Planned'),
          ],
          swimlaneBy: 'none',
          cardFields: ['labels', 'votes'],
          voting: { on: true },
          addTypes: ['idea'],
          widgets: ['top-voted', 'types', 'filter'],
        },
      },
      rail: [
        {
          kind: 'sticky',
          text: steps('How this works', [
            'Add each request as an Idea',
            'Vote on what matters',
            'Review the top voted each week',
            'Planned moves it to Delivery',
          ]),
        },
      ],
    },
    {
      name: 'Delivery',
      board: {
        preset: 'blank',
        title: 'Delivery',
        width: W3,
        height: 640,
        setup: {
          columns: [
            col('fb-planned', 'Planned', { color: TEAL }),
            col('fb-building', 'Building'),
            col('fb-shipped', 'Shipped'),
          ],
          doneColumnId: 'fb-shipped',
          swimlaneBy: 'assignee',
          cardFields: ['key', 'type', 'labels', 'votes', 'due'],
          addTypes: ['idea', 'task'],
          widgets: ['progress', 'filter'],
        },
      },
    },
  ],
};
