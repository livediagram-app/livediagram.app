// The livehuddle help catalogue: its categories and the articles only livehuddle has (docs/specs/017-help/help-centre.md).
// Articles several apps share live in ./shared/. Moved from livehuddle's own help registry; each article names the
// app it applies to.

import type { Article, Category } from '../types';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livehuddle',
    description:
      'Get to know livehuddle: a free, open-source place where a team meets in a Space, and who it is for.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a new Space to a team meeting in it in minutes, with the basics every new user needs.',
    articleCount: 6,
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description:
      'Work faster with the shortcuts, hidden features, and small habits experienced users rely on.',
    articleCount: 6,
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description:
      'Stay in control of your work: how guest access, signing in, syncing, exporting, downloading all your data, deletion, API tokens, the Google Drive mirror, and email notifications work.',
    articleCount: 9,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your spaces are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livehuddle REST API from your own scripts: authentication, worked examples, errors and limits, and the OpenAPI reference.',
    articleCount: 6,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description:
      'Get unstuck fast with fixes for the most common editor and collaboration problems.',
    articleCount: 6,
  },
  {
    slug: 'supported-devices',
    title: 'Supported Devices',
    description:
      'How livehuddle works on a computer, a tablet, and a phone, and what to expect on each.',
    articleCount: 3,
  },
  {
    slug: 'policies',
    title: 'Policies',
    description:
      "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
    articleCount: 1,
  },
  {
    slug: 'contact',
    title: 'Contact',
    description: 'Get in touch, report a bug, or request a feature.',
    articleCount: 0,
  },
  // Feature-guide categories (kind: 'feature'). Rendered under "Feature Guides"
  // on the home page; each has a card-grid index at /help/<slug>/. articleCount
  // counts the feature landings in the category (each landing has its own
  // sub-guides). See liveworkspace/docs/specs/017-help/help-centre.md.
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editor: the panels, toolbar, context menus, the Map, zoom and tab bars, and quick controls.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: how the Explorer keeps your spaces, folders, teams, and assets easy to find and manage.',
    articleCount: 12,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets'],
  },
  {
    slug: 'selection-modes',
    title: 'Edit or Walk',
    description:
      'The Edit | Walk toggle at the start of the palette: build the board, or walk it as your character, and the Format Painter.',
    articleCount: 4,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on the canvas: every element and palette setting explained.',
    articleCount: 16,
    kind: 'feature',
    groups: ['Everyday Elements', 'Meeting Kits', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Master the infinite canvas: place, select, rotate and theme elements, undo changes, and start from templates.',
    articleCount: 14,
    kind: 'feature',
    groups: ['Basics', 'Text and Notes', 'Styling Elements'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one canvas: organise, link, and move between multiple boards with tabs.',
    articleCount: 8,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, calls, teams, sharing, and session tools.',
    articleCount: 8,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: automations, light and dark mode, and cleanup.',
    articleCount: 3,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any canvas, folder, team, tab, or element, and add new elements to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];

export const articles: Article[] = [
  // ---- About ----
  {
    slug: 'what-is-livehuddle',
    title: 'What is livehuddle?',
    description:
      'An overview of livehuddle, the shared Spaces a team walks into as characters to meet.',
    keywords:
      'overview intro introduction about product meet meeting virtual office space avatar app 3d view receptionist calls',
    category: 'About livehuddle',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livehuddle'],
  },
  {
    slug: 'why-livehuddle',
    title: 'Why Use livehuddle?',
    description: 'Free, open source, no sign-in wall, and everyone in the room live. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livehuddle',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livehuddle'],
  },
  // ---- Getting Started ----
  {
    slug: 'your-first-space',
    title: 'Your First Space',
    description: 'Open a Space, walk in as your character, say hello and invite your team.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding template location canvas space spaces walk avatar sticky note rename',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livehuddle'],
  },
  {
    slug: 'exporting-spaces',
    title: 'Exporting Spaces',
    description: 'Get a tab out as an image, a PDF or a portable file, or embed a live view.',
    keywords:
      'export download png svg pdf image save picture screenshot json markdown embed backup',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livehuddle'],
  },
  {
    slug: 'download-all-my-data',
    title: 'Download All My Data',
    description: 'Download every space you own, with a picture of each tab, as one zip.',
    keywords:
      'download all my data zip export backup everything portability gdpr settings your data comments pictures png livehuddle file email link',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livehuddle'],
  },
  {
    slug: 'avatar-mode',
    title: 'Avatar Mode',
    description: 'Walk a pixel character around the canvas while you talk through it.',
    keywords:
      'walk walking character habbo person figure sprite avatar presentation present tour narrate arrow keys steer jump hop flag wave space male female right-click read-only customise customize panel gender clothing hair size outfit hoodie suit dress ponytail bald tall small speech bubble message say talk chat enter send words float avatar button status available focusing busy meeting away headphones do not disturb need help question lunch sandwich angry steam ears celebrating party hat confetti thinking thought bubble sick ice pack mood change tab switch tab leave avatar mode 3d view turn left turn right',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes',
    apps: ['livehuddle'],
  },
  {
    slug: 'avatar-tour',
    title: 'The Receptionist',
    description:
      'The Receptionist walks the Space, greets everyone who arrives on the Avatar Pad, and shows you how the Space works when you ask.',
    keywords:
      'receptionist receptionist host guide ask help welcome avatar tour walkthrough onboarding intro introduction getting started guide tutorial first time learn character walk dress outfit hair behaviour reactions speech bubble message say talk chat push shove replay rerun settings',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes/avatar-mode',
    parentSlug: 'avatar-mode',
    apps: ['livehuddle'],
  },
  {
    slug: '3d-view',
    title: 'The 3D View',
    description:
      'Walk a Space in 3D: walls stand up, rooms open as you near them, and Turn Left and Turn Right show every side.',
    keywords:
      '3d three d view tilt perspective walls stand up rooms open turn left turn right rotate camera bracket keys shift 3 flat 2d plan glow usable pieces arrival default isometric map',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes/avatar-mode',
    parentSlug: 'avatar-mode',
    apps: ['livehuddle'],
  },
  {
    slug: 'walking-together',
    title: 'Walking Together',
    description: "Everyone on a shared space sees everyone else's walking character.",
    keywords:
      'multiplayer together shared collaborate collaboration peers others everyone realtime real-time avatars characters names colour color presence document',
    category: 'Edit or Walk',
    categorySlug: 'selection-modes',
    parentSlug: 'avatar-mode',
    apps: ['livehuddle'],
  },
  {
    slug: 'chairs',
    title: 'Chairs',
    description: 'Chairs, desks and sofas for Avatar mode: walk a character in and it sits down.',
    keywords:
      'chair chairs seat seating sit sitting sat furniture avatar character walk stand table room seating plan attendance behaviour navigate facing up desk desks computer monitor screen office workstation sofa sofas couch settee loveseat two seater',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'fences',
    title: 'Fences',
    description: 'A barrier for Avatar mode: characters cannot walk through a fence.',
    keywords:
      'fence fences barrier wall block blocked keep out enclosure boundary pen gate avatar character walk collision no entry area navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'avatar-pads',
    title: 'Avatar Pads',
    description: 'Where everyone starts in Avatar mode: characters beam in on the pad.',
    keywords:
      'avatar pad pads spawn start starting point entrance arrive arrival teleport teleporter beam lobby welcome where do people appear avatar character walk navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'directory',
    title: 'Directory',
    description: 'Every room in the space and who is in each, with Walk There and Go.',
    keywords:
      'directory kiosk lobby board map wayfinding rooms room list who is where people find someone go to walk there jump travel floor tab avatar navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  // The Portal left livediagram (Work Tracker 1318), so its article is livehuddle's alone; livediagram's help answers
  // the path with a 308 to this one.
  {
    slug: 'portals',
    title: 'Portals',
    description:
      'Link two portals and jump between them in one click, across a big canvas or to another tab.',
    keywords:
      'portal door teleport jump travel warp link pair navigate shortcut across tabs walk through',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
    apps: ['livehuddle'],
  },
  {
    slug: 'elevator',
    title: 'Elevator',
    description: "A lift between a space's tabs: pick a floor and step out of its Elevator.",
    keywords:
      'elevator lift floor floors level levels tab tabs building up down ride travel go between tabs portal automatic avatar navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'stairs',
    title: 'Stairs',
    description: "A flight between a space's tabs: climb to the floor above or below.",
    keywords:
      'stairs staircase stairway steps flight upstairs downstairs up down climb walk floor floors level levels tab tabs building travel go between tabs automatic avatar navigate behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'screen',
    title: 'Screen',
    description:
      'A wall screen that shows a screen share from someone in its room, or a video link.',
    keywords:
      'screen tv television monitor display wall screen share sharing presentation present video youtube vimeo loom meeting room open large call avatar behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'room-sign',
    title: 'Room Sign',
    description: "A sign by a room's door: Free, In Use or Do Not Disturb, with a Knock button.",
    keywords:
      'room sign door sign plaque free busy in use occupied engaged vacant do not disturb knock knocking let in not now meeting room office pod avatar behaviour',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'virtual-office',
    title: 'Virtual Office',
    description:
      'Rooms of any shape, room types, glass walls, windows, corridors, sliding and revolving doors, a stage, an office pod, a meeting table, a long table, bean bags and a reading nook, a bar, a garden, a recreation corner, a vending machine, a kitchenette, a restroom, a printer, a copier, lockers, a coat rack, a notice board, world clocks, a calendar wall, a suggestion box, a team photo wall, a signpost, stage curtains and a podium, a phone booth, a nap pod, a reception desk with a bell, hot desks, standing desks, a treadmill, a weight bench, an office dog, pillars and columns, a swimming pool, a car park, a bike rack, plants, shelves, drinks and rugs for Avatar mode.',
    keywords:
      'virtual office room rooms room types presets long table boardroom table change type glass walls glass room meeting booth window windows light boardroom open plan lounge corridor corridors hallway hall junction crossroads sliding door revolving door double door persian kilim runner doormat striped rug round rug room builder custom shape l-shaped 45 degree angle draw walls corners door doors doorway stage platform office pod booth meeting table conference plant bookshelf books water cooler coffee machine drink cup rug carpet kitchen lounge reception bar stool drinks cabinet fridge juice soda garden tree outdoor plant path stepping stones grass lawn turf picket fence bench picnic table hammock umbrella parasol fountain pond campfire fireplace fire notice board cork pin note notes world clock time zone timezone jukebox music radio stream ping pong ping-pong table tennis pool table snooker billiards foosball table football darts dartboard vending machine snacks printer copier photocopier lockers coat rack coat hook umbrella stand kitchenette kitchen counter sink fridge refrigerator microwave kettle restroom toilet bathroom washroom wc cubicle washbasin basin mirror hand dryer stage curtains drapes podium lectern pillar column swimming pool car park parking bike rack bicycle bean bag beanbag reading nook armchair lamp breakout arcade game moon mail high score high scores leaderboard clear high scores reset scores play recreation phone booth call busy nap pod sleep rest focus reception front desk bell ring welcome hot desk hotdesk standing desk treadmill gym weight bench workout break pet dog pet bed pat calendar wall planner month dates suggestion box ideas anonymous feedback signpost sign post arrows directions team photo wall photos portraits frames team avatar walk sit navigate floor floors floor type floor colour floor color floorboards tiles carpet stone concrete oak walnut pinned notes walk-up',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Meeting Kits',
    apps: ['livehuddle'],
  },
  {
    slug: 'proximity-audio',
    title: 'Proximity Audio',
    description: 'Talk with the people your character is near, and see who is talking further off.',
    keywords:
      'audio voice call calls talk talking speak speaker microphone mic mute unmute listen listen in join audio leave proximity nearby earshot hearing headphones equaliser equalizer bars walk over muted blocked nobody near huddle raise hand lower hand let speak stage podium lectern further reach do not disturb dnd hearing ring audio proximity ring range who can hear me everyone can hear you mini view pop out camera tiles',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livehuddle'],
  },
  {
    slug: 'cameras-and-screen-sharing',
    title: 'Cameras and Screen Sharing',
    description: 'Turn on your camera or share a screen in a bubble above your character.',
    keywords:
      "camera video webcam face screen share sharing present presenting window tab bubble maximise maximize restore stop sharing stop someone's share preview only you video paused call calls mini view",
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livehuddle'],
  },
  // ---- Sub-articles: Virtual Office ----
  {
    slug: 'stage',
    title: 'Stage',
    description: 'A platform whoever stands on is heard by everyone on the tab, for an all-hands.',
    keywords:
      'stage platform podium all-hands all hands town hall keynote presenter presenting speaker speak talk heard everyone broadcast audience raise hand who can speak editors participants show cameras video call calls audio',
    category: 'Palette',
    categorySlug: 'palette/virtual-office',
    parentSlug: 'virtual-office',
    apps: ['livehuddle'],
  },
  {
    slug: 'turning-furniture',
    title: 'Turning Furniture',
    description: 'Face a sofa, a desk or lockers down, left, up or right; its seats turn with it.',
    keywords:
      'turn turning rotate rotation rotating face facing direction orientation orient spin flip left right up down sideways side wall sofa desk chair lockers furniture piece quarter space bar spacebar shift place placing drop seats sit',
    category: 'Palette',
    categorySlug: 'palette/virtual-office',
    parentSlug: 'virtual-office',
    apps: ['livehuddle'],
  },
  // ---- Sub-articles: Live Presence ----
  {
    slug: 'tab-attendance',
    title: 'Attendance',
    description: 'Who was in a tab and when: who joined, when they left and how long they stayed.',
    keywords:
      'attendance history who was here attended joined left visit visits log record meeting standup roll call register time spent duration how long kept 90 days guest',
    category: 'Collaboration',
    categorySlug: 'collaboration/live-presence',
    parentSlug: 'live-presence',
    apps: ['livehuddle'],
  },
];
