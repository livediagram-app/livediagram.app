// Single source of truth for the comparison / "alternative" pages
// (see docs/specs/019-marketing/comparison-pages.md). The dynamic route, its metadata,
// the index page, and the sitemap all derive from this list, so adding
// a competitor is a one-place change.
//
// Honesty rules (docs/specs/019-marketing/comparison-pages.md): every liveplanner claim maps to a shipped
// feature; every competitor gets a real "where they're the better pick"
// section; competitor facts are qualitative (positioning, not volatile
// pricing/numbers); a competitor is compared at its own job (boards,
// task tracking, databases, spreadsheets), never on features it lacks
// by design. The deep-dive `sections`
// and `faqs` follow the same rules: honest answers, including partial
// ones ("no direct importer, but...").

// Last-revised date for the comparison set, shared by `app/sitemap.ts`
// (drives `lastModified` for /alternatives + /alternatives/<slug>) and
// by the alternatives pages' `pageMetadata({ modifiedTime })`
// (drives `article:modified_time` OG meta). Co-located with the
// ALTERNATIVES array so revising a competitor row + bumping the date
// lands in one diff. Bump this when adding a competitor or revising
// any row / claim / lede.
export const ALTERNATIVES_LAST_UPDATED = new Date('2026-10-21');

type ComparisonRow = {
  label: string;
  // Short, factual cell text. `us` = liveplanner, `them` = competitor.
  us: string;
  them: string;
};

type DeepDiveSection = {
  // On-page h2 for the section.
  heading: string;
  // One to three prose paragraphs expanding on a key value theme for
  // this comparison. Rendered as plain <p> elements.
  paragraphs: string[];
};

type Faq = {
  q: string;
  // Plain string (no JSX) so the same text feeds the on-page answer
  // and the FAQPage JSON-LD verbatim.
  a: string;
};

export type Alternative = {
  slug: string;
  // Competitor display name + how we refer to it in prose.
  name: string;
  // SEO. Title targets the "<tool> alternative" query; description is
  // the meta + social description.
  title: string;
  description: string;
  // On-page hero.
  h1: string;
  lede: string;
  // Comparison table rows (liveplanner vs competitor).
  rows: ComparisonRow[];
  // Fairness section: genuine reasons to pick the competitor.
  themBest: string[];
  // Shipped liveplanner differentiators for this comparison.
  usBest: string[];
  // Deep-dive prose: competitor-specific sections expanding the key
  // value themes (collaboration model, open-source story, structure,
  // interop). This is where the page earns its depth.
  sections: DeepDiveSection[];
  // Competitor-specific questions, rendered on-page and emitted as
  // FAQPage JSON-LD (docs/specs/019-marketing/comparison-pages.md "Metadata").
  faqs: Faq[];
};

// Facts liveplanner states on more than one page, kept in one place so every comparison says them
// the same way.
const GUEST_START =
  'Anyone can create a project without signing up: a guest’s new project is kept in their browser until they press Share, which syncs it in one step.';
const SHARE_LINKS =
  'A share link is an Editor, Participant or view-only link (a Participant can work on cards and cells, comment and vote without changing how the project is set up), and it can carry a password or an expiry date.';
const AGENTS =
  'An MCP server, a REST API with personal tokens and a command-line tool let scripts and AI agents read the plan and add, edit and move cards, sheets and forms, with their changes shown live.';
const OPEN =
  'liveplanner is MIT-licensed and its whole codebase is public. The hosted version is free with no paid tier, and you can deploy the same code to your own Cloudflare account.';
const CSV_IN =
  'A board imports a CSV or TSV file: each row becomes a card, landing in the column its Status names and with the person its Assignee names. Only a title is required, and one undo takes the whole import back.';

