// The liveplanner help catalogue: its categories and the articles only liveplanner has (docs/specs/016-help/help-centre.md).
// Articles several apps share live in ./shared/. Moved from liveplanner's own help registry; each article names the
// app it applies to.

import type { Article, Category } from '../types';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About liveplanner',
    description:
      'Get to know liveplanner: what it is, who it helps, and the ideas behind a free planning space with no trackers.',
    articleCount: 3,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from an empty plan to a shared plan in minutes, with the basics every new user needs.',
    articleCount: 5,
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description:
      'Work faster with the shortcuts, hidden features, and small habits experienced users rely on.',
    articleCount: 2,
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description:
      'Stay in control of your work: how guest access, signing in, syncing, exporting, deletion, API tokens, connecting AI tools, and email notifications work.',
    articleCount: 8,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your plans are stored, what we collect, and how to keep shared links safe.',
    articleCount: 4,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the liveplanner REST API from your own scripts or the command line: authentication, worked examples, the CLI and developer tools, errors and limits, and the OpenAPI reference.',
    articleCount: 8,
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
      'How liveplanner works on a computer, a tablet, and a phone, and what to expect on each.',
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
  // Feature-guide categories (kind: 'feature'). Rendered under "Editor Guides"
  // on the home page; each has a card-grid index at /help/<slug>/. articleCount
  // counts the feature landings in the category (each landing has its own
  // sub-guides). See liveworkspace/docs/specs/016-help/help-centre.md.
  {
    slug: 'plan',
    title: 'Plan',
    description:
      'Run the work: boards of cards, sheets with real formulas, forms that fill a board, and dashboards drawn from it all.',
    articleCount: 21,
    kind: 'feature',
    groups: ['Getting Going', 'Boards and Cards', 'Sheets', 'Forms and Dashboards'],
  },
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editor: the top corners and tab bar, quick controls, settings, themes, undo and redo, and zoom.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: one library, shared by every liveworkspace app, that keeps your plans, folders and teams easy to find and manage.',
    articleCount: 12,
    kind: 'feature',
    groups: ['Your Library', 'Activity'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a piece of work in one plan: its boards, sheets, forms and dashboards each on a tab, organised and moved between.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, live presence, teams, sharing, and session tools.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description: 'Editor helpers: zen mode, and light and dark appearance.',
    articleCount: 2,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any plan, folder, team, tab or card, and run commands.',
    articleCount: 1,
    kind: 'feature',
  },
];

