// The Gantt template's worked example (docs/specs/008-canvas/canvas-and-palette.md "Templates"):
// a twelve-week mobile-app launch plan as pure data, kept apart from the
// layout in template-builders-gantt.ts so the plan reads (and edits) as a
// plan. Weeks index the calendar columns; fractional weeks place a date
// inside its week.

// Twelve weeks commencing Monday 4 January 2027: 2027's Q1 splits into
// three clean four-week months, so the month band needs no partial cells.
export const MONTHS = ['January', 'February', 'March'];
export const WEEK_DATES = ['4', '11', '18', '25', '1', '8', '15', '22', '1', '8', '15', '22'];
// Friday 19 February: week index 6 plus four days (clear of the "15" date).
export const TODAY_WEEK = 6 + 4 / 7;
// Wednesday 24 March: week index 11 plus two days.
export const LAUNCH_WEEK = 11 + 2 / 7;

export type Stream = {
  name: string;
  icon: string;
  band: string; // group row tint
  deep: string; // group label, summary bar, percentage ink
  track: string; // bar track (the undone part)
  done: string; // bar fill (the done part)
};

export const STREAMS: Record<'design' | 'build' | 'launch', Stream> = {
  design: {
    name: 'Design',
    icon: 'edit',
    band: '#f5f3ff',
    deep: '#6d28d9',
    track: '#ede9fe',
    done: '#c4b5fd',
  },
  build: {
    name: 'Build',
    icon: 'code',
    band: '#eff6ff',
    deep: '#1d4ed8',
    track: '#dbeafe',
    done: '#93c5fd',
  },
  launch: {
    name: 'Launch',
    icon: 'send',
    band: '#ecfdf5',
    deep: '#047857',
    track: '#d1fae5',
    done: '#6ee7b7',
  },
};

// Owners get a stable avatar colour so the same person reads the same
// everywhere on the chart.
export const PEOPLE: Record<string, string> = {
  Priya: '#7c3aed',
  Marco: '#2563eb',
  Jess: '#0891b2',
  Sam: '#059669',
};

export type Task = {
  key: string;
  label: string;
  owner: keyof typeof PEOPLE;
  start: number; // first week column (0 = w/c 4 Jan)
  weeks: number;
  progress: number;
};

export const PLAN: { stream: keyof typeof STREAMS; tasks: Task[] }[] = [
  {
    stream: 'design',
    tasks: [
      {
        key: 'research',
        label: 'User interviews',
        owner: 'Priya',
        start: 0,
        weeks: 2,
        progress: 100,
      },
      {
        key: 'prototype',
        label: 'Prototype + usability test',
        owner: 'Priya',
        start: 1,
        weeks: 3,
        progress: 100,
      },
    ],
  },
  {
    stream: 'build',
    tasks: [
      { key: 'api', label: 'Sync API + sign-in', owner: 'Marco', start: 4, weeks: 4, progress: 50 },
      { key: 'app', label: 'iOS + Android app', owner: 'Jess', start: 4, weeks: 6, progress: 45 },
    ],
  },
  {
    stream: 'launch',
    tasks: [
      {
        key: 'beta',
        label: 'Private beta, 50 teams',
        owner: 'Sam',
        start: 8,
        weeks: 2,
        progress: 0,
      },
      { key: 'review', label: 'App Store review', owner: 'Sam', start: 10, weeks: 1, progress: 0 },
    ],
  },
];

// Finish-to-start links: the successor can't begin until the predecessor ends.
export const DEPENDENCIES: [string, string][] = [
  ['prototype', 'api'],
  ['api', 'beta'],
  ['app', 'review'],
  ['review', 'launch'],
];
