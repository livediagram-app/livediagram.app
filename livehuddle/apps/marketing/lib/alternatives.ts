import type { Alternative, Comparisons } from '@liveworkspace/comparisons';
import { SITE_URL } from '@livehuddle/ui';

// livehuddle's comparisons, drawn by @liveworkspace/comparisons (packages/comparisons/README.md
// "livehuddle"). The hub, every page, their metadata and the sitemap read this list, so adding a
// competitor is a one-place change. Bump the date with any change to them. Each competes on the
// competitor's own ground: the online board a team meets and runs its workshops on.
const UPDATED = new Date('2026-11-03');

const LIST: Alternative[] = [
  {
    slug: 'miro',
    name: 'Miro',
    highlights: ['Free, no tiers', 'No sign-up', 'Meet on the board'],
    title: 'Miro alternative for meetings and workshops · livehuddle',
    description:
      'A free, open-source Miro alternative for meetings and workshops: timers and polls on the board, avatars in a shared Space, no account needed.',
    h1: 'The open-source Miro alternative for meetings and workshops',
    lede: 'Miro is a powerful, sprawling online workspace, and much of what teams do on it is meet: retros, stand-ups, planning, workshops. livehuddle is built for exactly that part. Open a Space from a link, walk in as your own character, and run the session on the board with a timer and polls built in, free, open source and with no sign-up.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free tier, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary SaaS' },
      {
        label: 'Start without an account',
        us: 'Yes, create and run a session as a guest',
        them: 'An account to create boards; guest editing on paid plans',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Session tools',
        us: 'Timer, polls, quizzes, estimates, Q&A and a facilitator baton, free',
        them: 'Timer, voting and facilitation tools, several on paid plans',
      },
      {
        label: 'Meeting in a place',
        us: 'Avatars walking round offices, team pods and halls',
        them: 'Boards; meeting presence through cursors and video',
      },
      {
        label: 'Programmatic access',
        us: 'REST API, a command line and an MCP server for AI tools, all free',
        them: 'Developer platform + marketplace',
      },
    ],
    themBest: [
      'Facilitating very large workshops: breakout-scale sessions and a marketplace of meeting apps around the board.',
      'A deep template and integration marketplace (Jira, Slack, and more).',
      'One workspace for everything visual: diagrams, docs, tables and video walkthroughs beside the workshop boards.',
      'Enterprise admin, SSO, and compliance at large scale.',
    ],
    usBest: [
      "It's free for everyone and MIT-licensed, with no per-seat pricing and nothing to upgrade to.",
      'Open a link and you are in, with no sign-up wall, even to create a Space.',
      'Meet in a place, not just on a board: everyone walks their own character round a virtual office, a team pod or an all-hands hall, with a status, speech bubbles and reactions.',
      'Session tools on every board: a shared timer, live polls, planning-poker estimate cards, temperature checks, quizzes, an anonymous idea box and a Q&A board.',
      'One person runs the room: hand the facilitator baton to whoever is running it, and the timer and reveals answer to them alone.',
      'Run the meeting itself on the board: an agenda that starts the timer for each segment, a roll call, a random picker, reveal zones that cover work until the room is ready, and decision records that keep what was agreed.',
      'Participant links let a workshop add stickies, write and comment without being able to reshape the board.',
      'Assign action items to teammates on the board itself, so the follow-ups leave the meeting with an owner.',
      '11 templates: a blank Space, and offices, halls, bars and gardens to walk round.',
    ],
    sections: [
      {
        heading: 'Built for the meeting, not the whole workspace',
        paragraphs: [
          'Miro grew into a broad workspace: boards, docs, tables, diagrams, video walkthroughs and a marketplace of apps. livehuddle does one part of that and goes deep on it: the time a team spends together. Every board is a workshop board, with the Session strip at its foot holding a timer and polls, and a palette of the things a facilitator reaches for, from a Q&A board and an idea box to a quiz with a countdown.',
          'Workshops are built in rather than bolted on. A facilitator runs the room with a shared timer, live polls, planning-poker estimate cards, quizzes and responses kept hidden until the reveal, and templates cover retrospectives in five formats, Lean Coffee and town hall Q&A. When the session ends, the actions it produced are assigned on the board.',
        ],
      },
      {
        heading: 'A place to meet in',
        paragraphs: [
          'A board shows where people are pointing; a Space shows where they are. Open the Team Pod or the Virtual Office and you walk in as a little character in your own colour, sit at a desk, gather round the meeting table, and say hello in a speech bubble. A status above your head tells the room whether you are free, focusing, in a meeting or away, and portals take everyone from one room or tab to the next.',
        ],
      },
      {
        heading: 'Free means free, not a free tier',
        paragraphs: [
          "Miro's free tier is real, but it's the top of a pricing funnel: board limits and gated features exist to move teams onto paid seats. livehuddle has no paid tier and no plan to introduce one. The hosted version at livehuddle.app is free, every user gets every feature, and there is nothing to upgrade to.",
          'The whole codebase is MIT-licensed and public, so anyone can read exactly how it works.',
        ],
      },
      {
        heading: 'Collaboration without the onboarding',
        paragraphs: [
          'In Miro, creating a board starts with an account, and anonymous guest editing depends on the plan you are on. In livehuddle, joining is a URL. Anyone can create a Space without signing up; a guest’s new Space is kept in their browser until they press Share, which syncs it in one step. A link is an Editor or a Participant link (a Participant talks, adds stickies, writes and comments but cannot reshape the board), and it can carry a password or an expiry date when you need it locked down.',
          'For programmatic use there is a free REST API with personal tokens, a command line, and an MCP server at mcp.livehuddle.app that lets AI assistants read and change your Spaces directly. None of it sits behind a plan.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livehuddle really free?',
        a: 'Yes. The hosted version at livehuddle.app is free with every feature included, and there is no paid tier or plan to add one. The code is MIT-licensed and public.',
      },
      {
        q: 'Do my teammates need an account to join a session?',
        a: 'No. Share a link and anyone who opens it is in the Space with you, live cursors and all, without signing up. You do not need an account to create a Space either: a guest’s Space is kept in their browser until they press Share, which syncs it in one step. Accounts are optional and mainly useful for keeping your Spaces across devices and using teams.',
      },
      {
        q: 'Can I import my existing Miro boards?',
        a: "There's no Miro importer: livehuddle imports only its own tab exports. For a recurring session, the fastest path is to start from a livehuddle template (a retro, a town hall, Lean Coffee, a meeting agenda) and carry on there.",
      },
      {
        q: 'Can livehuddle run workshops the way Miro does?',
        a: 'Retros, stand-ups, brainstorms, estimation and planning sessions work well: a facilitator runs a shared timer, live polls, a Q&A board and hidden responses that are revealed together, estimate cards run planning poker on the board, everyone can follow the facilitator’s view, and the Space keeps the comments and assigned actions that came out of it. What livehuddle does not have is Miro’s large-scale facilitation ecosystem (breakout-style sessions, a meeting-app marketplace), so for big multi-team workshops Miro is still the deeper toolkit.',
      },
    ],
  },
  {
    slug: 'figjam',
    name: 'FigJam',
    highlights: ['No seats', 'No sign-up', 'Avatars in a Space'],
    title: 'FigJam alternative for meetings and workshops · livehuddle',
    description:
      'A free, open-source FigJam alternative for meetings and workshops: session tools built in, avatars in a shared Space, and no account or seat needed.',
    h1: 'The free, open-source FigJam alternative for meetings and workshops',
    lede: 'FigJam is a polished, playful whiteboard that lives inside Figma, and a favourite for retros, brainstorms and team rituals. livehuddle covers that same ground, the sessions a team runs together, as free, open-source software that anyone can open from a link, no account or Figma seat needed.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Free Starter plan with limits, then paid Figma seats',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and run a session as a guest',
        them: 'An account to create files',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Session tools',
        us: 'Timer, polls, quizzes, estimates, Q&A and a facilitator baton',
        them: 'Timer, voting, music and widgets',
      },
      {
        label: 'Meeting in a place',
        us: 'Avatars walking round offices, team pods and halls',
        them: 'Cursors, cursor chat and emotes on the board',
      },
      {
        label: 'Programmatic access',
        us: 'REST API, a command line and an MCP server for AI tools, all free',
        them: 'A plugin and widget platform, and the Figma API',
      },
    ],
    themBest: [
      'Your team designs in Figma, and you want boards that sit beside your design files and copy across into them.',
      'A playful, polished feel: stamps, stickers, emotes, cursor chat and widgets.',
      'A large community of plugins, widgets and templates.',
      'FigJam AI, for generating boards, sorting and summarising sticky notes.',
    ],
    usBest: [
      'Free with no file limits and no seats: every feature, for everyone.',
      'Open a link and start, no account needed, even to create a Space.',
      'Meet on the board: everyone walks an avatar round a virtual office or team pod, with speech bubbles, a status and a cheer when it goes well.',
      'Workshop tools built in: a facilitator role, a shared timer, live polls, planning-poker estimate cards, temperature checks, quizzes, an anonymous idea box and a Q&A board.',
      'Participant links: the room adds stickies, writes and comments, and nobody can reshape the board by accident.',
      'Run the meeting on the board: an agenda that starts the timer for each segment, a roll call, a random picker and decision records, plus around 190 emoji stickers and 32 word badges.',
      '11 templates: a blank Space, and offices, halls, bars and gardens to walk round.',
      'A free REST API, a command line and an MCP server, so scripts and AI assistants can read and change your Spaces.',
      'MIT-licensed, with portable exports, so your sessions never depend on one vendor.',
    ],
    sections: [
      {
        heading: 'A board without the seat',
        paragraphs: [
          'FigJam is part of Figma, and that is its great strength for design teams: boards and design files share one home. For everyone else, it means accounts, a free plan with limits on shared files, and paid seats as the team grows. livehuddle has none of that. Anyone can open a Space without signing up, share a link, and work together in real time; a guest’s Space stays in their browser until they press Share, which syncs it in one step. There is no paid tier and no plan to introduce one.',
        ],
      },
      {
        heading: 'Workshops built in',
        paragraphs: [
          'Running a session needs more than sticky notes. Every livehuddle board carries a Session strip with a shared timer and live polls, and one person can hold the facilitator baton so the room has a single host. Estimate cards run planning poker, a temperature check shows how the room feels, a quiz asks what it knows, and an idea box collects anonymous ideas until the reveal. There are templates for retrospectives in five formats, Lean Coffee and town hall Q&A, and comments and assigned actions keep the follow-ups with the board.',
        ],
      },
      {
        heading: 'A Space to meet in',
        paragraphs: [
          'FigJam shows the room as cursors. livehuddle shows it as people: open a Space and you walk in as a character in your own colour, find the team round the meeting table, and talk it through in speech bubbles, with a wave, a cheer or a burst of confetti when it lands. Offices, team pods and an all-hands hall are ready to walk into, and you can build your own rooms from desks, sofas and a coffee machine.',
        ],
      },
      {
        heading: 'Open at the edges',
        paragraphs: [
          'Any board exports as PNG, SVG, PDF or a portable JSON file, and any share link embeds as a live-updating iframe in a wiki or doc. For automation there is a free REST API with personal tokens, a command line, and an MCP server that lets AI assistants read and change your Spaces directly.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livehuddle really free compared with FigJam?',
        a: 'Yes. Every feature is free for everyone, with no file limits, no seats and no paid tier. The code is MIT-licensed.',
      },
      {
        q: 'Can I import my FigJam boards?',
        a: 'Not directly: there is no FigJam importer. You can bring a board across as a picture by exporting it from FigJam as a PNG and adding it to a tab as an image. For new sessions, start from one of the 11 templates.',
      },
      {
        q: 'Does livehuddle work with Figma?',
        a: 'Partly. A Figma file, prototype or board link sits on the board as a live embed, but nothing syncs or imports between the two. If your boards need to live beside your Figma design files, FigJam is the better pick.',
      },
      {
        q: 'Can my team join without accounts?',
        a: 'Yes. Share an editor link and anyone who opens it is in the Space with you, live cursors and all, without signing up. A Participant link, the one a new link starts as, lets people talk, add stickies, write and comment without reshaping the board. You can add a password or an expiry date to a link, and revoke it at any time.',
      },
    ],
  },
];

export const COMPARISONS: Comparisons = {
  app: 'livehuddle',
  siteUrl: SITE_URL,
  updated: UPDATED,
  hub: {
    title: 'How livehuddle compares · alternatives',
    description:
      'Honest, side-by-side comparisons of livehuddle with Miro and FigJam for meetings and workshops, including where each is the better pick.',
    heading: 'How livehuddle compares',
    lede: 'Thinking about another tool for your meetings and workshops? Here is an honest, side-by-side look at how livehuddle compares, including where each one is the better pick.',
  },
  alternatives: LIST,
};