export const ALTERNATIVES: Alternative[] = [
  {
    slug: 'trello',
    name: 'Trello',
    title: 'Trello alternative · liveplanner',
    description:
      'A free, open-source Trello alternative: kanban boards with WIP limits, your own card types, Sheets, Dashboards and Forms, with no sign-up to start.',
    h1: 'The open-source Trello alternative',
    lede: 'Trello made the kanban board familiar to everyone: lists, cards, drag and drop. liveplanner keeps that simplicity and puts more beside it in one project: Sheets with real formulas, Dashboards of live slots and Forms whose answers arrive as cards, all free, open source and ready without an account.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free plan, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create a board',
      },
      { label: 'Kanban boards', us: 'Yes, with WIP limits and swimlanes', them: 'Yes, its core' },
      {
        label: 'Custom fields',
        us: 'Card types with fields of your own',
        them: 'Custom fields on cards',
      },
      {
        label: 'Beyond the board',
        us: 'Sheets, Dashboards, Forms and Gantt and calendar charts in the same project',
        them: 'Further views and Power-Ups for integrations',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'You want the most widely known kanban board, with polished mobile apps your team already uses.',
      'Your work leans on Power-Ups and integrations from Trello’s large ecosystem.',
      'Your organisation already runs on Atlassian, and Trello fits beside Jira and Confluence.',
    ],
    usBest: [
      'Boards with WIP limits: a column’s count turns amber the moment it goes over, and swimlanes split the board by assignee, type, priority or any field.',
      'One card, every board: the same card can sit on the sprint board and the roadmap, and moving it on one moves it on both.',
      'Card types of your own, with text, number, date, choice and linked-card fields, beside five built-in types.',
      'A Sheet tab with over 150 functions next to the board, reading its cards or listing them as rows that stay linked both ways.',
      'Forms on a public link: each answer becomes a card on the board, ready to move along, and no account is needed to answer.',
      'Dashboards that bring boards, sheets, charts and notes onto one page, all live.',
      'Free and MIT-licensed, with no sign-up to start.',
    ],
    sections: [
      {
        heading: 'The board you know, with room to grow',
        paragraphs: [
          'A liveplanner board works the way a Trello board does: columns of cards you drag along as the work moves. Open a card for its description, checklist, assignee, dates and comments, and @mention a teammate to send them an email that opens it. Then the board goes a little further: WIP limits on columns, swimlanes by any field, header widgets such as Due Soon and Stale Cards that narrow the board to just those cards, and hidden writing with a reveal for retros.',
          'Cards are items rather than copies, so one card can appear on several boards at once. A team board and a personal board can show the same work without anyone keeping two lists in step.',
        ],
      },
      {
        heading: 'Everything for the plan, in one project',
        paragraphs: [
          'A project holds as many tabs as you need. Beside a Board tab you can add a Sheet tab for the budget, a Form tab that collects requests, and a Dashboard tab that shows the board, the sheet and a Gantt chart of the cards on one page. Everything reads from the same cards, so nothing has to be copied across or kept in sync by hand.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [`${GUEST_START} ${SHARE_LINKS}`, OPEN, `Coming from Trello? ${CSV_IN}`],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner a free alternative to Trello?',
        a: 'Yes. Every feature is free for everyone, with no paid tier, and the code is MIT-licensed, so you can also run your own copy.',
      },
      {
        q: 'Can I move my Trello boards across?',
        a: 'There is no direct Trello importer. A board imports a CSV or TSV file, though: each row becomes a card in the column its Status names, with the person its Assignee names. If you can get your cards out of Trello as a spreadsheet, a title column is all the import needs.',
      },
      {
        q: 'Does liveplanner have Power-Ups or automations?',
        a: 'Not in the way Trello does. liveplanner has no marketplace of add-ons. Instead, a REST API, an MCP server and a command-line tool let your own scripts and AI agents read and change the cards.',
      },
      {
        q: 'Do my teammates need an account?',
        a: 'No. Share a link and anyone who opens it works on the board with you, live, without signing up. Signing in is optional and adds teams with shared folders.',
      },
    ],
  },
  {
    slug: 'asana',
    name: 'Asana',
    title: 'Asana alternative · liveplanner',
    description:
      'A free, open-source Asana alternative: boards of cards, Gantt and calendar charts, Sheets, Dashboards and Forms, with no seats and no sign-up to start.',
    h1: 'A free, open-source Asana alternative',
    lede: 'Asana is a mature work-management platform, built for organisations coordinating many teams and goals. liveplanner is a lighter, open-source place to plan: boards of cards, live charts of them, sheets, dashboards and forms in one project, free for everyone and ready without an account.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free plan, then paid plans per seat' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create a project',
      },
      {
        label: 'Views of the work',
        us: 'Boards, Gantt chart, due and start calendars, charts by field',
        them: 'List, board, timeline and calendar views',
      },
      {
        label: 'Spreadsheets',
        us: 'Sheet tabs with over 150 functions',
        them: 'Not a spreadsheet tool',
      },
      {
        label: 'Forms',
        us: 'Public forms whose answers become cards or rows',
        them: 'Forms that create tasks',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'You need portfolio and goal tracking across many teams, with workload and reporting built for managers.',
      'You rely on rules, approvals and a large catalogue of integrations to route work automatically.',
      'Your organisation wants enterprise administration, security controls and support from one vendor.',
    ],
    usBest: [
      'No seats and no paid tier: everyone gets every feature, and nobody needs an account to start.',
      'A Gantt chart, due and start calendars and charts by field, all drawn live from the cards, with bars you drag to change dates.',
      'Card types of your own with the fields your team tracks, from text and numbers to a link to another card.',
      'Sheet tabs beside the board, with formulas that read the cards or list them as rows linked both ways.',
      'Dashboards of live slots: a board you can work on, a sheet you can edit, a chart, a figure like Completion, or a note.',
      'Forms on a public link, each answer landing as a card or a row the moment it is sent.',
      AGENTS,
    ],
    sections: [
      {
        heading: 'Planning without the overhead',
        paragraphs: [
          'Asana is at its best when a whole organisation plans in it, with portfolios, goals and workload views tying teams together. Many teams need less: a board of the work, dates on the cards, a chart of what runs when, and a place to share it. liveplanner aims at that. A project opens in a click, every tab is live for everyone, and there is nothing to configure before you can start.',
        ],
      },
      {
        heading: 'Charts that are never out of date',
        paragraphs: [
          'Every chart in liveplanner is drawn from the cards themselves. The Gantt chart draws a bar from each card’s start to its due date, filled to the share of its child cards that are done; drag an end to change the date. The calendars list what is due or starting each day, and Cards by Field breaks the work down by person, priority or any field of your own. Put any of them in a Dashboard slot beside the board and the sheet, and the page stays current as the cards move.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [`${GUEST_START} ${SHARE_LINKS}`, OPEN],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner a free alternative to Asana?',
        a: 'Yes. There are no seats, plans or paid tiers: every feature is free for everyone, and the code is MIT-licensed.',
      },
      {
        q: 'Can I import my Asana projects?',
        a: 'There is no direct Asana importer. Asana can export a project as a CSV file, and a liveplanner board imports CSV: each row becomes a card in the column its Status names, with the person its Assignee names.',
      },
      {
        q: 'Does liveplanner have portfolios and goals?',
        a: 'Not as Asana does. You can plan objectives with the OKRs template and see several boards’ work on one Dashboard, but there is no portfolio layer across many projects. If that is central to how you work, Asana is the better fit.',
      },
      {
        q: 'Can AI tools work with my plan?',
        a: 'Yes. An MCP server, a REST API and a command-line tool let AI agents and scripts read your boards, sheets and forms and add, edit and move cards, naming columns and fields as the board shows them.',
      },
    ],
  },
  {
    slug: 'monday',
    name: 'Monday.com',
    title: 'Monday.com alternative · liveplanner',
    description:
      'A free, open-source Monday.com alternative: boards with your own card types and fields, Sheets, Dashboards and Forms, with no seats to buy.',
    h1: 'A free, open-source Monday.com alternative',
    lede: 'Monday.com is a flexible, colourful work platform with boards of items, many column types and a deep set of automations. liveplanner covers the everyday core of that, boards with fields of your own, dashboards and forms, in free, open-source software you can start without an account.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Paid plans per seat, with a free plan' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create a board',
      },
      {
        label: 'Custom fields',
        us: 'Card types with text, number, date, choice and linked-card fields',
        them: 'Many column types on each board',
      },
      {
        label: 'Dashboards',
        us: 'Dashboard tabs of live boards, sheets, charts and notes',
        them: 'Dashboards of widgets across boards',
      },
      {
        label: 'Automation',
        us: 'API, MCP and CLI for scripts and AI agents',
        them: 'Built-in automation recipes and integrations',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'You want built-in automation recipes and a broad marketplace of integrations, set up without code.',
      'Your teams run CRM, service or development work on purpose-built products from the same vendor.',
      'You need enterprise permissions, audit and administration at scale.',
    ],
    usBest: [
      'Free for every person and every feature, with no seats to count as the team grows.',
      'Card types with fields of your own, and one card that can sit on several boards at once.',
      'Dashboards whose slots are live: work on the board, edit the sheet, and watch the chart redraw, all on one page.',
      'Sheet tabs with over 150 functions, conditional formatting, dropdowns and charts from any cells.',
      'Forms on a public link, with sections, a closing date or a response limit, and each answer landing as a card or a row.',
      'No account needed to start, and share links at three levels for the people you work with.',
    ],
    sections: [
      {
        heading: 'Boards, fields and dashboards, without seats',
        paragraphs: [
          'Monday.com charges by seat, so adding a person to the work is a purchasing decision. In liveplanner it is a link. Every feature is free for everyone, and a guest can open a shared project and work on it with you straight away.',
          'The building blocks will feel familiar: boards of cards, card types that carry the fields your team tracks, swimlanes by any field, header widgets that count what is due or stale, and Dashboard tabs that lay boards, sheets and charts out in rows of slots, each one live.',
        ],
      },
      {
        heading: 'Where Monday.com goes further',
        paragraphs: [
          'Monday.com has invested heavily in no-code automation and integrations, and in products built for particular teams. liveplanner does not have automation recipes. What it has instead is an open interface: a REST API, an MCP server and a command-line tool, so a script or an AI agent can do the routine moving and tidying for you.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [OPEN, CSV_IN],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner a free alternative to Monday.com?',
        a: 'Yes. Every feature is free for everyone, with no seats or plans, and the code is MIT-licensed so you can run your own copy.',
      },
      {
        q: 'Can I bring my Monday.com boards across?',
        a: 'There is no direct importer. If you export a board’s items to a spreadsheet and save it as CSV, a liveplanner board imports it: each row becomes a card, in the column its Status names.',
      },
      {
        q: 'Does liveplanner have automations?',
        a: 'Not built-in recipes. A REST API, an MCP server and a command-line tool let your own scripts and AI agents change cards, sheets and forms, with their edits shown live to everyone.',
      },
      {
        q: 'Do guests need an account?',
        a: 'No. Anyone with a share link can open the project and, if the link allows it, work on it with you live, without signing up.',
      },
    ],
  },
  {
    slug: 'notion',
    name: 'Notion',
    title: 'Notion alternative for boards and planning · liveplanner',
    description:
      'A free, open-source alternative to Notion’s boards and databases: kanban boards, Sheets with formulas, Dashboards and Forms that fill your board.',
    h1: 'An open-source alternative to Notion for planning',
    lede: 'Notion is a flexible workspace of pages and databases, loved for wikis, notes and docs, and its databases can be shown as boards, tables and timelines. liveplanner focuses on the planning side: boards of cards, real spreadsheets, dashboards and forms, live for everyone, free and open source.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free plan, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create pages',
      },
      {
        label: 'Boards',
        us: 'Board tabs with WIP limits, swimlanes and header widgets',
        them: 'Board views of a database',
      },
      {
        label: 'Spreadsheets',
        us: 'Sheet tabs with over 150 functions and charts',
        them: 'Database tables with formula properties',
      },
      {
        label: 'Docs and wikis',
        us: 'Rich-text card descriptions and notes on dashboards',
        them: 'Its core strength',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'You want one home for docs, wikis and notes as well as plans, with databases woven through the pages.',
      'Your team writes a lot, and long-form pages matter more than boards and sheets.',
      'You rely on Notion’s templates, integrations and AI features inside the workspace.',
    ],
    usBest: [
      'Boards built for moving work: WIP limits, swimlanes, Due Soon and Stale Cards widgets, and hidden writing with a reveal for retros.',
      'A real spreadsheet on its own tab, with cell references, over 150 functions, conditional formatting and charts over the cells.',
      'Gantt and calendar charts you can drag cards across, drawn live from the cards.',
      'Forms on a public link whose answers land as cards on a board or rows in a sheet.',
      'Real-time editing with live cursors and each person’s selection in their colour, cell by cell in a Sheet.',
      'Free and MIT-licensed, with no sign-up to start.',
    ],
    sections: [
      {
        heading: 'A planner rather than a workspace',
        paragraphs: [
          'Notion’s strength is breadth: pages, docs and databases in one flexible tree. liveplanner is narrower on purpose. A project is a set of tabs for the plan itself, Board, Sheet, Dashboard and Form tabs, and each one is built for its job. A board has WIP limits and swimlanes; a sheet is a real spreadsheet with A1 references and fill-down; a dashboard lays live slots out in rows; a form collects answers from anyone with the link.',
        ],
      },
      {
        heading: 'Spreadsheets that are spreadsheets',
        paragraphs: [
          'A Notion database table gives each row properties and lets a formula work within a row. A liveplanner Sheet is a grid of cells: write =SUM(B2:D2), fill it down, name a cell TaxRate and use it anywhere, and chart a range as bars, lines or a pie. Copy and paste works with Google Sheets and Excel, and CSV files come in and go out. A sheet can also list the board’s cards as rows that stay linked both ways.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [`${GUEST_START} ${SHARE_LINKS}`, OPEN],
      },
    ],
    faqs: [
      {
        q: 'Can liveplanner replace Notion?',
        a: 'For planning, often yes: boards, sheets, dashboards and forms are what liveplanner is built for. For docs, wikis and notes, no: Notion is the better tool there, and many teams will use both.',
      },
      {
        q: 'Can I import a Notion database?',
        a: 'There is no direct importer, but Notion can export a database as CSV. A liveplanner board imports CSV, each row becoming a card, and a Sheet takes CSV too.',
      },
      {
        q: 'Can I embed a liveplanner board in Notion?',
        a: 'Yes. The Share dialog gives you an iframe to embed the project in Notion, a wiki or any page that allows iframes, live as people edit it.',
      },
      {
        q: 'Is it free?',
        a: 'Yes. Every feature is free for everyone, there is no paid tier, and the code is MIT-licensed.',
      },
    ],
  },
  {
    slug: 'jira',
    name: 'Jira',
    title: 'Jira alternative for lighter planning · liveplanner',
    description:
      'A free, open-source alternative to Jira for lighter planning: kanban boards, bug triage and your own card types, ready without an account.',
    h1: 'A lighter, open-source alternative to Jira',
    lede: 'Jira is the established issue tracker for software teams, with sprints, backlogs, workflows and deep links into development tools. liveplanner is a lighter place to plan: kanban boards with WIP limits, a bug triage template and your own card types, alongside sheets, dashboards and forms, free and ready without an account.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free for small teams, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An Atlassian account and a site',
      },
      {
        label: 'Boards',
        us: 'Kanban boards with WIP limits and swimlanes',
        them: 'Scrum and kanban boards with sprints and backlogs',
      },
      {
        label: 'Workflows',
        us: 'Columns you name, and card types with your own fields',
        them: 'Configurable workflows, issue types and permissions',
      },
      {
        label: 'Developer integrations',
        us: 'REST API, MCP server and CLI',
        them: 'Deep links to code, builds and deployments',
      },
      {
        label: 'Self-hostable',
        us: 'Yes, on your own Cloudflare account',
        them: 'Data Center editions',
      },
    ],
    themBest: [
      'You run scrum with sprints, backlogs, story points and velocity reporting.',
      'You need configurable workflows with transitions, permissions and audit across many projects.',
      'You want issues linked to branches, pull requests, builds and deployments in your development tools.',
    ],
    usBest: [
      'Open a board in a click, with nothing to configure and no account needed.',
      'A Bug Triage template and a Bug Report form: reports from anyone with the link arrive as cards, ready to triage.',
      'Card types such as Bug or Task with the fields your team tracks, and a Cards list that filters by any of them.',
      'Boards, sheets, dashboards and forms in one project, so the plan, the numbers and the intake sit together.',
      AGENTS,
      'Free and MIT-licensed, with no seats.',
    ],
    sections: [
      {
        heading: 'When Jira is more than you need',
        paragraphs: [
          'Jira is built to model how a software organisation works, and that power comes with set-up: projects, schemes, workflows and permissions. A small team, a side project or a non-software team often wants a board it can start using today. liveplanner opens a project in a click, and a Bug Triage, Kanban or Task Tracker template sets the board up with columns and card types ready to fill.',
        ],
      },
      {
        heading: 'Intake that lands on the board',
        paragraphs: [
          'Share a Bug Report or Feature Request form on a public link, and each answer becomes a card on the board with its answers in the card’s fields. Nobody needs an account to answer, the form shows them nothing else of yours, and you can close it, set a closing date or cap the number of responses. New answers show on the form, in your Inbox and, at most every 15 minutes, by email.',
        ],
      },
      {
        heading: 'Free, open, and scriptable',
        paragraphs: [OPEN, AGENTS],
      },
    ],
    faqs: [
      {
        q: 'Does liveplanner support sprints?',
        a: 'Not as a feature of its own: there are no sprint objects, story points or velocity charts. You can run a sprint as a board, with dates on the cards and a Gantt chart of them, but if scrum reporting matters to you, Jira is the better fit.',
      },
      {
        q: 'Can I import my Jira issues?',
        a: 'There is no direct Jira importer. Jira can export issues as CSV, and a liveplanner board imports CSV: each row becomes a card in the column its Status names, with the person its Assignee names.',
      },
      {
        q: 'Does liveplanner link to GitHub or my CI?',
        a: 'Not with built-in integrations. The REST API, MCP server and command-line tool let your own scripts and AI agents create and move cards, so you can connect the tools you use.',
      },
      {
        q: 'Is it free?',
        a: 'Yes. Every feature is free for everyone, with no seats or paid tier, and the code is MIT-licensed.',
      },
    ],
  },
  {
    slug: 'clickup',
    name: 'ClickUp',
    title: 'ClickUp alternative · liveplanner',
    description:
      'A free, open-source ClickUp alternative: a simpler planner of boards, Sheets, Dashboards and Forms, with no seats and no sign-up to start.',
    h1: 'A simpler, open-source ClickUp alternative',
    lede: 'ClickUp aims to be an everything app for work, with tasks, docs, goals, chat and a long list of views and settings. liveplanner is deliberately smaller: boards of cards, sheets, dashboards and forms in one project, each built well for its job, free for everyone and ready without an account.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free plan, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account and a workspace',
      },
      {
        label: 'Scope',
        us: 'Boards, Sheets, Dashboards and Forms',
        them: 'Tasks, docs, goals, chat and many views',
      },
      {
        label: 'Custom fields',
        us: 'Card types with fields of your own',
        them: 'Custom fields and task types',
      },
      { label: 'Real-time multiplayer', us: 'Yes, live cursors on every tab', them: 'Yes' },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'You want tasks, docs, goals, time tracking and chat in one product, and are happy to configure it.',
      'You need a very wide choice of views and settings for every team’s way of working.',
      'You rely on built-in automations and integrations.',
    ],
    usBest: [
      'Fewer things, each done carefully: a board, a sheet, a dashboard and a form, with little to set up.',
      'Edits land live for everyone, with live cursors on boards and each person’s selection outlined in a Sheet.',
      'Card types with fields of your own, and one card on as many boards as need it.',
      'A Gantt chart and due and start calendars you can drag cards across.',
      'Forms whose answers arrive as cards or rows, with no account needed to answer.',
      'Free and MIT-licensed, with no sign-up to start.',
    ],
    sections: [
      {
        heading: 'Less to learn',
        paragraphs: [
          'ClickUp’s range is its appeal: whatever a team does, there is probably a view or a setting for it. The cost is set-up and a lot to learn. liveplanner starts from a template or a blank tab, and each tab does one job: a Board tab for the work, a Sheet tab for the numbers, a Dashboard tab to see it all, and a Form tab to collect what comes in.',
        ],
      },
      {
        heading: 'Live for everyone',
        paragraphs: [
          'Everything in a project is shared in real time. Teammates’ cursors move across the board, a card moved by one person moves for everyone, and two people typing in different cells of a Sheet never overwrite each other. Comments live on cards and on single cells, @mentions send an email that opens the right place, and the Inbox gathers what is still waiting on you.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [`${GUEST_START} ${SHARE_LINKS}`, OPEN],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner a free alternative to ClickUp?',
        a: 'Yes. Every feature is free for everyone, with no paid tier, and the code is MIT-licensed.',
      },
      {
        q: 'Does liveplanner have docs, goals and time tracking?',
        a: 'Not as separate features. Cards hold rich-text descriptions and checklists, the OKRs template plans objectives on a board, and the Timesheet template is a Sheet for hours. If you need those as full products, ClickUp covers more.',
      },
      {
        q: 'Can I import from ClickUp?',
        a: 'There is no direct importer. A CSV export of your tasks imports onto a liveplanner board, each row becoming a card in the column its Status names.',
      },
      {
        q: 'Do my collaborators need accounts?',
        a: 'No. Share an Editor, Participant or view-only link and anyone who opens it joins you live, without signing up.',
      },
    ],
  },
  {
    slug: 'airtable',
    name: 'Airtable',
    title: 'Airtable alternative · liveplanner',
    description:
      'A free, open-source Airtable alternative: Sheets with real formulas, boards of cards linked to rows, Dashboards and Forms, no sign-up to start.',
    h1: 'A free, open-source Airtable alternative',
    lede: 'Airtable blends a spreadsheet with a database: typed fields, linked records and many views of the same base. liveplanner comes at the same work from a planner’s side, with boards of cards, real spreadsheets that can list those cards as rows, dashboards and forms, free and open source.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free plan, then paid plans per seat' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create a base',
      },
      {
        label: 'Data model',
        us: 'Cards with typed fields, and spreadsheet cells',
        them: 'A relational database of tables and linked records',
      },
      {
        label: 'Formulas',
        us: 'Over 150 spreadsheet functions with A1 references',
        them: 'Formula fields computed per record',
      },
      {
        label: 'Forms',
        us: 'Public forms whose answers become cards or rows',
        them: 'Form views that add records',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'Your work is a true relational database, with many linked tables and lookups between them.',
      'You build apps and interfaces on top of your data for other teams to use.',
      'You rely on built-in automations, scripting and a broad set of integrations.',
    ],
    usBest: [
      'A real spreadsheet: cells, ranges, fill-down, named ranges and over 150 functions, with paste from Excel and Google Sheets.',
      'Cards as rows, linked both ways: change a cell and the card changes, move the card and its row follows.',
      'Boards with WIP limits and swimlanes, and Gantt and calendar charts drawn from the same cards.',
      'Dashboards of live slots, with a board, a sheet, a chart and a figure like a column total side by side.',
      'Forms on a public link, with sections, a cover and your tab’s look.',
      'Free for everyone, MIT-licensed, and ready without an account.',
    ],
    sections: [
      {
        heading: 'Spreadsheet and board, one set of work',
        paragraphs: [
          'In liveplanner a card is one item wherever it shows. A board shows cards in columns; a Sheet can list the same cards as rows, a column per field, and the two stay linked both ways. Formulas can also read the cards directly, so a budget sheet can total the estimates on the board without anyone copying numbers across.',
          'Sheets have the tools you would expect from a spreadsheet: number formats, sort, filter and freeze, dropdowns and checkboxes, rules that refuse a value that does not fit, conditional formatting and charts over the cells.',
        ],
      },
      {
        heading: 'Where Airtable goes further',
        paragraphs: [
          'Airtable is a database first. Linked records between many tables, lookups and rollups, and interfaces built on top of a base are things liveplanner does not try to match. If your work is shaped like a database of related tables, Airtable is the better tool; if it is shaped like a plan with numbers beside it, liveplanner may be the simpler one.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [`${GUEST_START} ${SHARE_LINKS}`, OPEN],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner a free alternative to Airtable?',
        a: 'Yes. Every feature is free for everyone, with no seats or paid tier, and the code is MIT-licensed.',
      },
      {
        q: 'Can I bring my Airtable data across?',
        a: 'Yes, through CSV. Airtable can download a view as CSV; a liveplanner Sheet takes CSV files, and a board imports CSV with each row becoming a card.',
      },
      {
        q: 'Does liveplanner have linked records between tables?',
        a: 'Partly. A card can have a field that links to another card, and a project and its tasks link to each other. There are no lookups or rollups across many tables, which remain Airtable’s strength.',
      },
      {
        q: 'Do people need an account to fill in a form?',
        a: 'No. A published form has a link anyone can fill in without signing in, and they see the form and nothing else of yours.',
      },
    ],
  },
  {
    slug: 'smartsheet',
    name: 'Smartsheet',
    title: 'Smartsheet alternative · liveplanner',
    description:
      'A free, open-source Smartsheet alternative: Sheets with real formulas, Gantt charts of your cards, live Dashboards and Forms, with no seats.',
    h1: 'A free, open-source Smartsheet alternative',
    lede: 'Smartsheet brings spreadsheet-style work management to large organisations, with grid, Gantt, card and calendar views, reports and dashboards. liveplanner offers the everyday parts of that, sheets, boards, a Gantt chart of the cards, live dashboards and forms, as free, open-source software you can start without an account.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Commercial, priced by plan' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create a sheet',
      },
      {
        label: 'Views of the work',
        us: 'Boards, Gantt chart, calendars, charts by field',
        them: 'Grid, Gantt, card and calendar views',
      },
      {
        label: 'Spreadsheets',
        us: 'Sheet tabs with over 150 functions and charts',
        them: 'Sheets with formulas at the core',
      },
      {
        label: 'Dashboards',
        us: 'Dashboard tabs of live boards, sheets, charts and notes',
        them: 'Dashboards and cross-sheet reports',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'You manage large programmes with cross-sheet reports, resource management and portfolio views.',
      'You need enterprise governance, approvals and administration across many teams.',
      'Your organisation already standardises on Smartsheet and its integrations.',
    ],
    usBest: [
      'No seats or tiers: every feature is free for everyone.',
      'A Gantt chart drawn from the cards, with bars you drag to change dates, swimlanes by any field and a line for today.',
      'Sheet tabs beside the board, reading its cards or listing them as rows linked both ways.',
      'Dashboards whose slots stay live: work on the board, edit the sheet and watch the chart redraw.',
      'Forms on a public link whose answers land as cards or rows the moment they are sent.',
      'Real-time editing for everyone with the link, no account needed.',
    ],
    sections: [
      {
        heading: 'The plan, the numbers and the timeline together',
        paragraphs: [
          'A liveplanner project keeps the plan in one place. The Project Planner template sets up a board of projects and their tasks; a Gantt chart draws every card with a start and a due date, filled to the share of its child cards that are done; a Sheet holds the budget; and a Dashboard puts all of it on one page. Because every view reads the same cards, changing a date on the Gantt moves the card on the board too.',
        ],
      },
      {
        heading: 'Where Smartsheet goes further',
        paragraphs: [
          'Smartsheet is built for programmes that span many sheets and teams: reports that roll up across sheets, resource and portfolio management, and the administration a large organisation expects. liveplanner has none of that layer, and is the simpler choice for a team or a project rather than a whole portfolio.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [`${GUEST_START} ${SHARE_LINKS}`, OPEN],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner a free alternative to Smartsheet?',
        a: 'Yes. Every feature is free for everyone, there is no paid tier, and the code is MIT-licensed.',
      },
      {
        q: 'Can I bring my Smartsheet sheets across?',
        a: 'Through a spreadsheet file, yes. Export a sheet, save it as CSV, and open it in a liveplanner Sheet, or import it onto a board where each row becomes a card. Formulas come across as their values, so you may want to rewrite the key ones.',
      },
      {
        q: 'Does liveplanner have a Gantt chart?',
        a: 'Yes. A Gantt chart can fill a tab of its own or sit in a Dashboard slot. It draws each card with a start and a due date as a bar, shows swimlanes by any field, and lets you drag a bar to change its dates.',
      },
      {
        q: 'Can I work with people outside my organisation?',
        a: 'Yes. Share an Editor, Participant or view-only link, with an optional password or expiry date, and they join you without signing up.',
      },
    ],
  },
];

export const ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
