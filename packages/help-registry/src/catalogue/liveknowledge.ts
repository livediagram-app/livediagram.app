// The liveknowledge help catalogue: its categories and the articles only liveknowledge has
// (liveworkspace/docs/specs/017-help/help-centre.md "liveknowledge"). Articles several apps share live in ./shared/,
// each naming liveknowledge in its `apps` where it applies. A knowledgebase is pages of writing in a tree, so its
// help has no Canvas, Palette, Selection Modes, Tabs or Pages (page kinds) category: what only liveknowledge has is
// one feature category, Knowledgebase, in groups.

import type { Article, Category } from '../types';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About liveknowledge',
    description:
      'Get to know liveknowledge: a free, open-source Knowledgebase a team writes, verifies and asks questions of.',
    articleCount: 3,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a new Knowledgebase to pages your team can find and trust, with the basics every new user needs.',
    articleCount: 5,
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description:
      'Stay in control of your work: guest access, signing in, the Trash, deleting your data, API tokens, the Google Drive mirror and email notifications.',
    articleCount: 7,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your knowledgebases are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Read and write a Knowledgebase from an AI agent, the command line or your own scripts: the MCP tools, the CLI and the knowledge API.',
    articleCount: 6,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description:
      'Get unstuck fast: Ask and its key, reviews, imports, agents, sign-in and collaboration problems.',
    articleCount: 8,
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
  // Feature-guide categories (kind: 'feature'), shown under Editor Guides on the home, each with a card-grid index at
  // /help/<slug>/. Knowledgebase leads: it is what the app is for.
  {
    slug: 'knowledgebase',
    title: 'Knowledgebase',
    description:
      'Everything a Knowledgebase does: the page tree, writing, links, verified pages, search, Ask, AI Knowledge, style, settings, import and export.',
    articleCount: 24,
    kind: 'feature',
    groups: [
      'Pages',
      'Trust',
      'Finding Things',
      'AI Knowledge',
      'Style and Settings',
      'Import and Export',
      'Roles',
    ],
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work on a Knowledgebase together: sharing and roles, comments, live presence, teams, snapshots and the Community.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you make: one library, shared by every liveworkspace app, that keeps your knowledgebases, folders and teams easy to find.',
    articleCount: 12,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets and Imports'],
  },
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Your own preferences for the editor: the Settings every liveworkspace app shares.',
    articleCount: 1,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Let a Knowledgebase run its routine on its own: Automations, rules that ask for reviews, tell Slack and keep pages owned.',
    articleCount: 1,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'One search over everything you can reach: the pages of this Knowledgebase first, then your other work, commands, settings and help.',
    articleCount: 1,
    kind: 'feature',
  },
];

const KNOWLEDGEBASE = { category: 'Knowledgebase', categorySlug: 'knowledgebase' } as const;
const APPS = { apps: ['liveknowledge'] } as const;

