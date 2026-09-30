// The worked content of the opportunity solution tree template
// (./template-builders-opportunity-tree): Plateful's retention team, twelve
// household interviews in, deciding what to build for 30-day retention.
// Pure data; the builder owns every coordinate.

// One hue per level of the tree: the band behind the row, the rail tile
// naming it, and the edge of every card on it.
export type LevelHue = {
  band: string; // the row's wash, faint
  tile: string; // the rail tile, a step deeper
  edge: string; // card borders and the rail glyph
  ink: string; // headings on the level's paper
};

export type Level = {
  name: string;
  rule: string;
  icon: string;
  hue: LevelHue;
};

export const LEVELS = {
  outcome: {
    name: 'Outcome',
    rule: 'The one metric this team owns',
    icon: 'target',
    hue: { band: '#faf5ff', tile: '#ede9fe', edge: '#7c3aed', ink: '#5b21b6' },
  },
  opportunities: {
    name: 'Opportunities',
    rule: 'Needs and pains, in the customer’s own words',
    icon: 'message',
    hue: { band: '#f0f9ff', tile: '#e0f2fe', edge: '#0284c7', ink: '#075985' },
  },
  solutions: {
    name: 'Solutions',
    rule: 'Three ideas for the target, compared side by side',
    icon: 'zap',
    hue: { band: '#f0fdf4', tile: '#dcfce7', edge: '#16a34a', ink: '#166534' },
  },
  experiments: {
    name: 'Experiments',
    rule: 'Cheap tests of the riskiest assumption first',
    icon: 'activity',
    hue: { band: '#fffbeb', tile: '#fef3c7', edge: '#d97706', ink: '#92400e' },
  },
} satisfies Record<string, Level>;

// The desired outcome: where the metric started, where it is, where it has
// to get to. The ring shows the share of the way there.
export const OUTCOME = {
  title: 'Raise 30-day retention from 32% to 40%',
  detail: 'Now 34%, a quarter of the way there · Priya Shah · by 31 Dec',
  progress: 25,
};

export type Opportunity = { quote: string; heard: number };

export const INTERVIEWS = 12;

// Three opportunities in the customer's voice; the middle one is broken down
// into three sub-opportunities, and the middle of those is the target.
export const OPPORTUNITIES: [Opportunity, Opportunity, Opportunity] = [
  { quote: '“Midweek, I never know what to order”', heard: 7 },
  { quote: '“Ordering for the whole house is a hassle”', heard: 9 },
  { quote: '“Fees make a small order feel like a rip-off”', heard: 5 },
];
export const PARENT_INDEX = 1;

export const SUB_OPPORTUNITIES: [Opportunity, Opportunity, Opportunity] = [
  { quote: '“Splitting the bill is awkward”', heard: 4 },
  { quote: '“We can never agree on what to order”', heard: 8 },
  { quote: '“Someone’s order always gets missed”', heard: 5 },
];
export const TARGET_INDEX = 1;

export type TestStatus = 'running' | 'validated' | 'invalidated';

export type AssumptionTest = {
  assumption: string;
  test: string;
  result: string;
  status: TestStatus;
};

export type Solution = {
  name: string;
  pitch: string;
  icon: string;
  tests: [AssumptionTest, AssumptionTest];
};

export const SOLUTIONS: [Solution, Solution, Solution] = [
  {
    name: 'Group basket',
    pitch: 'Share a link, everyone adds their own dishes',
    icon: 'users',
    tests: [
      {
        assumption: 'Households want one shared basket',
        test: 'Fake door at checkout',
        result: '21% tapped, bar was 10%',
        status: 'validated',
      },
      {
        assumption: 'Everyone will add their own dishes',
        test: 'Prototype, 6 households',
        result: '3 of 6 sessions done',
        status: 'running',
      },
    ],
  },
  {
    name: 'Family bundles',
    pitch: 'Mix-and-match meals priced for four',
    icon: 'box',
    tests: [
      {
        assumption: 'Families will reorder a bundle',
        test: 'Concierge, 40 families',
        result: 'Only 3 of 40 reordered',
        status: 'invalidated',
      },
      {
        assumption: '£32 feels fair for four',
        test: 'Price survey, 300 people',
        result: '64% called it fair',
        status: 'validated',
      },
    ],
  },
  {
    name: 'Tonight’s vote',
    pitch: 'Poll the house on two or three places',
    icon: 'check-circle',
    tests: [
      {
        assumption: 'A vote ends the debate',
        test: 'Paper prototype, 5 homes',
        result: 'Sessions Thu and Fri',
        status: 'running',
      },
      {
        assumption: 'People will start a vote',
        test: 'Fake door in the app',
        result: '4% tapped, bar was 10%',
        status: 'invalidated',
      },
    ],
  },
];

// Status chips: solid, with their own ink, so the verdict reads first.
export const STATUS: Record<TestStatus, { label: string; fill: string; ink: string }> = {
  running: { label: 'Running', fill: '#2563eb', ink: '#ffffff' },
  validated: { label: '✓ Validated', fill: '#15803d', ink: '#ffffff' },
  invalidated: { label: '✗ Invalidated', fill: '#be123c', ink: '#ffffff' },
};
