import {
  AiTriageArt,
  ApiArt,
  AssignTurnArt,
  AuditTrailArt,
  BoardCsvArt,
  BoardImportArt,
  BoardWidgetsArt,
  DashboardArrangeArt,
  DashboardUtilitiesArt,
  CalendarFeedArt,
  CardActivityArt,
  CardCommentsArt,
  CardTemplateArt,
  CardDetailArt,
  CardTypesArt,
  CellCommentsArt,
  CollaboratorsArt,
  CommentsArt,
  ConnectedFilesArt,
  ConditionalFormatArt,
  ConfigureBoardArt,
  DashboardArt,
  DescribePlanArt,
  DescribeRuleArt,
  DriveCopyArt,
  EmailToBoardArt,
  EmbedBoardArt,
  ExpiryArt,
  FindCardArt,
  FlowChartsArt,
  FormAlertsArt,
  FormBuilderArt,
  FormResponsesArt,
  FormSectionsArt,
  FormShareArt,
  GanttClashArt,
  GithubPrArt,
  HiddenVotesArt,
  IncomingWebhookArt,
  McpArt,
  OfflineSaveArt,
  OutgoingArt,
  PlanBoardArt,
  PlanViewsArt,
  PresenceArt,
  PublicRoadmapArt,
  RealtimeArt,
  RevokeArt,
  RuleFlowArt,
  RuleTemplatesArt,
  ScheduleArt,
  SelectCardsArt,
  SelectionGlowArt,
  SessionToolsArt,
  ShareLinksArt,
  SharePasswordArt,
  SharedItemsArt,
  SuggestedDashboardsArt,
  SheetFigureArt,
  SheetTogetherArt,
  SheetValidationArt,
  SheetChartArt,
  SheetsArt,
  SnapshotsArt,
  TeamsArt,
  TemplatesArt,
  TrackerImportArt,
  TriggersArt,
  WalkthroughArt,
} from '@/components/FeatureArt';
import type { LandingSection } from './landing-section';

export type { LandingSection } from './landing-section';
export { groupSectionFeatures, sectionHighlights } from './landing-section';

