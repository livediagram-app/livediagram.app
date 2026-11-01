import type { HeroSceneKey } from '@/components/hero-scenes';
import {
  ApiArt,
  BoardCsvArt,
  BoardImportArt,
  BoardWidgetsArt,
  DashboardArrangeArt,
  DashboardUtilitiesArt,
  CardCommentsArt,
  CardDetailArt,
  CardTypesArt,
  CellCommentsArt,
  CommentsArt,
  ConditionalFormatArt,
  DashboardArt,
  ExpiryArt,
  FindCardArt,
  FormAlertsArt,
  FormBuilderArt,
  FormResponsesArt,
  FormSectionsArt,
  FormShareArt,
  HiddenVotesArt,
  McpArt,
  PlanBoardArt,
  PlanViewsArt,
  PresenceArt,
  RealtimeArt,
  RevokeArt,
  SelectCardsArt,
  SelectionGlowArt,
  ShareLinksArt,
  SharedItemsArt,
  SuggestedDashboardsArt,
  SheetFigureArt,
  SheetTogetherArt,
  SheetValidationArt,
  SheetsArt,
  TeamsArt,
  TemplatesArt,
  TimelineFeedArt,
} from '@/components/FeatureArt';
import type { FeatureProps } from '@liveworkspace/marketing-site/components/Section';

/**
 * A feature category: one of the app's core features, each a story beat on the
 * landing page and a page of its own at /features/<id>
 * (docs/specs/019-marketing/marketing-site.md "Story beats").
 */
export type LandingSection = {
  id: string;
  /** The plain name of the feature, shown beside the beat's number (e.g. "Sheets"). */
  label: string;
  /** The headline: the beat's title on the landing page and the category page's h1. */
  title: string;
  description: string;
  /** The category page's meta description: 50 to 160 characters, so a search result shows it whole. */
  metaDescription: string;
  /**
   * The label for the beat's link into its category page. Hand written rather
   * than derived from the title, which read awkwardly ("Explore work on it
   * together, live"). Keep it short and verb-led, e.g. "Explore sheets".
   */
  cta: string;
  /** The hero scene that plays beside the beat and on the category page (components/hero-scenes.tsx). */
  scene: HeroSceneKey;
  /** The feature titles the beat lists, each a link to its card; every one names an item below. */
  highlights: string[];
  items: FeatureProps[];
};

