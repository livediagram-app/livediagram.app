// The tool-pick eval's requests (liveworkspace/docs/specs/021-mcp/mcp.md "The tool-pick eval"): what people ask an
// assistant connected to their apps, each with the app tool it should lead to and the arguments that matter. Every
// expectation names the app's OWN tool, so one request scores both setups: the five app servers side by side, and
// the one MCP, whose calls are mapped back to the app tools they run.
import type { AppId } from '../src/apps';

// An argument that matters: a string the value holds (any case), or a pattern it matches.
export type ArgMatch = string | RegExp;

export type Expected = { app: AppId; tool: string; args?: Record<string, ArgMatch> };

export type EvalRequest = { id: string; ask: string; expect: readonly Expected[] };

/** The person's items, as an earlier find told the assistant. The two setups name them their own way. */
export const ITEMS = [
  { app: 'livediagram', kind: 'diagram', id: 'D-checkout', name: 'Checkout flow' },
  { app: 'livediagram', kind: 'diagram', id: 'D-org', name: 'Org chart' },
  { app: 'livedocuments', kind: 'doc', id: 'L-q3', name: 'Q3 review (slide deck)' },
  { app: 'livedocuments', kind: 'doc', id: 'L-onboard', name: 'Onboarding guide (article)' },
  {
    app: 'liveplanner',
    kind: 'plan',
    id: 'P-launch',
    name: 'Launch plan (Tasks board, Budget sheet)',
  },
  { app: 'liveplanner', kind: 'plan', id: 'P-retro', name: 'Sprint 14 retro (board)' },
  { app: 'livedesign', kind: 'design', id: 'G-logo', name: 'Acme logo' },
  {
    app: 'liveknowledge',
    kind: 'knowledgebase',
    id: 'K-hb',
    name: 'Team handbook (knowledgebase)',
  },
] as const;

const D = { documentId: 'D-checkout' };
const ORG = { documentId: 'D-org' };
const Q3 = { documentId: 'L-q3' };
const ONB = { documentId: 'L-onboard' };
const LAUNCH = { projectId: 'P-launch' };
const RETRO = { projectId: 'P-retro' };
const LOGO = { designId: 'G-logo' };
const HB = { documentId: 'K-hb' };

const e = (app: AppId, tool: string, args?: Record<string, ArgMatch>): Expected => ({
  app,
  tool,
  args,
});