/**
 * The feature categories, in the order the landing page tells them: the tabs of a project first
 * (Board tabs, Dashboard tabs, Sheet tabs, then Form tabs), the rules that work on them, then working on
 * them together.
 * `page.tsx` renders one beat per entry and alternates its background by index; `/features/<id>`
 * renders each one's cards.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'boards',
    label: 'Boards',
    scene: 'plan',
    cta: 'Explore boards',
    title: 'Plan the work, then watch it move',
    description:
      'A plan holds the work on boards of cards: columns with WIP limits, swimlanes, card types with fields of your own, one card on every board it belongs to, and a public roadmap when you want one.',
    metaDescription:
      'Boards of cards with WIP limits, swimlanes, your own card types and fields, comments on every card, and one card that sits on every board it belongs to.',
    highlights: [
      'Boards with WIP limits',
      'One card, every board',
      'Card types and fields of your own',
      'Publish a roadmap people vote on',
    ],
    items: [
      {
        art: <PlanBoardArt />,
        href: '/help/plan/boards/',
        title: 'Boards with WIP limits',
        description:
          'Drag cards through columns, split into swimlanes by assignee, type, priority or any field. Give a column a WIP limit and its count turns amber the moment it goes over.',
      },
      {
        art: <SharedItemsArt />,
        href: '/help/plan/items/',
        title: 'One card, every board',
        description:
          'A card is one item, not a copy, so the same card can sit on the sprint board and the roadmap. Move it on one and it moves on both.',
      },
      {
        art: <CardDetailArt />,
        href: '/help/plan/cards/',
        title: 'Cards that hold the detail',
        description:
          'Open a card for everything about it: a rich-text description, a checklist that counts down to done, status, assignee, priority, labels and dates, screenshots with a cover image, pictures in an Image field (up to 20 in one), and the parent card it belongs to. Its Linked Cards tab lists every card that links to it, and its Activity tab shows who moved it and what they changed. Make it repeat every week, see what it is blocked by, and follow the trail between a piece of work and its tasks without losing your place.',
      },
      {
        art: <CardCommentsArt />,
        href: '/help/plan/cards/',
        title: 'Talk it through on the card',
        description:
          'Every card holds its own threads. @mention a teammate and they get an email that opens the card, react with an emoji, resolve the thread when it is settled, and see the comment count on the card from the board.',
      },
      {
        art: <CardTypesArt />,
        href: '/help/plan/card-types/',
        title: 'Card types and fields of your own',
        description:
          'Five built-in types (Project, Task, Note, Idea and Action), or make your own with the fields your team tracks: text, number, date, choice, pictures, a link to another card, formulas and rollups, a timer that tracks time, and more. Build a Bug and a Story on one base type and change their shared fields in one place.',
      },
      {
        art: <CardTemplateArt />,
        href: '/help/plan/card-templates/',
        title: 'Start a card from a template',
        description:
          'Save the cards your team files again and again, such as a bug report with its steps to reproduce or a release with its checklist, as card templates. A new card then starts filled in, from Add Card, a chip or New.',
      },
      {
        art: <CardActivityArt />,
        href: '/help/plan/card-activity/',
        title: 'Every card keeps its history',
        description:
          'Open a card’s Activity to see who made it, who moved it from column to column and who changed its fields, and when. Changes an agent made are marked, so “who moved this?” never needs asking.',
      },
      {
        art: <BoardWidgetsArt />,
        href: '/help/plan/boards/',
        title: 'Widgets that narrow the board',
        description:
          'Pin widgets to a board header (Completion, Due Soon, WIP Alerts, Top Voted, Stale Cards and more) and press one to narrow the board to just those cards. Save the view your team checks every morning as a filter anyone can apply in one click.',
      },
      {
        art: <ConfigureBoardArt />,
        href: '/help/plan/boards/',
        title: 'A board set up in one click',
        description:
          'Configure Board suggests layouts that suit the board’s own cards, such as By Person or Quick Wins First, and says why. A preset never touches the columns or the cards, so trying one is safe. Or fine-tune any part, tile by tile.',
      },
      {
        art: <SelectCardsArt />,
        href: '/help/plan/select-cards/',
        title: 'Change many cards at once',
        description:
          'Cmd-click or Shift-click a handful of cards, then move, assign, prioritise, label, flag or archive them all in one step, or drag them to a new column as one group. One undo takes it all back.',
      },
      {
        art: <FindCardArt />,
        href: '/help/plan/cards/',
        title: 'Find any card',
        description:
          'The Cards list searches every card in the plan by number, title or description, newest change first. Add up to eight filters, such as Type: Bug or Assignee: No assignee, or show only the cards no board is showing.',
      },
      {
        art: <BoardCsvArt />,
        href: '/help/plan/boards/',
        title: 'Boards in and out as CSV',
        description:
          'Import a CSV or TSV and each row becomes a card, landing in the column its Status names and with the person its Assignee names; only a title is required, and one undo takes it all back. Export any board as CSV, an image, a PDF or a Markdown outline, or the whole plan as one .liveplanner file that imports back as a new plan.',
      },
      {
        art: <TrackerImportArt />,
        href: '/help/tabs/import-tabs/',
        title: 'Bring your board from another tool',
        description:
          'Drop a Trello board’s JSON export, or an Asana, Jira or Linear CSV export, on the Import dialog and it becomes a Board tab, or a new plan, with its columns, cards, fields and people. It is a one-off import, so nothing stays tied to the old tool.',
      },
      {
        art: <EmailToBoardArt />,
        href: '/help/plan/email-to-board/',
        title: 'Email straight to the board',
        description:
          'Give a board its own secret address and forward a request or a bug report to it: it lands as a card in the first column, the subject as its title and its pictures and PDFs attached. Who Can Send keeps it to plan members, or opens it to anyone with the address.',
      },
      {
        art: <HiddenVotesArt />,
        href: '/help/plan/boards/',
        title: 'Retros that keep a secret',
        description:
          'Cards stay face down while the team writes, so nobody anchors on the first idea. Press Reveal, then vote for what matters most.',
      },
      {
        art: <PublicRoadmapArt />,
        href: '/help/plan/public-roadmap/',
        title: 'Publish a roadmap people vote on',
        description:
          'Publish as Roadmap turns a board into a live public page of the columns, card types and fields you choose, and nothing else. Visitors upvote what they want most and Suggest an Idea through one of your forms, with no account, and Unpublish takes it down at once.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/plan/planning-basics/',
        title: 'Twenty plans, twelve spreadsheets',
        description:
          'Twenty plans, from a Project Planner, Sprint Board and Bug Tracker to an Event Planner, Trip Planner, Sales CRM, Help Desk and Client Onboarding, each set up with its boards, forms and flow charts; twelve spreadsheets, from a Budget Planner and an Invoice to a Sales Pipeline, a Grade Book and a Loan Calculator, many with charts already in; or a blank plan. New Plan lays them out by kind, with search.',
      },
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        title: 'Agents that move the cards',
        description:
          'Your AI tools can read the plan and add, edit and move cards over MCP, the API or the CLI, naming columns and fields the way the board shows them, and attach pictures to a card’s Image fields. In Claude the board opens right in the chat, following the plan live.',
      },
    ],
  },
  {
    id: 'dashboards',
    label: 'Dashboards',
    scene: 'dashboard',
    cta: 'Explore dashboards',
    title: 'See the whole plan on one page',
    description:
      'Bring your boards, sheets, charts and notes side by side on a Dashboard tab, every slot live, so the picture is never out of date.',
    metaDescription:
      'Dashboard tabs put boards, sheets, notes and live charts side by side, from a Gantt chart to Cycle Time, Throughput and Cumulative Flow.',
    highlights: [
      'Dashboards on one page',
      'Live charts of every card',
      'Dashboards made from your work',
      'See how work flows',
    ],
    items: [
      {
        art: <DashboardArt />,
        href: '/help/plan/dashboards/',
        title: 'Dashboards on one page',
        description:
          'Lay a Dashboard tab out as rows of slots and put one thing in each, live: a board you can work on, a Sheet you can edit, a chart, a figure like Completion or a column total, or a note, a checklist or a key date. Start from a layout such as Overview or Report, then add, move and resize slots as you go.',
      },
      {
        art: <PlanViewsArt />,
        href: '/help/plan/visualisations/',
        title: 'Live charts of every card',
        description:
          'A Gantt chart, due and start calendars you can drag cards across, cards by any field and priority by status, all drawn from the cards themselves, so a chart is never out of date. Give one a tab of its own and it fills the page, with a Chart Settings cog for which cards it shows and how it groups them.',
      },
      {
        art: <FlowChartsArt />,
        href: '/help/plan/visualisations/',
        title: 'See how work flows',
        description:
          'Cycle Time shows how long cards take, with the time 85% get done within. Throughput counts what is finished each week, and Cumulative Flow shows where work piles up. All three read each card’s history over the last 14 to 180 days.',
      },
      {
        art: <GanttClashArt />,
        href: '/help/plan/visualisations/',
        title: 'A Gantt that spots clashes',
        description:
          'Link cards with Blocked By and the Gantt chart draws the arrows between them. When a card starts before its blocker is due, its arrow turns amber and a mark on the card says by how many days. Drag a card later and one press moves the cards that follow it too, in one undo.',
      },
      {
        art: <SuggestedDashboardsArt />,
        href: '/help/plan/dashboards/',
        title: 'Dashboards made from your work',
        description:
          'Once a plan has boards, Start Planning offers dashboards built around them, badged For You: a Timeline for a board with dates, Sprint Health for one with estimates, Triage, a Team Overview of several boards, or a board beside a Sheet. Pick one and every slot arrives filled.',
      },
      {
        art: <SheetFigureArt />,
        href: '/help/plan/dashboards/',
        title: 'Figures and charts from a Sheet',
        description:
          'Show one cell against a target, a column’s total or average, a trend, or a chart of any range as columns, bars, lines, a pie or a doughnut, read live from a Sheet in the plan. A form lends its figures too: its responses, the new ones, and when it closes.',
      },
      {
        art: <DashboardUtilitiesArt />,
        href: '/help/plan/dashboards/',
        title: 'Notes, status and key dates',
        description:
          'Write on the dashboard itself: a note, a title to name a section, a status of On Track, At Risk or Off Track, a checklist to tick off, a key date counted down to, or a set of links. Style each card to suit the page.',
      },
      {
        art: <DashboardArrangeArt />,
        href: '/help/plan/dashboards/',
        title: 'Arrange it your way',
        description:
          'Drag a slot by its grip to swap or move it, drag the bar between slots to share a row differently, or use the arrow keys; every change is one undo. On a phone the slots stack one under another, and a dashboard exports as a PNG, SVG or PDF.',
      },
      {
        art: <McpArt lands="dashboard" />,
        href: '/help/plan/dashboards/',
        title: 'Dashboards your agents can build',
        description:
          'Ask a connected AI tool for a dashboard and it lays out the slots for you: the boards, the figures, the charts and the flow charts over the range you name. It changes a dashboard only when you can edit the plan.',
      },
    ],
  },
  {
    id: 'sheets',
    label: 'Sheets',
    scene: 'sheet',
    cta: 'Explore sheets',
    title: 'Spreadsheets that sit beside the work',
    description:
      'Add a Sheet tab to any plan: real formulas, number formats, sort and filter, live for everyone. Read the cards on a board, or list them as rows that stay linked both ways, and chart any cells in a click.',
    metaDescription:
      'Sheet tabs with real formulas, live for everyone, reading the board’s cards or listing them as linked rows, with charts from any cells.',
    highlights: [
      'Sheets with real formulas',
      'Cards as rows, linked both ways',
      'Charts from your cells',
      'Twelve ready-made spreadsheets',
    ],
    items: [
      {
        art: <SheetsArt />,
        href: '/help/plan/sheets/',
        title: 'Sheets with real formulas',
        description:
          'Cells, over 150 functions, number formats, sort, filter and freeze, live for everyone on the plan. Formulas fill down, and a cell can read a card on the board.',
      },
      {
        art: <SharedItemsArt />,
        href: '/help/plan/sheets/',
        title: 'Cards as rows, linked both ways',
        description:
          'List the board’s cards as rows: change a cell and the card changes, move the card and its row follows. The sheet and the board are one set of work.',
      },
      {
        art: <SheetChartArt />,
        href: '/help/plan/sheets/',
        title: 'Charts from your cells',
        description:
          'Select some cells and chart them as bars, lines or a pie that sits in the Sheet over its cells, redrawn the moment a number changes. Charts in livedocuments, livediagram and livedesign can read a range of a Sheet too, and keep in step with it.',
      },
      {
        art: <SheetValidationArt />,
        href: '/help/plan/sheets/',
        title: 'Dropdowns and checkboxes',
        description:
          'Turn cells into coloured dropdown chips, a list from other cells, or tick boxes a formula can count. Number, date and text rules refuse a value that does not fit, or only warn, and say why in the cell.',
      },
      {
        art: <ConditionalFormatArt />,
        href: '/help/plan/sheets/',
        title: 'Colour cells by their values',
        description:
          'Conditional formatting paints a cell when it meets a rule (text contains, greater than, a date before, or a formula of your own) or shades a whole column on a colour scale. You see each rule on the cells while you set it.',
      },
      {
        art: <CellCommentsArt />,
        href: '/help/plan/sheets/',
        title: 'Named ranges and cell comments',
        description:
          'Name a cell TaxRate and write =B2*TaxRate in any row. Leave a comment on a single cell: it carries an amber corner, opens as a thread, and is listed with every other open thread in the plan.',
      },
      {
        art: <SheetTogetherArt />,
        href: '/help/plan/sheets/',
        title: 'Edit together, cell by cell',
        description:
          'Everyone sees each change as it is made, with each person’s selection outlined in their colour and name. Two people typing in different cells never overwrite each other, and a participant link can fill in cells without changing the rules.',
      },
      {
        art: <TemplatesArt set="sheets" />,
        href: '/help/plan/sheet-functions/',
        title: 'Twelve ready-made spreadsheets',
        description:
          'A Budget Planner, an Invoice, a Sales Pipeline, a Grade Book, a Loan Calculator and more, many with charts already in, or a blank spreadsheet to type into.',
      },
      {
        art: <BoardImportArt />,
        href: '/help/plan/sheets/',
        title: 'Paste from Sheets and Excel, CSV in and out',
        description:
          'Copy and paste works with Google Sheets and Excel, CSV files come in and go out, and cells come Compact, Default or Roomy and zoom from 50% to 200%.',
      },
    ],
  },
  {
    id: 'forms',
    label: 'Forms',
    scene: 'form',
    cta: 'Explore forms',
    title: 'Collect answers straight into your board or sheet',
    description:
      'Build a form where it sits, share one link, and each response lands the moment it is sent: a row in a sheet, or a card on a board ready to work through. No account needed to answer, and nothing else of yours to see.',
    metaDescription:
      'Build a form, share one link, and each response lands as a row in a sheet or a card on a board. No account needed to answer.',
    highlights: [
      'Build it where it sits',
      'One link to share',
      'Every answer lands',
      'Seven forms to start from',
    ],
    items: [
      {
        art: <FormBuilderArt />,
        href: '/help/plan/forms/',
        title: 'Build it where it sits',
        description:
          'Click a question to word it, pick its type (short answer, paragraph, number, email, link, date, choices, rating or a checkbox) and mark it required, right in the form. Sections can show only on an earlier answer.',
      },
      {
        art: <FormSectionsArt />,
        href: '/help/plan/forms/',
        title: 'Pages, a cover and your look',
        description:
          'Split a form into sections people answer a page at a time, with Next, Back and a progress bar, and show a section only to those who answered a certain way. Add a cover band, and the form wears its tab’s theme and font on its link too.',
      },
      {
        art: <FormShareArt />,
        href: '/help/plan/forms/',
        title: 'One link to share',
        description:
          'Publish the form to get a link anyone can fill in, with no sign-in. They see the form and nothing else of yours, and you can close it, set a closing date or a response limit at any time.',
      },
      {
        art: <FormResponsesArt />,
        href: '/help/plan/forms/',
        title: 'Every answer lands',
        description:
          'Each response becomes a row in a sheet, a column per question, or a card on a board with its answers in the card’s fields, ready to move along. Pick a card type and the questions come from its fields, landing in a column that type uses. The count on the form says how many are new.',
      },
      {
        art: <FormAlertsArt />,
        href: '/help/plan/forms/',
        title: 'New answers find you',
        description:
          'Each response shows New until you open it, the form counts what is new to you, and your Inbox lists every form with fresh answers. The owner also gets an email, at most one every 15 minutes per form, and can switch it off in Settings.',
      },
      {
        art: <TemplatesArt set="forms" />,
        href: '/help/plan/forms/',
        title: 'Seven forms to start from',
        description:
          'A Bug Report, Feedback, a Feature Request, an Event RSVP, a Job Application, a Contact form, or a blank one, each sending its answers to the board or sheet that suits it.',
      },
    ],
  },
  {
    id: 'automations',
    label: 'Automations',
    scene: 'automations',
    cta: 'Explore automations',
    title: 'Rules that do the routine steps for you',
    description:
      'Tell the plan what to do when a card moves, a form response lands or a due date nears: stamp the date, hand the card to whoever is next, post to Slack. Rules run on their own, even when nobody has the plan open.',
    metaDescription:
      'Automation rules for your boards: when a card moves, a form lands or a date nears, liveplanner assigns, labels, stamps dates and posts to Slack for you.',
    highlights: [
      'Rules in plain words',
      'Start from a template',
      'Rules on a schedule',
      'AI steps that triage',
    ],
    items: [
      {
        art: <RuleFlowArt />,
        href: '/help/plan/automations/',
        title: 'Rules in plain words',
        description:
          'A rule reads like a sentence: When something happens to a card, If the card is the kind you mean, Then do the steps. Move it, set or clear a field, assign it, label it, flag it, comment, add a checklist, link it to another card, copy it, or wait a day first. If / Else and For Related Cards cover the rest.',
      },
      {
        art: <RuleTemplatesArt />,
        href: '/help/plan/automations/',
        title: 'Start from a template',
        description:
          'Pick a ready-made rule, such as Stamp the Finish Date, Triage New Bugs, Overdue Nudge or Close the Parent, and it opens filled in with your plan’s own columns and fields. Change what you like, then save it and switch it on.',
      },
      {
        art: <DescribeRuleArt />,
        href: '/help/plan/automations/',
        title: 'Describe a rule in your words',
        description:
          'Say what a rule should do, such as “when a bug moves to Done, comment Fixed and flag it”, and AI drafts it in the builder, unsaved and off, for you to check, test and switch on. Nothing runs until you save it.',
      },
      {
        art: <TriggersArt />,
        href: '/help/plan/automations/',
        title: 'Triggers for every moment',
        description:
          'Start a rule when a card is added, moves, changes a field, is archived or restored, gets a comment or a mention, finishes its checklist, has every thread resolved, is unblocked, sees its last child done or tips a column over its limit, or when an email lands on the board. Or run one from a card’s menu yourself.',
      },
      {
        art: <ScheduleArt />,
        href: '/help/plan/automations/',
        title: 'Rules on a schedule',
        description:
          'Run a rule every day, every weekday, on chosen days or once a month, at the time you pick. Or run it days before a card is due, the day after it goes overdue, or once a card has sat unchanged for too long.',
      },
      {
        art: <AssignTurnArt />,
        href: '/help/plan/automations/',
        title: 'Share the work out in turn',
        description:
          'Assign whoever moved the card, a chosen person, or the people on triage in turn, so new bugs and form requests are handed out evenly without anyone keeping count.',
      },
      {
        art: <OutgoingArt />,
        href: '/help/plan/automations/',
        title: 'Tell people where they are',
        description:
          'Email the assignee, @mention someone on the card, post to a Slack or Microsoft Teams channel with a link back to the card, or send a signed event to a service of your own.',
      },
      {
        art: <AiTriageArt />,
        href: '/help/plan/automations/',
        title: 'AI steps that triage',
        description:
          'Add an AI step that summarises a card, suggests its card type, or sets its priority and labels from what it says. Each plan has 100 AI steps a day, and anything AI wrote is marked as such.',
      },
      {
        art: <IncomingWebhookArt />,
        href: '/help/plan/automations/',
        title: 'Start a rule from another tool',
        description:
          'Give a rule its own address and secret, and another tool can start it with one call: a deploy finishing can move its cards to Done, or a support tool can open a card.',
      },
      {
        art: <GithubPrArt />,
        href: '/help/plan/connect-github/',
        title: 'Cards that follow the code',
        description:
          'Connect a plan to GitHub and each card shows where its pull requests stand: draft, open, checks passing or failing, merged or closed. Rules act when one opens, merges or its checks finish, so a card moves to Done when its code lands.',
      },
      {
        art: <AuditTrailArt />,
        href: '/help/plan/automations/',
        title: 'Every run on the record',
        description:
          'Test a rule on a real card before you save it and see what it would do. Once it is on, the Audit Trail lists every run with its card, its result and each step it took, and what a rule changed reads as Automation on the card. A rule that fails ten times in a row pauses itself and says why, until you press Resume.',
      },
      {
        art: <McpArt lands="rule" />,
        href: '/help/plan/automations/',
        title: 'Rules your agents can write',
        description:
          'AI tools connected over MCP, and the command-line tool, can list, write, test and run rules the way an Editor of the plan can. Rules run on our servers, so they work on plans saved to your account.',
      },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaborate',
    scene: 'together',
    cta: 'Explore collaboration',
    title: 'Plan it together, live',
    description:
      'Share a link and your team is in the plan with you: live presence on every board, sheet and dashboard, comments on cards and cells, links with the access each person needs, and agents that can lend a hand.',
    metaDescription:
      'Share a link and your team plans with you live: presence on every tab, comments on cards and cells, share links with the right access, and agent access.',
    highlights: [
      'Live presence',
      'Comments where the work is',
      'Editor, participant or view-only links',
      'Agents that work beside you',
    ],
    items: [
      {
        art: <PresenceArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Live presence',
        description:
          'See who is in the plan from the avatars on each tab. Status rings show online, away, or stale.',
      },
      {
        art: <RealtimeArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'Edits land live',
        description:
          'The moment someone moves a card or changes a cell, everyone sees it. If two people edit the same thing at once, the most recent change is the one that sticks.',
      },
      {
        art: <SelectionGlowArt />,
        href: '/help/collaboration/live-presence/',
        group: 'Work together live',
        title: 'See what others are working on',
        description:
          'Select a card or a cell and your collaborators see your colour around it, with your name beside it, in real time.',
      },
      {
        art: <CommentsArt />,
        href: '/help/collaboration/comments/',
        group: 'Work together live',
        title: 'Comments where the work is',
        description:
          "Every card has its own thread, and any cell can carry one. Reply, @mention a teammate, resolve. Comments carry the author's name and colour so it's clear who said what.",
      },
      {
        art: <CollaboratorsArt />,
        href: '/help/collaboration/live-presence/#collaborators',
        group: 'Work together live',
        title: 'See where the whole room is',
        description:
          'Click any avatar on a tab and Collaborators lists everyone in the plan by the tab they are on, with their role, whether they are online or away, and when they were last active. Go to Tab takes you straight to them.',
      },
      {
        art: <SessionToolsArt />,
        href: '/help/collaboration/session-tools/',
        group: 'Work together live',
        title: 'Run the session in the plan',
        description:
          'Time-box a retro with a countdown everyone sees ticking in sync, then dot-vote on the cards with live tallies and a results reveal. Join late or reload and the clock and the votes are right where the room left them.',
      },
      {
        art: <WalkthroughArt />,
        href: '/help/collaboration/walkthroughs/',
        group: 'Work together live',
        title: 'Walk them through it',
        description:
          'Record a walkthrough: your voice, your camera in a round bubble if you like, and every tab you open. Teammates play it back over the plan itself, so they can pause, look around and carry on. Hide private cards from the recording first.',
      },
      {
        art: <SnapshotsArt />,
        href: '/help/collaboration/snapshots/',
        group: 'Work together live',
        title: 'Snapshots before a big change',
        description:
          'Take a snapshot of the whole plan before a reorganisation, an import or a clean-up with an agent. The latest five are kept, and Revert puts every tab, card and Sheet back as it was in one step.',
      },
      {
        art: <OfflineSaveArt />,
        href: '/help/troubleshooting/missing-changes/',
        group: 'Work together live',
        title: 'Keep going when the wifi drops',
        description:
          'Lose the connection and keep moving cards and filling in cells: each change waits in this browser and saves when you reconnect. And a burst of removals that would clear a board is held until you choose Keep Cards or remove them.',
      },
      {
        art: <ShareLinksArt />,
        href: '/help/collaboration/sharing/',
        group: 'Share & access',
        title: 'Editor, participant or view-only links',
        description:
          'Create an editor link for collaborators, a participant link for people who should add cards and fill in cells without changing the setup, or a view-only link for stakeholders who should watch, not touch. Run as many links as you like, side by side, and point one at a single tab to keep the rest of the plan private.',
      },
      {
        art: <TeamsArt />,
        href: '/help/collaboration/teams/',
        group: 'Share & access',
        title: 'Teams with a shared library',
        description:
          'Create a team, invite people by email, and everyone gets a shared folder of plans they can all open and edit. Admins manage membership and roles; members just get to work. Sign in to set one up, a plan itself never needs an account.',
      },
      {
        art: <ExpiryArt />,
        href: '/help/collaboration/sharing/share-link-expiry/',
        group: 'Share & access',
        title: 'Links that expire on their own',
        description:
          'Give a share link a lifetime when you create it: a week, a month, six months, or never. When it lapses the URL stops working on its own, no cleanup to remember, and you can extend it for another run or delete it for good.',
      },
      {
        art: <RevokeArt />,
        href: '/help/collaboration/sharing/',
        group: 'Share & access',
        title: 'Stop sharing on demand',
        description:
          'Sharing is a toggle, not a state of being. Revoke a link and the URL stops working. The plan is yours again.',
      },
      {
        art: <EmbedBoardArt />,
        href: '/help/collaboration/sharing/embeds/',
        group: 'Share & access',
        title: 'Embed a live board',
        description:
          'Paste an embed from a share link into a wiki, a doc or your own site and the board, sheet, dashboard or form shows there, kept live. A view-only link embeds it read-only; an editor link lets readers move cards right there.',
      },
      {
        art: <SharePasswordArt />,
        href: '/help/collaboration/sharing/share-passwords/',
        group: 'Share & access',
        title: 'A password on the plan',
        description:
          'Add a password and anyone arriving by a share link, or an embed, must enter it before the plan opens. You and your team never need it, and Remove takes it off again.',
      },
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        group: 'Agents & your tools',
        title: 'Agents that work beside you',
        description:
          'Connect Claude, ChatGPT or another AI tool over MCP and it can read your boards, cards, sheets and forms, and change them the way you would: add cards, move them across columns, fill in cells, build a form, set up an automation rule. Every change it makes lands live, like a teammate’s.',
      },
      {
        art: <ApiArt />,
        href: '/help/developers/api-overview/',
        group: 'Agents & your tools',
        title: 'An API and a CLI',
        description:
          'The same plan, cards and sheets over a plain HTTP API with personal tokens, and a command-line tool for scripts and agents that live in a terminal.',
      },
      {
        art: <DescribePlanArt />,
        href: '/help/plan/describe-a-plan/',
        group: 'Agents & your tools',
        title: 'Describe it, get the board',
        description:
          'When your work runs its own way, sign in and say it in your own words: a hiring pipeline with Applied, Screen, Interview and Offer, say. AI drafts the columns, the card types with their fields and a starter rule or two, for you to check and change before Make Plan makes anything.',
      },
      {
        art: <CalendarFeedArt />,
        href: '/help/plan/calendar-feed/',
        group: 'Beyond the plan',
        title: 'Dates in your calendar',
        description:
          'Signed in, Subscribe to Calendar puts the plan’s card dates in Google Calendar, Outlook or Apple Calendar from a private link, kept up to date: one board or all, only your cards if you like. Reset Link stops the old one at once.',
      },
      {
        art: <ConnectedFilesArt />,
        href: '/help/tabs/connected-files/',
        group: 'Beyond the plan',
        title: 'Files from your other apps',
        description:
          'Connect a file from any liveworkspace app as a tab beside your boards and sheets, so the brief, the screens and the architecture behind the plan are one tap away, each with a preview and a way in. Signed in, Start a Project makes a plan and its files in the other apps at once, already connected.',
      },
      {
        art: <DriveCopyArt />,
        href: '/help/account-and-data/google-drive/',
        group: 'Beyond the plan',
        title: 'A copy in your Google Drive',
        description:
          'Signed in, connect Google Drive and every plan you own is kept as a file in your own Drive, in folders that match yours. Renames, moves and deletions sync both ways.',
      },
    ],
  },
];

export const LANDING_SECTION_IDS = LANDING_SECTIONS.map((section) => section.id);

/** Look up a single section by id (the `/features/<id>` page's source). */
export function getLandingSection(id: string): LandingSection | undefined {
  return LANDING_SECTIONS.find((section) => section.id === id);
}