export const articles: Article[] = [
  // ---- About ----
  {
    slug: 'what-is-liveknowledge',
    title: 'What Is liveknowledge?',
    description:
      'A Knowledgebase for a team: pages of writing in a tree, each with an owner who vouches for it, that people and AI agents can ask.',
    keywords:
      'overview intro introduction about product knowledgebase knowledge base wiki handbook docs documentation team pages verified ask ai agents',
    category: 'About liveknowledge',
    categorySlug: 'about',
    parentSlug: 'about',
    ...APPS,
  },
  // ---- Getting Started ----
  {
    slug: 'your-first-knowledgebase',
    title: 'Your First Knowledgebase',
    description:
      'From a new Knowledgebase to a few linked pages your team can read, in a couple of minutes.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding start here untitled knowledgebase first page subpage share',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    ...APPS,
  },
  {
    slug: 'describe-to-set-up',
    title: 'Describe to Set Up',
    description:
      'Say what the Knowledgebase is for and get a page structure to review, rename and create.',
    keywords:
      'describe set up setup structure outline scaffold generate ai suggest a structure create pages describe to add pages empty knowledgebase starter',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    ...APPS,
  },
  {
    slug: 'knowledgebase-home',
    title: 'Knowledgebase Home',
    description:
      'The start of liveknowledge when you are signed in: search every Knowledgebase, ask a question, and see what changed.',
    keywords:
      'home start page dashboard landing knowledgebases cards verified share recently updated yours to review ask again start a page from import',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    ...APPS,
  },
  // ---- Knowledgebase: Pages ----
  {
    slug: 'the-page-tree',
    title: 'The Page Tree',
    description:
      'Add pages and subpages, rename, move, indent, duplicate and delete them in the sidebar.',
    keywords:
      'page tree sidebar pages subpage nested hierarchy outline add new page rename move reorder drag indent outdent duplicate delete undo copy link breadcrumb 500 pages 8 levels limit collapse',
    ...KNOWLEDGEBASE,
    group: 'Pages',
    ...APPS,
  },
  {
    slug: 'writing-on-a-page',
    title: 'Writing on a Page',
    description:
      'One continuous page of writing: the formatting row, headings, lists, tables, contents, footnotes, margin notes, pictures, charts and drawings.',
    keywords:
      'write writing text editor format formatting bold italic heading list table contents footnote margin note picture image chart drawing slash menu insert markdown paste code quote callout',
    ...KNOWLEDGEBASE,
    group: 'Pages',
    ...APPS,
  },
  {
    slug: 'linking-pages',
    title: 'Linking Pages',
    description:
      'Type [[ to link one page to another, make a page from a link, and see what links here under Linked From.',
    keywords:
      'link page link wiki link double bracket [[ backlink backlinks linked from create page mention reference deleted page cross reference',
    ...KNOWLEDGEBASE,
    group: 'Pages',
    ...APPS,
  },
  {
    slug: 'embedding-from-other-apps',
    title: 'Embedding From Other Apps',
    description:
      'Show a diagram, plan, document, design or Space from another liveworkspace app inside a page.',
    keywords:
      'embed embedding live embed diagram plan board document design space livediagram liveplanner livedocuments livedesign livehuddle youtube figma loom website iframe',
    ...KNOWLEDGEBASE,
    group: 'Pages',
    ...APPS,
  },
  {
    slug: 'watching-a-page',
    title: 'Watching a Page',
    description:
      'Hear when a page, or a section of pages, changes: in your Inbox, and in a daily email if you want one.',
    keywords:
      'watch watching unwatch follow subscribe notify notification alert updates changes section subpages inbox daily digest email watchers',
    ...KNOWLEDGEBASE,
    group: 'Pages',
    ...APPS,
  },
  // ---- Knowledgebase: Trust ----
  {
    slug: 'owners-and-verifying',
    title: 'Owners and Verifying a Page',
    description:
      'Give a page an owner and press Verify to say it is right. Everyone sees who vouched for it and when.',
    keywords:
      'owner verify verified verification tick trust vouch approve confirm correct accurate stamp verify again changed since verified never verified',
    ...KNOWLEDGEBASE,
    group: 'Trust',
    ...APPS,
  },
  {
    slug: 'review-due-and-the-review-period',
    title: 'Review Due and the Review Period',
    description:
      'A verified page comes due for review after the Review Period, one setting for the whole Knowledgebase.',
    keywords:
      'review due review period stale expire expiry outdated out of date 30 90 180 days year never reviews freshness re-verify amber pill',
    ...KNOWLEDGEBASE,
    group: 'Trust',
    ...APPS,
  },
  {
    slug: 'page-health',
    title: 'Page Health',
    description:
      'The card beside a page: its owner, when it was verified, when its review is due and how often it is read.',
    keywords:
      'page health page info on this page right rail owner last verified review due reads by people reads by agents this week verify again outline headings',
    ...KNOWLEDGEBASE,
    group: 'Trust',
    ...APPS,
  },
  {
    slug: 'knowledge-health-and-reminders',
    title: 'Knowledge Health and Reminders',
    description:
      'See how much of a Knowledgebase is verified, remind the owners, and choose whether review emails reach you.',
    keywords:
      'knowledge health verified share stacked bar remind the owners reminder email pages due for review pages to review knowledgebase reviews notification setting unsubscribe',
    ...KNOWLEDGEBASE,
    group: 'Trust',
    ...APPS,
  },
  // ---- Knowledgebase: Finding Things ----
  {
    slug: 'searching-a-knowledgebase',
    title: 'Search',
    description:
      'Press Cmd or Ctrl K to search the pages of this Knowledgebase first, then everything else you can reach.',
    keywords:
      'search find look up cmd k ctrl k this knowledgebase passages titles results no pages match recent pages universal search keyword query',
    ...KNOWLEDGEBASE,
    group: 'Finding Things',
    ...APPS,
  },
  {
    slug: 'ask',
    title: 'Ask',
    description:
      'Ask a question in plain words and get an answer written from your own pages, with a citation for every claim.',
    keywords:
      'ask question answer ai chat assistant citations cited sources found but not used knowledge gap draft a page save as page limits 20 an hour 200 a day follow-up',
    ...KNOWLEDGEBASE,
    group: 'Finding Things',
    ...APPS,
  },
  {
    slug: 'ai-settings',
    title: 'AI Settings',
    description:
      "Add your team's Claude or OpenAI key so Ask can answer: the provider, the key, the model and who pays.",
    keywords:
      'ai settings api key bring your own key byok provider anthropic claude openai model replace remove key encrypted who pays cost billing',
    ...KNOWLEDGEBASE,
    group: 'Finding Things',
    ...APPS,
  },
  // ---- Knowledgebase: AI Knowledge ----
  {
    slug: 'connecting-an-agent',
    title: 'Connecting an Agent',
    description:
      'Connect an AI agent to a Knowledgebase over the MCP server, the command line or an API token.',
    keywords:
      'connect an agent mcp server model context protocol claude cursor cli command line api token connector agents ai tools setup install auth login',
    ...KNOWLEDGEBASE,
    group: 'AI Knowledge',
    ...APPS,
  },
  {
    slug: 'what-agents-can-do',
    title: 'What Agents Can Do',
    description:
      'A new connection reads, searches and suggests. An Editor can allow one to write, never over a verified page.',
    keywords:
      'agents permissions scopes read suggest write allow writing stop writing reads suggests edits writes connected agents verified review due protected what an agent sees',
    ...KNOWLEDGEBASE,
    group: 'AI Knowledge',
    ...APPS,
  },
  {
    slug: 'suggested-edits',
    title: 'Suggested Edits',
    description:
      "Review an agent's suggested change to a page: read what it takes out and puts in, then accept or dismiss it.",
    keywords:
      'suggested edits edits suggested by agents suggestion review accept dismiss open the page change diff removed added lines reason agent proposal',
    ...KNOWLEDGEBASE,
    group: 'AI Knowledge',
    ...APPS,
  },
  {
    slug: 'questions-nobody-could-answer',
    title: 'Questions Nobody Could Answer',
    description:
      'The questions people and agents asked that no page covers, and how to draft a page for one.',
    keywords:
      'questions nobody could answer knowledge gap gaps unanswered missing draft a page dismiss asked times report gap coverage',
    ...KNOWLEDGEBASE,
    group: 'AI Knowledge',
    ...APPS,
  },
  {
    slug: 'pages-that-disagree',
    title: 'Pages That Disagree',
    description:
      'When two pages state opposite facts, AI Knowledge shows both passages so you can say which is right.',
    keywords:
      'pages that disagree conflict conflicts contradiction contradict opposite facts is right fix the other ask both owners not a conflict two pages disagree',
    ...KNOWLEDGEBASE,
    group: 'AI Knowledge',
    ...APPS,
  },
  {
    slug: 'always-in-context',
    title: 'Always in Context',
    description:
      'Choose the pages every agent is handed before it starts, within a budget of 8,000 tokens.',
    keywords:
      'always in context context pages get_context budget tokens 8000 add a page agents start pinned system prompt background',
    ...KNOWLEDGEBASE,
    group: 'AI Knowledge',
    ...APPS,
  },
  // ---- Knowledgebase: Style and Settings ----
  {
    slug: 'knowledgebase-style',
    title: 'Knowledgebase Style',
    description:
      'Pick one look for every page of a Knowledgebase: a theme, fonts, text size, spacing and an accent colour.',
    keywords:
      'knowledgebase style look theme font fonts text size line spacing heading style accent colour color fine-tune mashup seasonal lime appearance design',
    ...KNOWLEDGEBASE,
    group: 'Style and Settings',
    ...APPS,
  },
  // ---- Knowledgebase: Import and Export ----
  {
    slug: 'import-a-markdown-folder',
    title: 'Import From a Markdown Folder',
    description:
      'Bring a folder or a .zip of Markdown files in as pages, with its folders as the page tree.',
    keywords:
      'import markdown folder zip md files readme index obsidian docs folder pictures links page tree a whole knowledgebase 200 mb 500 pages',
    ...KNOWLEDGEBASE,
    group: 'Import and Export',
    ...APPS,
  },
  {
    slug: 'import-from-notion',
    title: 'Import From Notion',
    description:
      'Bring a Notion export in as pages: what comes across, what changes and what is left out.',
    keywords:
      'import notion export markdown csv zip migrate move database table callout toggle workspace switch from notion',
    ...KNOWLEDGEBASE,
    group: 'Import and Export',
    ...APPS,
  },
  {
    slug: 'import-from-confluence',
    title: 'Import From Confluence',
    description:
      "Bring a Confluence space's HTML export in as pages: what comes across, what changes and what is left out.",
    keywords:
      'import confluence space html export zip migrate move atlassian macros info note warning code mentions switch from confluence',
    ...KNOWLEDGEBASE,
    group: 'Import and Export',
    ...APPS,
  },
  {
    slug: 'exporting-a-knowledgebase',
    title: 'Exporting a Knowledgebase',
    description:
      'Save a page as Markdown, PDF or Word, or a whole Knowledgebase as a folder of Markdown.',
    keywords:
      'export exporting download save markdown md pdf word docx backup folder print offline copy take out',
    ...KNOWLEDGEBASE,
    group: 'Import and Export',
    ...APPS,
  },
  {
    slug: 'publishing-to-the-web',
    title: 'Publishing to the Web',
    description:
      'Put a Knowledgebase, or one section of it, on the web as a public help centre anyone can read.',
    keywords:
      'publish publishing to the web public site help centre center docs website share publicly anyone link address url slug seo search engines noindex sitemap unpublish take down read only',
    ...KNOWLEDGEBASE,
    group: 'Import and Export',
    ...APPS,
  },
  // ---- Knowledgebase: Roles ----
  {
    slug: 'knowledgebase-roles',
    title: 'Roles in a Knowledgebase',
    description: 'What an Editor, a Participant and a Viewer can each do, feature by feature.',
    keywords:
      'roles permissions editor participant viewer access rights who can table share role verify ask import export agents comment read only',
    ...KNOWLEDGEBASE,
    group: 'Roles',
    ...APPS,
  },
  // ---- Developers ----
  {
    slug: 'liveknowledge-mcp-tools',
    title: 'The liveknowledge MCP Tools',
    description:
      'The tools an AI agent gets from the liveknowledge MCP server, what each returns and which scope it needs.',
    keywords:
      'mcp tools get_context list_pages search_pages read_page create_page suggest_edit write_page move_page request_approval list_page_comments change_page_comments report_gap scopes read suggest write trust fields verified stale',
    category: 'Developers',
    categorySlug: 'developers',
    ...APPS,
  },
  {
    slug: 'liveknowledge-cli',
    title: 'The liveknowledge CLI',
    description:
      'Read, search, write, import and export a Knowledgebase from a terminal with the liveknowledge command.',
    keywords:
      'cli command line terminal npm liveknowledge pages search read new suggest write move context gap import export auth login script shell',
    category: 'Developers',
    categorySlug: 'developers',
    ...APPS,
  },
  {
    slug: 'knowledge-api',
    title: 'The Knowledge API',
    description:
      'The REST routes behind pages, search, Ask and AI Knowledge, and where to find their OpenAPI reference.',
    keywords:
      'api rest routes endpoints openapi json http curl bearer token pages knowledge search ask summary knowledge-settings suggestions scopes',
    category: 'Developers',
    categorySlug: 'developers',
    ...APPS,
  },
  // ---- Troubleshooting ----
  {
    slug: 'ask-is-not-answering',
    title: 'Ask Is Not Answering',
    description:
      'What to do when Ask says the key was not accepted, there is no credit, or it is rate limited.',
    keywords:
      'ask error key not accepted invalid key no credit billing rate limited busy overloaded 20 questions an hour 200 a day failed refused lost connection',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    ...APPS,
  },
  {
    slug: 'review-due-everywhere',
    title: 'Review Due on Every Page',
    description:
      'Why many pages turned Review Due at once after the Review Period changed, and how to put it right.',
    keywords:
      'review due everywhere all pages amber after changing period shorter period undo never many pages due at once',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    ...APPS,
  },
  {
    slug: 'an-import-left-pages-out',
    title: 'An Import Left Pages Out',
    description:
      'Why an import skipped pages, pictures or attachments, and how to bring the rest in.',
    keywords:
      'import missing pages skipped left out failed too big 200 mb 500 pages 10 mb picture attachments not imported no pages found cancelled',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    ...APPS,
  },
  {
    slug: 'an-agent-cannot-write',
    title: 'An Agent Cannot Write',
    description:
      "Why an agent's write was refused, and whether to allow writing or have it suggest the edit.",
    keywords:
      'agent cannot write refused forbidden write_page page_verified page_review_due allow writing read-only token scope suggest instead viewer participant',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    ...APPS,
  },
];
