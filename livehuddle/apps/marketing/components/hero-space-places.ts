// Two more Spaces in use, for the landing beats (docs/specs/019-marketing/marketing-site.md "Feature scenes"): the
// Virtual Office, where the team at their desks walks over to the meeting room, and the All-Hands Hall, where the
// room sits facing the stage. Pure data in each template's own canvas coordinates (buildTemplate(kind, 0, 0)), as
// hero-space-cast.ts holds the Team Pod's; every seat is the template's own (@livehuddle/avatar seatPoints).

import type { SpaceSceneSpec } from './hero-space-cast';

// The Virtual Office's top row: the Desks room (x -375..400, its door at x -35..61) and the Meeting Room
// (x 475..975, its door at x 665..785), both y -534..-109, and the corridor under them where the team's wall is.
const CORRIDOR_Y = -76;

export const OFFICE: SpaceSceneSpec = {
  id: 'virtual-office',
  template: 'virtual-office',
  stage: { x: -400, y: -565, width: 1400, height: 650 },
  cast: [
    // Focusing at his desk, headphones on, for the whole scene.
    {
      name: 'Leo',
      colour: '#f59e0b',
      config: { gender: 'male', clothing: 'flannel', hair: 'curly', size: 'regular' },
      from: { x: -295, y: -410 },
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
      from: { x: -55, y: -410 },
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
      from: { x: 770, y: -382 },
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
      from: { x: 43, y: -212 },
      start: 0.4,
      path: [
        { x: 43, y: CORRIDOR_Y },
        { x: 685, y: CORRIDOR_Y },
        { x: 685, y: -262 },
        { x: 645, y: -262 },
        { x: 645, y: -338 },
      ],
      rest: 'up',
      sits: true,
    },
    {
      name: 'Sam',
      colour: '#0ea5e9',
      config: { gender: 'male', clothing: 'hoodie', hair: 'short', size: 'regular' },
      from: { x: -295, y: -215 },
      start: 1.2,
      path: [
        { x: 3, y: -215 },
        { x: 3, y: CORRIDOR_Y },
        { x: 705, y: CORRIDOR_Y },
        { x: 705, y: -338 },
      ],
      rest: 'up',
      sits: true,
    },
  ],
  speech: [
    // Ana answers from her desk while the others walk the corridor (longer since the rooms opened out); Maya and Sam
    // speak once they are in.
    { who: 'Priya', text: 'Demo time? 👋', at: 2.0 },
    { who: 'Ana', text: 'Joining from here 👀', at: 4.8 },
    { who: 'Maya', text: 'On my way!', at: 7.6 },
    { who: 'Sam', text: 'Saved you a seat', at: 10.4 },
  ],
  // The team's wall in the corridor under the Desks room: a row of notes under a heading, one still to write.
  stickies: {
    heading: { x: -371, y: -62, width: 320, label: 'Launch Week' },
    notes: [
      { x: -371, y: -30, size: 70, colour: '#fde68a', text: 'Demo at 3' },
      { x: -289, y: -30, size: 70, colour: '#fbcfe8', text: 'Cake 🎂' },
      { x: -207, y: -30, size: 70, colour: '#bbf7d0', text: 'Ship notes' },
      { x: -125, y: -30, size: 70, colour: '#bae6fd' },
    ],
  },
  board: {
    stickies: {
      demo: { x: -371, y: -30 },
      cake: { x: -289, y: -30 },
      ship: { x: -207, y: -30 },
      live: { x: -125, y: -30 },
    },
    size: 70,
    note: { sticky: 'live', text: 'Live Fri!', at: 6.2 },
    fontSize: 12,
    remote: { name: 'Kit', colour: '#14b8a6' },
  },
};

// The All-Hands Hall's front: the stage (x -200..200, y -654..-494) with its Bring Focus button, and the front row of
// chairs facing it either side of the aisle (x -172..110), the room's door far below the window's edge.
export const HALL: SpaceSceneSpec = {
  id: 'all-hands-hall',
  template: 'all-hands-hall',
  stage: { x: -700, y: -717, width: 1400, height: 625 },
  cast: [
    // On the stage, facing the room.
    {
      name: 'Ana',
      colour: '#8b5cf6',
      config: { gender: 'female', clothing: 'suit', hair: 'long', size: 'regular' },
      from: { x: -30, y: -561 },
      start: 0,
      path: [],
      rest: 'down',
      reaction: { kind: 'wave', at: 2.0 },
    },
    // The front row, seated with their backs to us.
    ...(
      [
        ['Maya', '#10b981', { gender: 'female', clothing: 'tee', hair: 'ponytail' }, -380, -298],
        ['Jo', '#ef4444', { gender: 'male', clothing: 'stripes', hair: 'spiky' }, -295, -298],
        ['Priya', '#ec4899', { gender: 'female', clothing: 'jumper', hair: 'bob' }, 147.5, -298],
        ['Sam', '#0ea5e9', { gender: 'male', clothing: 'hoodie', hair: 'short' }, 317.5, -298],
        ['Kit', '#14b8a6', { gender: 'female', clothing: 'dress', hair: 'afro' }, -465, -298],
        ['Raj', '#6366f1', { gender: 'male', clothing: 'polo', hair: 'buzz' }, 232.5, -298],
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
      from: { x: -31, y: -50 },
      start: 3.0,
      path: [
        { x: -31, y: -298 },
        { x: -210, y: -298 },
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
