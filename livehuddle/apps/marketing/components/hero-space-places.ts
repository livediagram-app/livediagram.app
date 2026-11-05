// Two more Spaces in use, for the landing beats (docs/specs/019-marketing/marketing-site.md "Feature scenes"): the
// Virtual Office, where the team at their desks walks over to the meeting room, and the All-Hands Hall, where the
// room sits facing the stage. Pure data in each template's own canvas coordinates (buildTemplate(kind, 0, 0)), as
// hero-space-cast.ts holds the Team Pod's; every seat is the template's own (@liveworkspace/avatar seatPoints).

import type { SpaceSceneSpec } from './hero-space-cast';

// The Virtual Office's top row: the Desks room (x -300..320, its door at x -40..60) and the Meeting Room
// (x 380..780, its door at x 530..630), both y -427..-87, and the corridor under them where the team's wall is.
const CORRIDOR_Y = -54;

export const OFFICE: SpaceSceneSpec = {
  id: 'virtual-office',
  template: 'virtual-office',
  stage: { x: -320, y: -440, width: 1120, height: 520 },
  cast: [
    // Focusing at his desk, headphones on, for the whole scene.
    {
      name: 'Leo',
      colour: '#f59e0b',
      config: { gender: 'male', clothing: 'flannel', hair: 'curly', size: 'regular' },
      from: { x: -220, y: -303 },
      start: 0,
      path: [],
      rest: 'up',
      sits: true,
      headphones: true,
    },
    {
      name: 'Ana',
      colour: '#8b5cf6',
      config: { gender: 'female', clothing: 'suit', hair: 'long', size: 'regular' },
      from: { x: 20, y: -303 },
      start: 0,
      path: [],
      rest: 'up',
      sits: true,
    },
    // Waiting at the end of the meeting table.
    {
      name: 'Priya',
      colour: '#ec4899',
      config: { gender: 'female', clothing: 'jumper', hair: 'bob', size: 'regular' },
      from: { x: 675, y: -275 },
      start: 0,
      path: [],
      rest: 'left',
      sits: true,
    },
    // Up from between the desks, out of the Desks room's door, along the corridor and into the Meeting Room.
    {
      name: 'Maya',
      colour: '#10b981',
      config: { gender: 'female', clothing: 'tee', hair: 'ponytail', size: 'regular' },
      from: { x: 40, y: -190 },
      start: 0.4,
      path: [
        { x: 40, y: CORRIDOR_Y },
        { x: 550, y: CORRIDOR_Y },
        { x: 550, y: -231 },
      ],
      rest: 'up',
      sits: true,
    },
    {
      name: 'Sam',
      colour: '#0ea5e9',
      config: { gender: 'male', clothing: 'hoodie', hair: 'short', size: 'regular' },
      from: { x: -220, y: -108 },
      start: 1.2,
      path: [
        { x: 0, y: -108 },
        { x: 0, y: CORRIDOR_Y },
        { x: 610, y: CORRIDOR_Y },
        { x: 610, y: -231 },
      ],
      rest: 'up',
      sits: true,
    },
  ],
  speech: [
    { who: 'Priya', text: 'Demo time? 👋', at: 2.0 },
    { who: 'Maya', text: 'On my way!', at: 5.4 },
    { who: 'Sam', text: 'Saved you a seat', at: 8.3 },
    { who: 'Ana', text: 'Joining from here 👀', at: 11.2 },
  ],
  // The team's wall in the corridor under the Desks room: a row of notes under a heading, one still to write.
  stickies: {
    heading: { x: -296, y: -40, width: 320, label: 'Launch Week' },
    notes: [
      { x: -296, y: -8, size: 70, colour: '#fde68a', text: 'Demo at 3' },
      { x: -214, y: -8, size: 70, colour: '#fbcfe8', text: 'Cake 🎂' },
      { x: -132, y: -8, size: 70, colour: '#bbf7d0', text: 'Ship notes' },
      { x: -50, y: -8, size: 70, colour: '#bae6fd' },
    ],
  },
  board: {
    stickies: {
      demo: { x: -296, y: -8 },
      cake: { x: -214, y: -8 },
      ship: { x: -132, y: -8 },
      live: { x: -50, y: -8 },
    },
    size: 70,
    note: { sticky: 'live', text: 'Live Fri!', at: 6.2 },
    fontSize: 12,
    remote: { name: 'Kit', colour: '#14b8a6' },
  },
};

// The All-Hands Hall's front: the stage (x -200..200, y -514..-354) with its Bring Focus button, and the front row of
// chairs facing it either side of the aisle (x -79..80), the room's door far below the window's edge.
export const HALL: SpaceSceneSpec = {
  id: 'all-hands-hall',
  template: 'all-hands-hall',
  stage: { x: -560, y: -577, width: 1120, height: 500 },
  cast: [
    // On the stage, facing the room.
    {
      name: 'Ana',
      colour: '#8b5cf6',
      config: { gender: 'female', clothing: 'suit', hair: 'long', size: 'regular' },
      from: { x: -30, y: -421 },
      start: 0,
      path: [],
      rest: 'down',
      reaction: { kind: 'wave', at: 2.0 },
    },
    // The front row, seated with their backs to us.
    ...(
      [
        ['Maya', '#10b981', { gender: 'female', clothing: 'tee', hair: 'ponytail' }, -287, -240],
        ['Jo', '#ef4444', { gender: 'male', clothing: 'stripes', hair: 'spiky' }, -202, -240],
        ['Priya', '#ec4899', { gender: 'female', clothing: 'jumper', hair: 'bob' }, 118, -240],
        ['Sam', '#0ea5e9', { gender: 'male', clothing: 'hoodie', hair: 'short' }, 288, -240],
        ['Kit', '#14b8a6', { gender: 'female', clothing: 'dress', hair: 'afro' }, -372, -240],
        ['Raj', '#6366f1', { gender: 'male', clothing: 'polo', hair: 'buzz' }, 203, -240],
      ] as const
    ).map(([name, colour, config, x, y]) => ({
      name,
      colour,
      config: { ...config, size: 'regular' as const },
      from: { x, y },
      start: 0,
      path: [],
      rest: 'up' as const,
      sits: true,
    })),
    // In late, up the aisle to a free seat on the front row.
    {
      name: 'Leo',
      colour: '#f59e0b',
      config: { gender: 'male', clothing: 'flannel', hair: 'curly', size: 'regular' },
      from: { x: 0, y: -35 },
      start: 3.0,
      path: [
        { x: 0, y: -240 },
        { x: -117, y: -240 },
      ],
      rest: 'up',
      sits: true,
    },
  ],
  speech: [
    { who: 'Ana', text: 'Welcome, everyone! 👋', at: 2.0 },
    { who: 'Ana', text: 'Three big wins this quarter', at: 5.2 },
    { who: 'Leo', text: 'Sorry, I’m late!', at: 8.4 },
    { who: 'Priya', text: 'Congrats, team! 🎉', at: 11.2 },
  ],
};