export const articles: Article[] = [
  {
    slug: 'what-is-liveplanner',
    title: 'What is liveplanner?',
    description:
      'An overview of the free, real-time planner: boards, sheets, forms and dashboards in one plan.',
    keywords:
      'overview intro introduction about product planner planning boards kanban sheets forms dashboards app project',
    category: 'About liveplanner',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['liveplanner'],
  },
  {
    slug: 'why-liveplanner',
    title: 'Why Use liveplanner?',
    description: 'Free, no trackers, no sign-in wall, real-time collaboration. Here is why.',
    keywords:
      'benefits reasons comparison alternatives features advantages free privacy no trackers',
    category: 'About liveplanner',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['liveplanner'],
  },
  {
    slug: 'your-first-project',
    title: 'Your First Plan',
    description:
      'Start a plan, pick a board, sheet, form or dashboard, add your first cards, and share it.',
    keywords:
      'start begin new project first board kanban sheet form dashboard start planning template card cards tutorial walkthrough beginner quick start plan',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['liveplanner'],
  },
  {
    slug: 'sharing-your-project',
    title: 'Sharing Your Plan',
    description: 'Hand a link to anyone and edit together in real time.',
    keywords: 'share link collaborate invite send url realtime together project plan',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['liveplanner'],
  },
  {
    slug: 'working-with-projects',
    title: 'Working with Plans',
    description: 'Worked examples: list, read, create, and update plans, tabs, and folders.',
    keywords:
      'examples curl crud create update list read api requests templates boards outline view text agent project',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['liveplanner'],
  },
  {
    slug: 'edit-operations',
    title: 'Edit Operations Reference',
    description:
      'Every changeset operation and selector, whole-tab replaces, results and refusals.',
    keywords:
      'changeset edit operations ops line form json selector replace template dashboard test base revision vocabulary cli mcp agent',
    category: 'Developers',
    categorySlug: 'developers/working-with-projects',
    parentSlug: 'working-with-projects',
    apps: ['liveplanner'],
  },
  {
    slug: 'plan-sheets-images',
    title: 'Plan Items, Sheets and More',
    description:
      'API examples for Plan cards, card types, card pictures, Sheets, forms, copies and themes.',
    keywords:
      'items cards plan board card types sheets cells spreadsheet forms form link render svg copy themes api image images picture pictures upload upload_image cover image field gallery',
    category: 'Developers',
    categorySlug: 'developers/working-with-projects',
    parentSlug: 'working-with-projects',
    apps: ['liveplanner'],
  },
  {
    slug: 'project-not-loading',
    title: 'A Plan Will Not Load',
    description: 'What to check when a plan is blank or stuck loading.',
    keywords:
      'blank stuck loading error broken empty spinner wont open 404 diagram opening taking longer than usual colleague works for others project',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: ['liveplanner'],
  },
  {
    slug: 'themes',
    title: 'Themes',
    description: 'Restyle a whole tab with a theme.',
    keywords: 'color colour scheme restyle recolour recolor appearance style palette',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['liveplanner'],
  },
  {
    slug: 'planning-basics',
    title: 'Planning Basics',
    description:
      'How planning works: a plan of Board, Sheet, Dashboard and Form tabs, Start Planning, cards you move together, and Plan templates.',
    keywords:
      'planning board boards kanban scrum sprint agile retro retrospective roadmap now next later bug triage weekly planner jira trello asana linear backlog to do in progress done column columns swimlane swimlanes rows wip limit work in progress card cards ticket tickets task tasks story stories issue issues drag drop move card assign label priority estimate story points vote voting dot vote hide writing private reveal facilitator set up board settings plan card keyboard shift arrow undo templates project planner gantt daily standup bug tracker okrs key results product launch feedback board budget planner timesheet contact list task tracker spreadsheet templates hiring onboarding event planner sales crm deals help desk tickets meeting agenda personal goals study planner template categories tabs dashboard trash archive flag finder types view only phone',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Getting Going',
    apps: ['liveplanner'],
  },
  {
    slug: 'items',
    title: 'Items',
    description:
      'The tasks, bugs, notes and ideas boards show: numbered, typed, live, kept offline and in copies.',
    keywords:
      'item items ticket tickets task story bug epic note idea action risk issue record records field fields custom field status assignee owner priority label labels tag tags estimate points due date deadline checklist subtasks parent epic votes number key id #12 database store offline sync duplicate copy export drive api mcp agent automation script limit 2000',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'boards',
    title: 'Boards',
    description:
      'Plan boards: pick one, set up its columns, swimlanes and widgets, collapse columns, save filters, and what cards it takes.',
    keywords:
      'board boards plan board kanban sprint retro roadmap bug triage week weekly all cards archive blank column columns swimlane swimlanes rows wip limit width done counts as done widget widgets completion filter people points priorities unassigned top voted stale card size minimal compact detailed new cards card types move handle grip start with a board reveal hide writing votes left vote budget planner csv import csv download csv spreadsheet export cards collapse column collapsed fold hide column expand saved filter saved filters save filter saved view bookmark filter chips add filter field filter',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'configure-board',
    title: 'Configure a Board',
    description:
      'Pick a suggested layout for a Board tab, then fine-tune its columns, swimlanes, sorting and cards.',
    keywords:
      'configure board board button cog set up setup layout layouts preset presets suggested for this board fine tune swimlanes sort cards supported cards card layout card size simple columns compact overview by person most urgent first deadlines first by card type by priority by label quick wins first biggest first starting soon newest first recently changed create form style bottom right',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'cards',
    title: 'Cards',
    description:
      'Plan cards: add, open and fill one in, attachments, child cards, comments, flags, hand one to an AI assistant, find any card, and archive or trash it.',
    keywords:
      'card cards ticket tickets plan card add card open card panel modal details tab tabs description rich text bullet list numbered list labels checklist steps parent open parent assignee team members comments comment thread resolve mention trash restore empty trash archive duplicate card size flag flagged child breadcrumb trail find search finder not on a board maximise maximize full screen expand card attachment attachments attach file upload picture image photo screenshot cover image reaction emoji comment and resolve repeat ai assistant agent claude hand off hand back delegate',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'card-types',
    title: 'Card Types',
    description:
      'Your own kinds of card on Plan boards: name, colour, glyph, custom fields and types built on a base type.',
    keywords:
      'card type types item type types custom type kind kinds category ticket type issue type template fields custom field fields property properties attribute column choice dropdown select option options checkbox tick link url number date text long text show on card colour color glyph icon reorder delete restore built-in tabs details new cards can be limits percent progress bar duration hours minutes estimate time tracking track time timer time spent add time calculated calculation formula formulas rollup roll up lookup look up sum average child count children done currency money email rating stars multiple choice person image attachments cover image inherit inherits inherited inheritance base type parent type subtype extend detach blocked by blocks dependency',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'card-templates',
    title: 'Card Templates',
    description:
      'Start a card already filled in from a template on its card type: from Add card, a chip or New.',
    keywords:
      'card template templates task template issue template preset prefill pre-fill prefilled starting values boilerplate default values bug report checklist release onboarding reuse repeat new card from template add card chip',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'select-cards',
    title: 'Select Several Cards',
    description:
      'Select cards on a board and move, assign, label, flag or trash them together, or drag them as a group.',
    keywords:
      'select multiple multi select multiselect several cards many cards bulk edit batch edit bulk move bulk assign selection bar cmd click ctrl click shift click range select mode group drag drag several move many change priority labels set field archive trash',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'card-activity',
    title: 'Card Activity',
    description:
      'The Activity tab on every card: who made it, moved it and changed it, and when, agents and undos marked.',
    keywords:
      'activity history card history log audit trail changes changelog who moved who changed what changed timeline tab moved edited created by ai transitioned by ai agent undo version',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'automations',
    title: 'Automations',
    description:
      'Rules that act on your cards for you: when something happens to a card, check it and move, assign, label, comment or email.',
    keywords:
      'automation automations rules rule trigger triggers conditions actions workflow workflows jira automation auto assign auto move when then if else run rule run log audit trail history smart values placeholders email on done stamp date triage form response',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'describe-a-plan',
    title: 'Describe a Plan',
    description:
      'Say how your work runs and AI drafts a board’s columns, card types and starter rules, for you to check and change before Make Plan.',
    keywords:
      'describe a plan ai artificial intelligence generate generator draft custom my own words build plan make plan board columns stages card types fields prompt write describe workflow pipeline process set up start planning check your plan sign in starter rules automations rule',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Getting Going',
    apps: ['liveplanner'],
  },
  {
    slug: 'connect-github',
    title: 'Connect GitHub',
    description:
      'Pull request states on cards, and rules that move a card when its pull request opens, merges, closes or its checks finish.',
    keywords:
      'github git pull request pull requests pr prs merge merged checks ci build failing passing repository repositories repo install app connect disconnect integration code review in review done on merge mention',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'calendar-feed',
    title: 'Subscribe to Calendar',
    description:
      'A private link that puts a plan’s card dates in Google Calendar, Outlook or Apple Calendar, kept up to date.',
    keywords:
      'calendar feed subscribe ics ical icalendar webcal google calendar outlook apple calendar sync export dates due date start date deadlines events link private reset link turn off my cards done cards',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'public-roadmap',
    title: 'Publish as Roadmap',
    description:
      'Publish a board as a public roadmap anyone can open: chosen columns and fields, upvotes and suggestions.',
    keywords:
      'public roadmap publish roadmap portal feedback board feature requests ideas vote votes upvote voting customers changelog suggest an idea suggestions unpublish share public link',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'email-to-board',
    title: 'Email to Board',
    description:
      'Give a board its own secret email address: forwarded mail becomes a card, pictures and PDFs attached.',
    keywords:
      'email to board email in inbound email forward mail address intake inbox send email create card from email mail to board who can send plan members anyone new address turn off spam dmarc dkim spf attachments pictures from email trello asana linear',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Boards and Cards',
    apps: ['liveplanner'],
  },
  {
    slug: 'plan-tour',
    title: 'The Plan Tour',
    description:
      'A guided walkthrough of your own board or sheet, offered once and replayable from Settings.',
    keywords:
      'plan tour tour walkthrough onboarding intro introduction show me around getting started guide tutorial example board example cards example sheet first time learn kanban board cards spreadsheet spreadsheets sheet sheets formulas replay rerun settings accessibility get started button',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Getting Going',
    apps: ['liveplanner'],
  },
  {
    slug: 'forms',
    title: 'Forms',
    description:
      'A form anyone can fill in from a link, each response a card on your board: questions, where answers go, publishing and closing.',
    keywords:
      'form forms survey surveys questionnaire google forms typeform intake submission submissions responses response respondents rsvp feedback bug report contact job application public link share link publish questions question answers mapping fields card type board column close limit report anonymous',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Forms and Dashboards',
    apps: ['liveplanner'],
  },
  {
    slug: 'dashboards',
    title: 'Dashboards',
    description:
      'A Plan tab of rows and slots: boards, sheets, metrics, charts and notes side by side, live, arranged by dragging.',
    keywords:
      'dashboard dashboards overview report summary page layout rows row slots slot grid tiles widgets metrics metric kpi kpis chart charts board boards sheet sheets tabs at a glance status home portal add to slot settings cog background tint clear dashboard start over sheet chart change chart sheet figure column summary trend move swap resize arrange drag rearrange utilities utility note title status on track at risk off track checklist key date countdown links',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Forms and Dashboards',
    apps: ['liveplanner'],
  },
  {
    slug: 'sheets',
    title: 'Sheets',
    description:
      'A spreadsheet tab: setup and templates, cells, formulas, formatting, dropdowns, checkboxes, conditional formatting, sort, filter, find, charts, card tables and CSV.',
    keywords:
      'sheet sheets spreadsheet spreadsheets excel google sheets workbook table grid cell cells row rows column columns formula formulas function functions sum average reference references a1 range ranges number format currency percent date bold italic border borders merge merged freeze frozen sort sorting filter filtering find replace csv tsv import export download upload paste copy fill handle series autofill maximise maximize full screen restore spill setup chart charts bar line pie card table cards linked save focus fill tab templates template budget invoice expense report expenses loan calculator mortgage sales pipeline inventory stock guest list rsvp grade book habit tracker timesheet contacts tracker cell size compact roomy dropdown drop down select picklist pick list list chip chips checkbox check box tick box tickbox validation data validation rule rules conditional formatting conditional format highlight colour scale color scale heat map paint format format painter custom number format format code link to sheet linked chart other apps livedocuments livediagram livedesign report live figures',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Sheets',
    apps: ['liveplanner'],
  },
  {
    slug: 'sheet-functions',
    title: 'Sheet Functions',
    description: 'Every function a Sheet formula can use, with its arguments and an example.',
    keywords:
      'sheet functions function list formulas formula reference spreadsheet functions excel functions sum average count countif sumif vlookup xlookup index match if iferror concat text date today now round filter sort unique sequence pmt npv cardcount cardsum cards plan cards errors div/0 n/a name ref value spill',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Sheets',
    apps: ['liveplanner'],
  },
  {
    slug: 'visualisations',
    title: 'Charts of Your Cards',
    description: 'Visualisation tabs: a Gantt chart, calendars and more, live from every card.',
    keywords:
      'visualisation visualisations visualization chart charts graph gantt gantt chart timeline roadmap due calendar start calendar calendar cards by field workload priority by status priority matrix card search filter filters swimlanes swimlane lanes row order reorder drag to reorder sort by date chart settings cog card types group by statuses maximise maximize view restore view dashboard slot status breakdown dependency dependencies blocked by blocker clash clashes conflict amber warning move following cards move cards leave them schedule slip',
    category: 'Plan',
    categorySlug: 'plan',
    group: 'Forms and Dashboards',
    apps: ['liveplanner'],
  },
  {
    slug: 'undo',
    title: 'Undo',
    description: 'Step back your most recent change, with a keyboard shortcut and a button.',
    keywords: 'ctrl z cmd z revert back mistake reverse cancel history 500 steps collaborator',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['liveplanner'],
  },
  {
    slug: 'redo',
    title: 'Redo',
    description: 'Re-apply a change you just undid.',
    keywords: 'ctrl y cmd shift z repeat restore forward again history',
    category: 'User Interface',
    categorySlug: 'user-interface',
    apps: ['liveplanner'],
  },
  {
    slug: 'changing-theme',
    title: 'Changing the Theme',
    description: 'Open the Tab Style dialog from Style and pick a look or a theme.',
    keywords:
      'apply browse switch restyle colours colors dialog pick paintbrush look feel looks finish filter flexible professional sketch marker spectrum mashup random surprise shuffle dice stand-up quarterly workshop terracotta allotment crown jewels gallery quayside regatta gelato sweet shop northern lights night shift flipchart greenboard field notes aurora office earth gemstone harbour sorbet nightfall column colours seasonal holiday christmas halloween easter new year snowflakes',
    category: 'User Interface',
    categorySlug: 'user-interface/themes',
    parentSlug: 'themes',
    apps: ['liveplanner'],
  },
  {
    slug: 'team-shared-projects',
    title: 'Team Shared Plans',
    description: 'A per-team folder tree every member can manage.',
    keywords: 'shared library folder team files workspace common diagrams project',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
    apps: ['liveplanner'],
  },
  {
    slug: 'search-projects',
    title: 'Finding Plans',
    description: 'Search your plans by name, and where to search folders and shared items.',
    keywords: 'find lookup locate files library open plans shared team every app project',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
    apps: ['liveplanner'],
  },
];