/**
 * The feature categories, in the order the landing page tells them: the tabs of a project first
 * (Board tabs, Dashboard tabs, Sheet tabs, then Form tabs), then working on them together.
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
      'A plan holds the work on boards of cards: columns with WIP limits, swimlanes, card types with fields of your own, and one card that can sit on every board it belongs to.',
    metaDescription:
      'Boards of cards with WIP limits, swimlanes, your own card types and fields, comments on every card, and one card that sits on every board it belongs to.',
    highlights: [
      'Boards with WIP limits',
      'One card, every board',
      'Card types and fields of your own',
      'Change many cards at once',
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
          'Open a card for everything about it: a rich-text description, a checklist that counts down to done, status, assignee, priority, labels and dates, screenshots with a cover image, and the parent card it belongs to. Its Activity tab shows who moved it and what they changed. Make it repeat every week, see what it is blocked by, and follow the trail between a piece of work and its tasks without losing your place.',
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
          'Five built-in types (Project, Task, Note, Idea and Action), or make your own with the fields your team tracks: text, number, date, choice, a link to another card, formulas and rollups, a timer that tracks time, and more. Build a Bug and a Story on one base type and change their shared fields in one place.',
      },
      {
        art: <BoardWidgetsArt />,
        href: '/help/plan/boards/',
        title: 'Widgets that narrow the board',
        description:
          'Pin widgets to a board header (Completion, Due Soon, WIP Alerts, Top Voted, Stale Cards and more) and press one to narrow the board to just those cards. Save the view your team checks every morning as a filter anyone can apply in one click.',
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
          'Import a CSV or TSV and each row becomes a card, landing in the column its Status names and with the person its Assignee names; only a title is required, and one undo takes it all back. Export any board as CSV, an image, a PDF or a Markdown outline.',
      },
      {
        art: <HiddenVotesArt />,
        href: '/help/plan/boards/',
        title: 'Retros that keep a secret',
        description:
          'Cards stay face down while the team writes, so nobody anchors on the first idea. Press Reveal, then vote for what matters most.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/plan/planning-basics/',
        title: 'Ten plans, twelve spreadsheets',
        description:
          'Project Planner, Kanban Board, Bug Tracker, Team Retro, Weekly Planner, Content Calendar, Hiring Pipeline, OKRs, Product Launch and Feedback Board, each set up with its boards; twelve spreadsheets, from a Budget Planner and an Invoice to a Sales Pipeline, a Grade Book and a Loan Calculator, many with charts already in; or a blank plan. New Plan lays them out by kind, with search.',
      },
      {
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        title: 'Agents that move the cards',
        description:
          'Your AI tools can read the plan and add, edit and move cards over MCP, the API or the CLI, naming columns and fields the way the board shows them.',
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
      'Dashboard tabs put your boards, sheets, live charts of every card and notes side by side, in rows of slots you arrange, all of it live.',
    highlights: [
      'Dashboards on one page',
      'Live charts of every card',
      'Dashboards made from your work',
      'Figures and charts from a Sheet',
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
        art: <PlanViewsArt />,
        href: '/help/plan/sheets/',
        title: 'Charts from your cells',
        description:
          'Select some cells and chart them as bars, lines or a pie that sits in the Sheet over its cells, redrawn the moment a number changes.',
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
        art: <TemplatesArt />,
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
          'Each response becomes a row in a sheet, a column per question, or a card on a board with its answers in the card’s fields, ready to move along. The count on the form says how many are new.',
      },
      {
        art: <FormAlertsArt />,
        href: '/help/plan/forms/',
        title: 'New answers find you',
        description:
          'Each response shows New until you open it, the form counts what is new to you, and your Inbox lists every form with fresh answers. The owner also gets an email, at most one every 15 minutes per form, and can switch it off in Settings.',
      },
      {
        art: <TemplatesArt />,
        href: '/help/plan/forms/',
        title: 'Seven forms to start from',
        description:
          'A Bug Report, Feedback, a Feature Request, an Event RSVP, a Job Application, a Contact form, or a blank one, each sending its answers to the board or sheet that suits it.',
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
      'Share a link and your team is in the plan with you: live cursors on every board, sheet and dashboard, comments on cards and cells, links with the access each person needs, and agents that can lend a hand.',
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
        art: <TimelineFeedArt />,
        href: '/help/explorer/home/',
        group: 'Work together live',
        title: 'See what happened while you were away',
        description:
          'The Explorer opens on Home: the plans you return to most, and what your teammates commented and changed while you were away. Every plan and team keeps its own history, and the Inbox gathers the threads and form answers still waiting on you, with a count in the sidebar so you can tell without looking.',
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
        art: <McpArt />,
        href: '/help/account-and-data/connect-ai-mcp/',
        group: 'Agents & your tools',
        title: 'Agents that work beside you',
        description:
          'Connect Claude, ChatGPT or another AI tool over MCP and it can read your boards, cards, sheets and forms, and change them the way you would: add cards, move them across columns, fill in cells, build a form. Every change it makes lands live, like a teammate’s.',
      },
      {
        art: <ApiArt />,
        href: '/help/developers/api-overview/',
        group: 'Agents & your tools',
        title: 'An API and a CLI',
        description:
          'The same plan, cards and sheets over a plain HTTP API with personal tokens, and a command-line tool for scripts and agents that live in a terminal.',
      },
    ],
  },
];

export const LANDING_SECTION_IDS = LANDING_SECTIONS.map((section) => section.id);

/** Look up a single section by id (the `/features/<id>` page's source). */
export function getLandingSection(id: string): LandingSection | undefined {
  return LANDING_SECTIONS.find((section) => section.id === id);
}

type FeatureGroup = { title: string; items: FeatureProps[] };

/**
 * Split a section's features into ordered, captioned sub-groups for the
 * detail page. Groups appear in first-seen order; items keep their order
 * within a group. Returns `null` when the section has no `group` tags at all,
 * so the caller renders one flat grid (only the larger categories opt in to
 * grouping; see the `group` field on `FeatureProps`).
 */
export function groupSectionFeatures(section: LandingSection): FeatureGroup[] | null {
  if (!section.items.some((item) => item.group)) return null;
  const order: string[] = [];
  const byGroup = new Map<string, FeatureProps[]>();
  for (const item of section.items) {
    const key = item.group ?? 'More';
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push(item);
  }
  return order.map((title) => ({ title, items: byGroup.get(title)! }));
}

/** The features a section's beat lists, in order. Throws on a title no item has (a test pins them). */
export function sectionHighlights(section: LandingSection): FeatureProps[] {
  return section.highlights.map((title) => {
    const item = section.items.find((i) => i.title === title);
    if (!item) throw new Error(`Section "${section.id}" highlights unknown feature "${title}"`);
    return item;
  });
}
