// The livediagram help catalogue: its categories and the articles only livediagram has (docs/specs/016-help/help-centre.md).
// Articles several apps share live in ./shared/. Moved from livediagram's own help registry; each article names the
// app it applies to.

import type { Article, Category } from '../types';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livediagram',
    description:
      'Get to know livediagram: what it is, who it helps, and the ideas behind a free, open canvas.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a blank canvas to a shared diagram in minutes, with the basics every new user needs.',
    articleCount: 8,
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description:
      'Work faster with the shortcuts, hidden features, and small habits experienced users rely on.',
    articleCount: 7,
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description:
      'Stay in control of your work: how guest access, signing in, syncing, exporting, deletion, API tokens, connecting AI tools, the Google Drive mirror, and email notifications work.',
    articleCount: 11,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your canvases are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livediagram REST API from your own scripts or the command line: authentication, worked examples, the CLI, repositories and developer tools, errors and limits, and the OpenAPI reference.',
    articleCount: 9,
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
      'How livediagram works on a computer, a tablet, and a phone, and what to expect on each.',
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
  // sub-guides). See liveworkspace/docs/specs/016-help/help-centre.md.
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
      'Organise everything you build: how the Explorer keeps your canvases, folders, teams, and assets easy to find and manage.',
    articleCount: 16,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets and Imports'],
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette (Select, Hand, Eraser, Format Painter, Laser, Spotlight and Isometric), and the Slide Deck, opened from Tools.',
    articleCount: 8,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on the canvas: every element and palette setting explained.',
    articleCount: 34,
    kind: 'feature',
    groups: ['Everyday Elements', 'Diagram Kits', 'Workshop Kits', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Master the infinite canvas: place, select, link, annotate, layer, rotate, animate, lock and theme elements, undo changes, and start from templates.',
    articleCount: 29,
    kind: 'feature',
    groups: [
      'Basics',
      'Modes and Boards',
      'Text and Notes',
      'Styling Elements',
      'Layers and Locking',
    ],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one canvas: organise, link, and move between multiple boards with tabs.',
    articleCount: 10,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, teams, sharing, and session tools.',
    articleCount: 10,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: zen mode, light and dark mode, Markdown import, and cleanup.',
    articleCount: 4,
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
    slug: 'what-is-livediagram',
    title: 'What is livediagram?',
    description: 'An overview of the real-time, multiplayer diagram editor and what it does.',
    keywords: 'overview intro introduction about product whiteboard drawing tool app',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livediagram'],
  },
  {
    slug: 'why-livediagram',
    title: 'Why Use livediagram?',
    description: 'Free, open source, no sign-in wall, real-time collaboration. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livediagram'],
  },
  // ---- Getting Started ----
  {
    slug: 'your-first-diagram',
    title: 'Your First Diagram',
    description: 'Create a diagram and add your first shapes in under a minute.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding wizard document template location canvas',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livediagram'],
  },
  {
    slug: 'diagram-tour',
    title: 'Watch It Built',
    description:
      'Pick a Diagram topic from Get Started and watch a cursor build it with the real controls. Nothing is saved.',
    keywords:
      'tour walkthrough guide onboarding get started watch it built replay learn tutorial intro diagram mode topics example cursor',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livediagram'],
  },
  {
    slug: 'exporting-diagrams',
    title: 'Exporting Diagrams',
    description: 'Get a tab out as an image, a PDF or a portable file, or embed a live view.',
    keywords:
      'export download png svg pdf image save picture screenshot json mermaid markdown excalidraw embed backup',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livediagram'],
  },
  {
    slug: 'download-your-data',
    title: 'Download Your Data',
    description: 'Everything you own in every app, or a team you run, as one zip.',
    keywords:
      'download export data zip backup archive portability gdpr takeout everything copy leave move team admin your data all my data',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livediagram'],
  },
  {
    slug: 'repositories',
    title: 'Diagrams in Your Repository',
    description:
      'Link a repository with livediagram.toml so agents find your diagrams, and keep snapshots in git.',
    keywords:
      'repository repo git github link livediagram.toml sync mirror snapshot index monorepo codebase coding agent ripgrep search folder commit',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['livediagram'],
  },
  {
    slug: 'isometric-mode',
    title: 'Isometric Mode',
    description: 'Look at the tab as a tilted 3D scene, orbit it, and export it that way.',
    keywords: '3d tilt perspective iso angle view projection orbit rotate camera export',
    category: 'Selection Modes',
    categorySlug: 'selection-modes',
    apps: ['livediagram'],
  },
  {
    slug: 'event-storming',
    title: 'Event Storming Elements',
    description: 'The workshop note grammar: eight sticky kinds, each colour a meaning.',
    keywords:
      'event storming eventstorming domain event command actor policy read model external system aggregate hotspot brandolini ddd workshop notation sticky colours colors orange blue purple big picture process design stage timeline lanes grid snap photo camera wall import add from photo',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'build',
    title: 'Build Elements',
    description:
      'Mind maps, org charts, flowcharts, sequence diagrams, lanes, frames, stacks, boundaries, keys and tables: diagram structure.',
    keywords:
      'build structure layout container holds frame lane boundary timeline table mind node sankey flow arrange scaffold group section band track grid organise card badge step number diagram key legend stack row column grid auto layout even gaps org chart organisation reports hierarchy sequence diagram uml lifeline message',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'frames',
    title: 'Frames',
    description: 'A labelled section that draws behind its contents and moves them as one.',
    keywords:
      'frame section container backdrop labelled box region area cluster move together carries contents behind resize outline f key figjam section export slide framing nest nested centre quick connect plus fill background',
    category: 'Palette',
    categorySlug: 'palette/build',
    parentSlug: 'build',
    apps: ['livediagram'],
  },
  {
    slug: 'sankey-diagram',
    title: 'Sankey Diagram',
    description: 'Show how much moves where: bands as wide as the amount they carry.',
    keywords:
      'sankey flow flows diagram energy budget money income spending funnel conversion journey migration material supply chain band bands width amount quantity nodes split merge sankeymatic alluvial csv paste spreadsheet',
    category: 'Palette',
    categorySlug: 'palette/build',
    parentSlug: 'build',
    apps: ['livediagram'],
  },
  {
    slug: 'mind-maps',
    title: 'Mind Maps',
    description: 'Tab adds a child, Enter a sibling: build a branch from the keyboard.',
    keywords:
      'mind map mindmap node branch child sibling tab enter keyboard tree hierarchy brainstorm outline edit outline markdown list indent bullets branching flow leftward upward downward balanced bubble spacing tight compact comfortable wide select branch delete branch',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'flowcharts',
    title: 'Flowcharts',
    description: 'Tab adds the next step, Enter a parallel one: a flowchart that lays itself out.',
    keywords:
      'flowchart flow chart process diagram step steps decision diamond yes no branch merge loop start end terminator input output parallelogram document database preparation connector iso 5807 tab enter keyboard auto layout tidy swimlane swim lane lanes cross functional direction down right workflow',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'edit-outline',
    title: 'Edit a Mind Map as an Outline',
    description: 'Rewrite a whole mind map as an indented list, then save it back in one go.',
    keywords:
      'mind map mindmap outline edit outline list bullets indent outdent restructure rearrange reorder text markdown paste bold italic underline rows tree hierarchy bulk',
    category: 'Palette',
    categorySlug: 'palette/mind-maps',
    parentSlug: 'mind-maps',
    apps: ['livediagram'],
  },
  {
    slug: 'collaborate',
    title: 'Collaborate elements',
    description:
      'The Collaborate categories (Ask and Record) that collect what the room thinks: comment panels, action panels, estimates, quizzes, temperature checks, idea boxes, Q&A boards, agendas, decisions and roll calls.',
    keywords:
      'collaborate collaboration comment panel action panel task assign card pin pinned remark note thread reply discuss feedback annotate sticky question estimate estimation planning poker story points fibonacci tshirt t-shirt temperature check fist of five pulse mood vote idea box anonymous brainstorm brainwriting retro retrospective q&a qa slido upvote questions agenda run of show timebox segments decision record adr architecture decision roll call attendance register present room team workshop facilitation powers of two',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Workshop Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'boundaries',
    title: 'Boundaries',
    description: 'Titled, tinted containers for regions, networks and systems.',
    keywords:
      'boundary boundaries container zone region vpc subnet network cluster trust zone group c4 system cloud aws azure gcp architecture nested nest tab tint cidr dashed',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'diagram-keys',
    title: 'Diagram Keys and Tag Colours',
    description: 'A legend that builds itself, and cards coloured by their tags.',
    keywords:
      'diagram key keys legend line styles dashed dotted solid meaning explain tag tags colour color colours colors colour code coding by team status layer card edge',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'org-charts',
    title: 'Org Charts',
    description: 'A tree of people with names and roles that lays itself out.',
    keywords:
      'org chart organisation organization chart people team hierarchy reports manager reporting line structure role initials tree ownership',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'sequence-diagrams',
    title: 'Sequence Diagrams',
    description: 'Who calls whom, in order, laid out from a list of messages.',
    keywords:
      'sequence diagram diagrams uml lifeline lifelines message messages call reply async request response interaction api participants actor activation numbered',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'lanes',
    title: 'Lanes',
    description: 'Titled bands for swimlanes; dragging one carries its contents.',
    keywords:
      'lane swimlane swim band row role team process cross-functional container pool track column vertical heading gutter upright title draw.io',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'entities',
    title: 'Entities',
    description:
      'A title over fields with keys, joined field to field, for data models and class diagrams.',
    keywords:
      'entity class uml er erd record table schema model field attribute method database column inheritance aggregation composition fields popular primary foreign key pk fk unique relationship cardinality crows foot one many related',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'bpmn',
    title: 'BPMN',
    description:
      'Events, tasks, gateways, data and pools in BPMN 2.0, with message flows and a .bpmn import.',
    keywords:
      'bpmn bpmn2 business process model notation camunda bpmn.io signavio event start end intermediate timer message error terminate task user service script manual send receive sub-process subprocess gateway exclusive parallel inclusive xor and or data object data store pool lane message flow association workflow process modeler import',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Diagram Kits',
    apps: ['livediagram'],
  },
  {
    slug: 'editor-modes',
    title: 'Editor Modes',
    description:
      'Diagram, Draw and Workshop: what each mode is for, switching from the mode switch on any tab, and Opens in.',
    keywords:
      'editor mode editor modes mode switch switch mode change mode choose mode new tab modes diagram draw workshop session shift+d shift d cycle next mode opens in open in default mode per tab per person tab pill mode icon whiteboard sketch boards kanban phone mobile view only read only kind template workflow way of working slides articles documents livedocuments plan planning boards kanban sheets spreadsheet forms liveplanner',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Modes and Boards',
    apps: ['livediagram'],
  },
  {
    slug: 'draw-mode',
    title: 'Draw Mode',
    description:
      'Freehand drawing on any tab: switch modes, then a dock of pens, a Path tool, a Fill bucket, erasers and shapes.',
    keywords:
      'draw mode drawing mode diagram mode editor mode switch modes mode switch toggle shift+d shift d opens in open in default mode per tab whiteboards whiteboard white board chalkboard blackboard sketch draw drawing freehand hand drawn ink pen pens marker stylus apple pencil surface pen touch finger palm rejection pinch zoom dock toolbar eraser rubber partial erase stroke erase sticky text shapes shape recognition recognise recognize snap clean up background plain dots dotted grid graph microsoft whiteboard dark mode chalk colour color width thickness path tool vector pen tool bezier curve curves anchor point points node nodes handle handles edit points corner smooth mirrored aligned illustrator figma undo redo settings cog more shapes shape search find a shape flowchart pin pinned unpin favourite shapes frequent most used simple mode dock mode colour picker color picker custom colour hex eyedropper eye dropper your colours remove colour contrast dock position top bottom move the dock tablet ipad fill tool fill bucket paint bucket bucket pour colour in color in fill shape fill loop flood fill no fill snap colours snap to stock colours stock colors custom colors convert colours adaptive nearest colour',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Modes and Boards',
    apps: ['livediagram'],
  },
  {
    slug: 'workshop-mode',
    title: 'Workshop Mode',
    description:
      'Run a session on any tab: retros, town halls and workshops, with timers, votes, polls and reveals.',
    keywords:
      'pub quiz trivia icebreaker questions two truths and a lie would you rather people bingo games workshop mode facilitate facilitate mode facilitation facilitator session sessions run a session workshop meeting team meeting retro retrospective town hall all hands lean coffee crazy eights brainstorm board workshop board kickoff ground rules icebreaker q&a questions agenda timer countdown stopwatch vote dot vote voting poll survey pulse check reveal hide estimate planning poker quiz temperature check fist of five idea box anonymous picker random spin reactions confetti stickers emoji sticker badge collaborate category session strip blank session blank workshop editor mode switch shift+d where did the timer go where are stickers missing tools moved',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Modes and Boards',
    apps: ['livediagram'],
  },
  {
    slug: 'draw-tour',
    title: 'Watch It Built in Draw',
    description:
      "Short replays of Draw mode's dock from the Get Started button: pick a topic and watch a cursor draw, nothing saved.",
    keywords:
      'draw tour tour walkthrough onboarding intro introduction getting started guide tutorial first time learn draw mode whiteboard sketch pen pens marker markers highlighter eraser path tool shapes sticky dock settings background cursor shape recognition replay rerun settings accessibility',
    category: 'Canvas',
    categorySlug: 'canvas/draw-mode',
    parentSlug: 'draw-mode',
    apps: ['livediagram'],
  },
  {
    slug: 'workshop-tour',
    title: 'Watch It Built in Workshop',
    description:
      'Short replays of Workshop mode from the Get Started button: a cursor adds votes, stickies and reactions and runs a timer, nothing saved.',
    keywords:
      'workshop tour facilitate tour tour walkthrough onboarding intro introduction show me around getting started guide tutorial first time learn workshop mode session retro workshop timer vote poll session strip collaborate share participant replay rerun settings accessibility',
    category: 'Canvas',
    categorySlug: 'canvas/workshop-mode',
    parentSlug: 'workshop-mode',
    apps: ['livediagram'],
  },
  {
    slug: 'event-storming-boards',
    title: 'Event Storming Boards',
    description: 'A board built for the workshop: the notation, paper-like notes, one wall.',
    keywords:
      'event storming eventstorming board workshop brandolini ddd domain driven design session facilitator wall sticky notes paper big picture process modelling modeling software design pass timeline domain event command aggregate hotspot insert between gap make room slot squeeze in add in the middle reorder shuffle push right alt option modifier hold key move a note rearrange resequence capitals caps uppercase upper case all caps shouting letter case marker font typeface handwriting permanent marker sharpie lane lanes timeline grid rows columns stagger staggered snap align rhythm gap gutter spacing space between line up lined up neighbour neighbor edges next note add beside quick add neighbouring note in front on top stacking order actor hotspot photo camera wall picture ocr scan import read transcribe handwriting capture snapshot draft review accept discard add notes already here duplicate matched change kind re-kind recolour recolor wrong colour misread fix words paste drop image detect stickies zoom zoom in magnify enlarge pan scroll close up untick missed draw box pinch mouse wheel middle click middle mouse button move resize delete remove select handle corner wrong box kind colour always on a lane between lanes free placement ctrl cmd arrow keys nudge up down paste at pointer paste here copy duplicate staggered tidy line up older board settle undo',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Modes and Boards',
    parentSlug: 'templates',
    apps: ['livediagram'],
  },
  {
    slug: 'shape-libraries',
    title: 'Shape Libraries',
    description:
      "Your own named sets of reusable shapes from draw.io, placed from the palette's Library and managed on the Explorer page.",
    keywords:
      'shape library libraries my shapes custom shapes reusable stencil stencils preset presets scratchpad drawio draw.io mxlibrary uml icons notation import palette rename delete',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Assets and Imports',
    apps: ['livediagram'],
  },
  {
    slug: 'drawio-import',
    title: 'Importing draw.io files',
    description:
      'Bring draw.io diagrams across: one into the tab you are on, or many at once from Shape Libraries, each its own canvas with a tab per page, libraries too.',
    keywords:
      'drawio draw.io diagrams.net diagrams net mxfile visio vsdx lucidchart lucid import migrate migration move google drive drive save no extension json export folder files pages tabs png svg library libraries preset scratchpad confluence vs code desktop document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Assets and Imports',
    apps: ['livediagram'],
  },
  {
    slug: 'microsoft-whiteboard-import',
    title: 'Importing Microsoft Whiteboard boards',
    description:
      'Bring a Microsoft Whiteboard board into a tab from its start screen: ink with pressure, colours, notes, text, shapes and images.',
    keywords:
      'microsoft whiteboard ms whiteboard import migrate migration move retire retired retirement deleted export board boards folder zip ink pen strokes pressure sticky notes personal account keep save rescue document',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Assets and Imports',
    apps: ['livediagram'],
  },
  {
    slug: 'layers-visibility-and-locking',
    title: 'Hiding, Locking, and Dimming Layers',
    description: 'Hide, lock, dim, or solo a whole layer, and preview one on hover.',
    keywords: 'show visibility solo preview toggle eye protect',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Layers and Locking',
    parentSlug: 'layers',
    apps: ['livediagram'],
  },
  {
    slug: 'layers-organising',
    title: 'Organising and Merging Layers',
    description: 'Rename, restack, merge, clear, and move elements between layers.',
    keywords: 'organize rename reorder merge move clear manage',
    category: 'Canvas',
    categorySlug: 'canvas',
    group: 'Layers and Locking',
    parentSlug: 'layers',
    apps: ['livediagram'],
  },
  {
    slug: 'highlighter',
    title: 'Highlighter',
    description: 'Lay a wide, translucent marker stroke from the Draw category, in five colours.',
    keywords:
      'highlighter highlight marker mark up markup annotate emphasise emphasize pen draw attention translucent transparent yellow green pink blue orange colour color width thin medium bold strength quick style review workshop underline circle',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
    apps: ['livediagram'],
  },
  {
    slug: 'pages',
    title: 'Pages',
    description: 'A paper-sized surface for the prose a label cannot hold.',
    keywords:
      'page document doc paper sheet a4 prose writing write rich text brief memo report notes longform masthead heading subtitle word processor',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
    apps: ['livediagram'],
  },
  {
    slug: 'shape-recognition',
    title: 'Shape Recognition',
    description: 'Let the Shape Pen snap rough sketches into clean shapes.',
    keywords: 'shape pen pencil auto detect convert sketch clean up smart drawing snap',
    category: 'Palette',
    categorySlug: 'palette/tools/drawing',
    parentSlug: 'drawing',
    apps: ['livediagram'],
  },
  {
    slug: 'session-buttons',
    title: 'Session Buttons',
    description: 'Start a timer, a stopwatch, a dot vote or a poll for the room from the canvas.',
    keywords:
      'session button timer countdown minutes dot vote dots poll question answers answer style choices options yes no abstain rating free text start room facilitation running order agenda clock pause resume reset remove edit access view only stopwatch count up facilitator',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
    apps: ['livediagram'],
  },
  {
    slug: 'done-checks',
    title: 'Done Checks',
    description: 'Ask the room to say when they have finished, and see who you are waiting on.',
    keywords:
      'done check finished ready waiting who progress everyone mark complete im done not done clear my mark reset everyone silent writing roster room presence flash',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
    apps: ['livediagram'],
  },
  {
    slug: 'reaction-pads',
    title: 'Reaction Pads',
    description: 'A pad the room can press to throw a burst over the canvas.',
    keywords:
      'reaction pad confetti celebrate sparkles hearts applause clap fireworks emoji burst cheer thanks applause button ephemeral moment nothing saved',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
    apps: ['livediagram'],
  },
  {
    slug: 'reveal-zones',
    title: 'Reveal Zones',
    description: 'Cover part of the canvas until the room is ready to see it.',
    keywords:
      'reveal zone hide cover conceal spoiler answers estimates blackout double click double tap hide pill reveal for all hide for all not private not secure',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
    apps: ['livediagram'],
  },
  {
    slug: 'pickers',
    title: 'Pickers',
    description: 'Choose at random from the room, or from a list you write.',
    keywords:
      'picker random pick choose spinner wheel raffle draw lottery who demos next volunteer people here a list options shuffle',
    category: 'Palette',
    categorySlug: 'palette/behaviour',
    parentSlug: 'behaviour',
    apps: ['livediagram'],
  },
  // ---- Sub-articles: Collaborate ----
  {
    slug: 'comment-panels',
    title: 'Comment Panels',
    description: 'A whole comment thread, left out on the canvas.',
    keywords:
      'comment panel thread remark note reply discuss feedback annotate composer resolve reopen badge popover pinned about an element arrow export',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'action-panels',
    title: 'Action Panels',
    description: 'A list of assigned actions as a card on the canvas, ticked off from the card.',
    keywords:
      'action panel card task todo to-do assign assignee owner follow-up action item complete done reopen email teammate board',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'estimate-cards',
    title: 'Estimate Cards',
    description: 'Planning poker: everyone picks privately, one Reveal shows the lot.',
    keywords:
      'estimate estimation planning poker story points sizing fibonacci tshirt t-shirt shirt powers of two scale reveal spread unanimous clear anchor private pick withdraw',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'quizzes',
    title: 'Quizzes',
    description: 'One timed question with a right answer, revealed to the room at once.',
    keywords:
      'quiz quizzes question trivia test kahoot multiple choice answer answers correct right wrong timed timer countdown lock reveal green who got it score facilitator run again',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'temperature-checks',
    title: 'Temperature Checks',
    description: 'A fist-of-five gauge that shows the shape of the room.',
    keywords:
      'temperature check fist of five pulse mood confidence gauge sentiment 1 to 5 blocked enthusiastic average bars shape of the room never hidden',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'idea-boxes',
    title: 'Idea Boxes',
    description: 'Anonymous submissions, held until you open the box.',
    keywords:
      'idea box anonymous anonymity brainstorm brainwriting suggestion submissions count hidden open the box scatter to stickies sticky notes retro pre-mortem safety',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'qa-boards',
    title: 'Q&A Boards',
    description: 'Notes the room upvotes, with the most wanted always on top.',
    keywords:
      'q&a qa question questions ask slido upvote vote voting rank ranked queue audience ama panel town hall all hands anonymous spotlight discuss discussing discussed facilitator moderate',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'agendas',
    title: 'Agendas',
    description: 'The run of the session, with minutes against each segment.',
    keywords:
      'agenda run of show running order segments timebox minutes total schedule plan meeting workshop timer remaining struck through reorder',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'decision-records',
    title: 'Decision Records',
    description: 'What was decided, why, when, and whether it still stands.',
    keywords:
      'decision record adr architecture decision record status proposed accepted rejected superseded drivers rationale date why chose choice log',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  {
    slug: 'roll-calls',
    title: 'Roll Calls',
    description: 'Who was in the room, frozen into the canvas.',
    keywords:
      'roll call attendance register present participants who was here minutes snapshot take roll take again latecomers record document',
    category: 'Palette',
    categorySlug: 'palette/collaborate',
    parentSlug: 'collaborate',
    apps: ['livediagram'],
  },
  // ---- Sub-articles: Links ----
  {
    slug: 'link-cards',
    title: 'Link Cards',
    description: 'Bookmark a URL as a card with title, favicon, and preview.',
    keywords: 'bookmark website url card preview embed reference',
    category: 'Canvas',
    categorySlug: 'canvas/links',
    parentSlug: 'links',
    apps: ['livediagram'],
  },
  {
    slug: 'live-status',
    title: 'Live Service Status',
    description:
      "A badge on a shape that shows whether its service's status URL says up, degraded or down.",
    keywords:
      'live status service health check uptime status page statuspage up down degraded outage architecture monitoring badge url',
    category: 'Canvas',
    categorySlug: 'canvas/links',
    parentSlug: 'links',
    apps: ['livediagram'],
  },
  {
    slug: 'polls',
    title: 'Polls',
    description:
      'Ask the room a question, tally the answers live, and keep the results if you want them.',
    keywords:
      'poll polls survey question vote pulse check sentiment anonymous ephemeral rating scale yes no abstain multiple choice free text audience presenter keep results chart collaborators people',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
    apps: ['livediagram'],
  },
  {
    slug: 'vote-layers',
    title: 'Voting on One Layer',
    description: 'Restrict a vote to one layer so only its elements take dots.',
    keywords:
      'vote layer layers votable layer all layers dimmed ringed restrict scope background frame annotation ideas scaffolding',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools/voting',
    parentSlug: 'voting',
    apps: ['livediagram'],
  },
];