export const REQUESTS: readonly EvalRequest[] = [
  // Finding and reading
  {
    id: 'find-diagram',
    ask: 'Do I have a diagram about payments?',
    expect: [e('livediagram', 'find_documents', { query: 'payment' })],
  },
  {
    id: 'find-any',
    ask: 'Find everything I have about the launch.',
    expect: [
      e('liveplanner', 'find_projects', { query: 'launch' }),
      e('livediagram', 'find_documents', { query: 'launch' }),
      e('livedocuments', 'find_documents', { query: 'launch' }),
    ],
  },
  {
    id: 'find-deck',
    ask: 'Which slide decks do I have about hiring?',
    expect: [e('livedocuments', 'find_documents', { query: 'hiring' })],
  },
  {
    id: 'find-plan',
    ask: 'Find my marketing plan.',
    expect: [e('liveplanner', 'find_projects', { query: 'marketing' })],
  },
  {
    id: 'find-design',
    ask: 'Look for my business card designs.',
    expect: [e('livedesign', 'find_designs', { query: 'card' })],
  },
  {
    id: 'find-kb',
    ask: 'Which knowledgebases does my team have?',
    expect: [e('liveknowledge', 'find_documents')],
  },
  {
    id: 'read-diagram',
    ask: 'What is in the Checkout flow diagram?',
    expect: [e('livediagram', 'read_document', D)],
  },
  {
    id: 'read-deck',
    ask: 'Summarise the Q3 review deck for me.',
    expect: [e('livedocuments', 'read_document', Q3)],
  },
  {
    id: 'read-plan',
    ask: 'Give me an overview of the Launch plan.',
    expect: [e('liveplanner', 'read_project', LAUNCH), e('liveplanner', 'list_items', LAUNCH)],
  },
  {
    id: 'read-design',
    ask: 'Describe the Acme logo design.',
    expect: [e('livedesign', 'read_design', LOGO)],
  },
  {
    id: 'kb-ask',
    ask: 'According to our team handbook, how many days of holiday do we get?',
    expect: [e('liveknowledge', 'search_pages', { ...HB, query: 'holiday' })],
  },
  {
    id: 'kb-ask-2',
    ask: 'What does the handbook say about expenses?',
    expect: [e('liveknowledge', 'search_pages', { ...HB, query: 'expense' })],
  },
  {
    id: 'kb-page',
    ask: 'Open the "Security policy" page in the team handbook.',
    expect: [
      e('liveknowledge', 'read_page', { ...HB, page: 'Security' }),
      e('liveknowledge', 'search_pages', { ...HB, query: 'security' }),
    ],
  },
  {
    id: 'kb-tree',
    ask: 'List the pages in the team handbook.',
    expect: [e('liveknowledge', 'list_pages', HB)],
  },
  {
    id: 'kb-context',
    ask: 'Before you start, load what my team wants every agent to know from the handbook.',
    expect: [e('liveknowledge', 'get_context', HB)],
  },
  {
    id: 'cards-list',
    ask: 'What tasks are still open on the Launch plan?',
    expect: [e('liveplanner', 'list_items', LAUNCH)],
  },
  {
    id: 'sheet-read',
    ask: 'What is the total in the Budget sheet of the Launch plan?',
    expect: [e('liveplanner', 'read_sheet', { ...LAUNCH, sheet: 'Budget' })],
  },
  {
    id: 'trash-list',
    ask: 'What have I deleted recently?',
    expect: [
      e('livediagram', 'list_trash'),
      e('liveplanner', 'list_trash'),
      e('livedocuments', 'list_trash'),
    ],
  },

  // Making
  {
    id: 'make-diagram',
    ask: 'Make a flowchart of our signup process: visit, sign up, verify email, onboarding.',
    expect: [e('livediagram', 'create_document')],
  },
  {
    id: 'make-mindmap',
    ask: 'Start a mind map called "Product ideas".',
    expect: [e('livediagram', 'create_document', { name: 'Product ideas' })],
  },
  {
    id: 'make-deck',
    ask: 'Create a 5-slide deck introducing our new pricing.',
    expect: [e('livedocuments', 'create_document')],
  },
  {
    id: 'make-article',
    ask: 'Write an article about our remote work policy.',
    expect: [e('livedocuments', 'create_document'), e('livedocuments', 'write_article')],
  },
  {
    id: 'make-infographic',
    ask: 'Make an infographic of our 2026 results.',
    expect: [e('livedocuments', 'create_document')],
  },
  {
    id: 'make-plan',
    ask: 'Set up a kanban plan for the website redesign.',
    expect: [e('liveplanner', 'create_project')],
  },
  {
    id: 'make-design',
    ask: 'Design an Instagram post announcing our summer sale.',
    expect: [e('livedesign', 'create_design')],
  },
  {
    id: 'make-kb',
    ask: 'Create a knowledgebase for the support team.',
    expect: [e('liveknowledge', 'create_document')],
  },
  {
    id: 'make-form',
    ask: 'Make a sign-up form for the team offsite.',
    expect: [e('liveplanner', 'add_form')],
  },
  {
    id: 'make-kb-page',
    ask: 'Add a page called "On-call rota" to the team handbook explaining who is on call each week.',
    expect: [e('liveknowledge', 'create_page', { ...HB, title: 'On-call' })],
  },
  // The starter prompts on each app's Build with AI page (Work Tracker 1488): each one's lead tool.
  {
    id: 'make-gantt',
    ask: 'Create a Gantt chart for launching our new website, with a row each for design, copy, build, testing and go-live.',
    expect: [e('livediagram', 'create_document', { tabs: 'gantt' })],
  },
  {
    id: 'make-retro',
    ask: 'Set up a retrospective for our sprint, with what went well, what to improve and actions, and share a participant link so the team can add their notes.',
    expect: [e('livediagram', 'create_document', { tabs: 'retrospective' })],
  },
  {
    id: 'make-poster',
    ask: 'Lay out an event poster for a bakery called Bloom opening its doors on Saturday.',
    expect: [e('livedocuments', 'create_document', { tabs: 'event-poster' })],
  },
  {
    id: 'make-resume',
    ask: 'Make me a resume from the resume template, filled in from the profile I paste below.',
    expect: [e('livedocuments', 'create_document', { tabs: 'resume' })],
  },
  {
    id: 'make-logo',
    ask: 'Add a logo page for a bakery called Bloom: a simple symmetrical mark above the name.',
    expect: [e('livedesign', 'create_design')],
  },
  {
    id: 'make-wireframe',
    ask: 'Wireframe the sign-up screen as a phone wireframe: the fields, the button and the error states.',
    expect: [e('livedesign', 'create_design', { tabs: 'phone' })],
  },
  {
    id: 'make-feedback-form',
    ask: 'Make a feedback form with a rating, what people liked and what to improve, and send the answers to a board as cards.',
    expect: [e('liveplanner', 'add_form')],
  },
  {
    id: 'cards-from-notes',
    ask: 'Add the action points from this conversation as tasks on the Launch plan, each with an owner and a due date where we agreed one.',
    expect: [e('liveplanner', 'change_items', LAUNCH)],
  },
  {
    id: 'kb-review-due',
    ask: 'List the pages of the team handbook whose review is due, oldest first, with each page’s owner.',
    expect: [e('liveknowledge', 'list_pages', HB)],
  },
  {
    id: 'import-trello',
    ask: 'Here is a Trello export JSON; bring it in as a board: {"name":"Bugs","lists":[]}',
    expect: [e('liveplanner', 'import_board')],
  },

  // Changing what is inside
  {
    id: 'edit-diagram',
    ask: 'In the Checkout flow diagram, add a "Fraud check" step after payment.',
    expect: [e('livediagram', 'update_document', D)],
  },
  {
    id: 'edit-diagram-2',
    ask: 'Rename the "Pay" box in Checkout flow to "Payment".',
    expect: [e('livediagram', 'update_document', D), e('livediagram', 'view_edit', D)],
  },
  {
    id: 'org-add',
    ask: 'Add Priya as Head of Design under the CEO in the org chart.',
    expect: [e('livediagram', 'update_document', ORG)],
  },
  {
    id: 'add-slide',
    ask: 'Add a slide to the Q3 review about hiring.',
    expect: [e('livedocuments', 'change_pages', Q3)],
  },
  {
    id: 'edit-article',
    ask: 'Rewrite the Onboarding guide article to include a section on laptops.',
    expect: [e('livedocuments', 'write_article', ONB)],
  },
  {
    id: 'add-cards',
    ask: 'Add three tasks to the Launch plan: write blog post, record demo, email customers.',
    expect: [e('liveplanner', 'change_items', LAUNCH)],
  },
  {
    id: 'move-card',
    ask: 'Move "Record demo" to Done on the Launch plan.',
    expect: [e('liveplanner', 'change_items', LAUNCH)],
  },
  {
    id: 'retro-to-plan',
    ask: 'Turn the action points from the Sprint 14 retro into tasks on the Launch plan.',
    expect: [e('liveplanner', 'change_items', LAUNCH), e('liveplanner', 'list_items', RETRO)],
  },
  {
    id: 'sheet-edit',
    ask: 'Set the Marketing row of the Budget sheet in the Launch plan to 12000.',
    expect: [e('liveplanner', 'change_sheet', { ...LAUNCH, sheet: 'Budget' })],
  },
  {
    id: 'add-sheet',
    ask: 'Add a sheet for tracking ad spend to the Launch plan.',
    expect: [e('liveplanner', 'add_sheet', LAUNCH)],
  },
  {
    id: 'add-board',
    ask: 'Add a bug triage board to the Launch plan.',
    expect: [e('liveplanner', 'add_board', LAUNCH)],
  },
  {
    id: 'card-types',
    ask: 'Give the Launch plan a "Bug" card type with a Severity field.',
    expect: [e('liveplanner', 'change_card_types', LAUNCH)],
  },
  {
    id: 'edit-design',
    ask: 'Make the Acme logo text bigger and navy.',
    expect: [e('livedesign', 'update_design', LOGO), e('livedesign', 'change_pages', LOGO)],
  },
  {
    id: 'kb-write',
    ask: 'Update the "Expenses" page of the team handbook: the limit is now £50.',
    expect: [
      e('liveknowledge', 'write_page', { ...HB, page: 'Expenses' }),
      e('liveknowledge', 'suggest_edit', { ...HB, page: 'Expenses' }),
    ],
  },
  {
    id: 'kb-gap',
    ask: 'The handbook doesn’t cover parental leave. Flag that to the team.',
    expect: [e('liveknowledge', 'report_gap', HB)],
  },
  {
    id: 'add-tab',
    ask: 'Add a new tab called "Mobile" to the Checkout flow diagram.',
    expect: [e('livediagram', 'add_tab', { ...D, name: 'Mobile' })],
  },
  {
    id: 'comment',
    ask: 'Leave a comment on the Q3 review asking Sam to check the revenue numbers.',
    expect: [e('livedocuments', 'change_threads', Q3)],
  },
  {
    id: 'comments-read',
    ask: 'Are there any open comments on the Checkout flow diagram?',
    expect: [e('livediagram', 'list_threads', D)],
  },
  {
    id: 'icon',
    ask: 'Find a shopping cart icon for the Checkout flow diagram.',
    expect: [e('livediagram', 'search_icons', { query: 'cart' })],
  },
  {
    id: 'templates-plan',
    ask: 'Which plan templates are there?',
    expect: [e('liveplanner', 'list_templates')],
  },
  {
    id: 'automation',
    ask: 'On the Launch plan, when a card moves to Done, notify me. Set that up.',
    expect: [e('liveplanner', 'change_rules', LAUNCH)],
  },
  {
    id: 'version',
    ask: 'Undo yesterday’s changes to the Q3 review: go back to an earlier version.',
    expect: [e('livedocuments', 'list_versions', Q3), e('livedocuments', 'restore_version', Q3)],
  },
  {
    id: 'image-upload',
    ask: 'Use this photo in the Acme logo design: https://example.com/team.jpg',
    expect: [e('livedesign', 'upload_image')],
  },
  {
    id: 'preview',
    ask: 'Show me a picture of the Checkout flow diagram.',
    expect: [
      e('livediagram', 'read_document', { ...D, image: 'true' }),
      e('livediagram', 'view_tab', D),
    ],
  },

  // Item chores
  {
    id: 'share-diagram',
    ask: 'Share the Checkout flow diagram so people can only view it.',
    expect: [e('livediagram', 'share_document', { ...D, role: 'view' })],
  },
  {
    id: 'share-plan',
    ask: 'Give me a link to the Sprint 14 retro that the team can add to.',
    expect: [e('liveplanner', 'share_project', RETRO)],
  },
  {
    id: 'share-kb',
    ask: 'Share the team handbook with read-only access.',
    expect: [e('liveknowledge', 'share_document', { ...HB, role: 'view' })],
  },
  {
    id: 'restyle-diagram',
    ask: 'Switch the Checkout flow diagram to the forest theme.',
    expect: [e('livediagram', 'style_document', { ...D, theme: 'forest' })],
  },
  {
    id: 'restyle-deck',
    ask: 'Give the Q3 review deck a sketchy hand-drawn finish.',
    expect: [e('livedocuments', 'style_document', { ...Q3, finish: 'sketch' })],
  },
  {
    id: 'rename-deck',
    ask: 'Rename the Q3 review deck to "Q3 board review".',
    expect: [e('livedocuments', 'rename_document', { ...Q3, name: 'Q3 board review' })],
  },
  {
    id: 'rename-design',
    ask: 'Call the Acme logo design "Acme logo v2" instead.',
    expect: [e('livedesign', 'rename_design', { ...LOGO, name: 'v2' })],
  },
  {
    id: 'trash-plan',
    ask: 'Delete the Sprint 14 retro, we are done with it.',
    expect: [e('liveplanner', 'delete_project', RETRO)],
  },
  {
    id: 'archive-diagram',
    ask: 'Archive the Org chart.',
    expect: [e('livediagram', 'archive_document', ORG)],
  },
  {
    id: 'restore-design',
    ask: 'Bring the Acme logo design back from the Trash.',
    expect: [e('livedesign', 'restore_design', LOGO)],
  },
];

/** The items as the five app servers' setup tells them: each app's own id. */
export function itemsForApps(): string {
  return ITEMS.map((i) => `- ${i.name}: ${i.app} id ${i.id}`).join('\n');
}

/** The items as the one MCP tells them: refs. */
export function itemsForOne(): string {
  return ITEMS.map((i) => `- ${i.name}: ${i.kind}:${i.id}`).join('\n');
}
