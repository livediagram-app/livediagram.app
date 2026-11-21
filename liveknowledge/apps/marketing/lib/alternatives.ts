import type { Alternative, ComparisonRow, Comparisons, Faq } from '@liveworkspace/comparisons';
import { SITE_URL } from '@liveknowledge/ui';

// liveknowledge's comparisons, drawn by @liveworkspace/comparisons (packages/comparisons/README.md
// "liveknowledge"). The hub, every page, their metadata and the sitemap read this list, so adding a
// competitor is a one-place change. Bump the date with any change to them.
//
// Each tool is compared at its own job, a team's knowledge tool. What is said of a competitor is its category and
// what it is widely known for, never a price, a limit or a plan's contents. Every page says where liveknowledge
// is behind: databases, page-level permissions, integrations, a native mobile app, semantic search, public sites.
const UPDATED = new Date('2026-11-20');

// Our side of the rows most pages share, written once so the six pages cannot drift apart.
const US = {
  price: 'Free to start. Ask runs on built-in AI, included, or your own key',
  open: 'Yes, MIT-licensed',
  account:
    'Yes: write as a guest, kept in your browser. Verify, Ask and sharing need a free account',
  trust:
    'An owner, a verified tick with a name and a date, and a review that comes due, on every page',
  ask: 'Cited answers from your pages on built-in AI, or your own Claude or OpenAI key. It says what the pages do not cover',
  agents:
    'An MCP server and a CLI in pages and passages, trust fields on every passage, edits as suggestions',
  permissions: 'Per knowledgebase: Editor, Participant, Viewer. No page-level permissions',
  search: 'Keyword search over passages. No semantic search',
  mobile: 'In a phone’s browser. No native app',
  integrations:
    'Live embeds from the other liveworkspace apps, a REST API, the MCP server and the CLI',
  publish: 'View-only share links. No public site with its own domain',
};

const row = (label: string, us: string, them: string): ComparisonRow => ({ label, us, them });

const FREE_FAQ: Faq = {
  q: 'Is liveknowledge really free?',
  a: 'It is MIT-licensed open source, and the hosted version is free to start. Ask runs on built-in AI, included at no cost; a team may add its own Claude or OpenAI key instead.',
};

const AGENTS_SECTION = {
  heading: 'Agents as readers',
  paragraphs: [
    'liveknowledge treats an agent as a reader with the same rights as the person it acts for. Its MCP server and command line speak in pages and passages: the pages a team marks Always in Context first, then passages by search, then a whole page when it is needed.',
    'Every passage arrives with how far to trust it: whether the page is verified, when, whether its review is due, and any page it is known to disagree with. An agent’s edit lands as a suggestion a person accepts, and a question no page answered is recorded so someone can write that page.',
  ],
};

const LIST: Alternative[] = [
  {
    slug: 'notion-wiki',
    name: 'Notion',
    highlights: ['Verified pages', 'Cited answers', 'Open source'],
    title: 'Notion wiki alternative · liveknowledge',
    description:
      'An open-source alternative to a Notion wiki: pages with owners and verified dates, cited answers on built-in AI or your own key, and an MCP server for agents.',
    h1: 'An open-source alternative to a Notion wiki',
    lede: 'Notion is a whole workspace: documents, databases and wikis in one place, and many teams keep their knowledge there. liveknowledge does one of those jobs, the one a team wiki does, and builds it around a question that is easy to leave to habit: can this page still be trusted, by a person and by an agent?',
    rows: [
      row('Price', US.price, 'A free plan, then paid plans'),
      row('Open source', US.open, 'No, proprietary'),
      row('Start without an account', US.account, 'An account to create pages'),
      row('Page trust', US.trust, 'Wikis can mark pages verified and give them owners'),
      row('AI answers', US.ask, 'Its own built-in AI, part of Notion’s plans'),
      row('Agents', US.agents, 'An API and its own connections for AI tools'),
      row(
        'Structure',
        'A page tree of writing, with tables in the text. No databases',
        'Pages plus databases with table, board, calendar and timeline views',
      ),
      row('Permissions', US.permissions, 'Down to the page'),
      row('Mobile', US.mobile, 'Native mobile and desktop apps'),
      row('Publishing', US.publish, 'Pages can be published to the web'),
    ],
    themBest: [
      'You want databases: tables, boards, calendars and timelines over the same rows, with relations between them. liveknowledge has tables in the writing and nothing more.',
      'You need permissions down to a single page. liveknowledge shares a whole knowledgebase at once.',
      'You want one tool for notes, projects and documents, with a large template gallery, a wide range of integrations and mature mobile and desktop apps.',
      'You want AI that drafts and edits inside the writing itself, paid for with the plan.',
    ],
    usBest: [
      'Every page has an owner, a verified date and a review that comes due, in every knowledgebase, with nothing to switch on.',
      'Ask answers only from your pages, numbers every claim to its passage and says what the pages do not cover.',
      'Agents get the same pages with the trust fields attached, and their edits arrive as suggestions.',
      'It is MIT-licensed and free to start, with built-in AI included and your own key optional.',
      'A Notion export imports in one step, with its page hierarchy and the links between pages.',
    ],
    sections: [
      {
        heading: 'Pages that say whether they are still right',
        paragraphs: [
          'A page in liveknowledge has an owner and shows who verified it and when. The knowledgebase has one Review Period, and once it passes a page reads Review Due until someone checks it again. The Knowledgebase Home lists the pages you own that are due, oldest first.',
          'Notion’s wikis can verify pages too, so this is shared ground. The difference is where it leads: in liveknowledge the same state travels with every passage an answer cites and every passage an agent reads.',
        ],
      },
      AGENTS_SECTION,
      {
        heading: 'Moving from Notion',
        paragraphs: [
          'Export a workspace or a page from Notion as Markdown and CSV, and choose Notion in liveknowledge’s Import dialog. The nested folders become the page tree, links between pages become page links, pictures come with them, and a database’s CSV becomes a table on its page.',
          'What does not come across is what liveknowledge does not have: a database’s views, relations and filters. Imported pages start unverified, with no owner, so the first review is yours.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I import my Notion workspace?',
        a: 'Yes. Export it from Notion as Markdown and CSV and choose Notion in the Import dialog. Pages, their hierarchy, the links between them and pictures come across; a database arrives as a table, without its views.',
      },
      {
        q: 'Does liveknowledge have databases like Notion?',
        a: 'No. A page can hold tables in its writing, but there are no database views, relations or filters. If your team runs on Notion databases, Notion is the better fit for that work.',
      },
      {
        q: 'Do I pay for AI?',
        a: 'No. Ask runs on built-in AI, included with daily limits. A team may add its own Claude or OpenAI key instead, paid to that provider. Search, verification and the agent connection need no AI.',
      },
      FREE_FAQ,
    ],
  },
  {
    slug: 'confluence',
    name: 'Confluence',
    highlights: ['Verified pages', 'Agents read it', 'Confluence import'],
    title: 'Confluence alternative · liveknowledge',
    description:
      'An open-source Confluence alternative: a page tree with owners and verified dates, cited answers on built-in AI or your own key, and import from a space export.',
    h1: 'An open-source Confluence alternative',
    lede: 'Confluence is the team wiki many companies already run, close to Jira and the rest of Atlassian. liveknowledge is a smaller, newer knowledgebase with a narrower aim: every page says who vouches for it and when, and your agents read those pages with that trust attached.',
    rows: [
      row('Price', US.price, 'A free plan for small teams, then paid plans'),
      row('Open source', US.open, 'No, proprietary'),
      row('Start without an account', US.account, 'An Atlassian account'),
      row('Page trust', US.trust, 'Page history, owners and labels; more through apps'),
      row('AI answers', US.ask, 'Atlassian’s own AI features'),
      row('Agents', US.agents, 'APIs and Atlassian’s own connections for AI tools'),
      row(
        'Structure',
        'Knowledgebases, each a page tree up to eight levels deep',
        'Spaces, each a page tree, with templates and macros',
      ),
      row('Permissions', US.permissions, 'Space permissions and page restrictions'),
      row('Integrations', US.integrations, 'Jira and a large marketplace of apps'),
      row('Mobile', US.mobile, 'Native mobile apps'),
    ],
    themBest: [
      'Your team lives in Jira: issues, roadmaps and pages link to each other, and that link is the point.',
      'You need page restrictions inside a space, or an administrator’s controls over a large organisation.',
      'You rely on macros and marketplace apps, which liveknowledge has no equivalent of.',
      'You need native mobile apps, or a version you run in your own data centre.',
    ],
    usBest: [
      'Trust is on the page: an owner, a verified tick with a name and a date, and a review that comes due.',
      'Ask cites every claim to a passage and its verifier, and says what the pages do not cover.',
      'Agents read through an MCP server and a CLI that hand over the trust fields with each passage.',
      'MIT-licensed and free to start.',
      'A space’s HTML export imports with its page tree, links and pictures.',
    ],
    sections: [
      {
        heading: 'Knowledge that ages in the open',
        paragraphs: [
          'Most team knowledge goes stale quietly. In liveknowledge a page’s review comes due after the knowledgebase’s Review Period, and the page says so, in the page tree, on the page and on every link to it. Its owner presses Still Right, or fixes it.',
          'Knowledge Health shows a whole knowledgebase as one bar: verified, review due and never verified. It is bookkeeping the product already has, so it needs no model at all.',
        ],
      },
      AGENTS_SECTION,
      {
        heading: 'Moving from Confluence',
        paragraphs: [
          'Export a space as HTML and choose Confluence in liveknowledge’s Import dialog. The space’s page tree becomes the knowledgebase’s, links between pages become page links and pictures come with them. Info, note and warning boxes become quotes, and code blocks stay code.',
          'Other macros fall back to their text, mentions become plain names, and attachments other than pictures are listed by name, since liveknowledge stores pictures only. The dialog shows what it found, and what it will leave out, before anything is imported.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I import a Confluence space?',
        a: 'Yes. Export the space as HTML and choose Confluence in the Import dialog. The page tree, links between pages and pictures come across. Macros other than info, note, warning and code fall back to their text.',
      },
      {
        q: 'Does liveknowledge connect to Jira?',
        a: 'No. There is no Jira integration. liveknowledge embeds items from the other liveworkspace apps, and has a REST API, an MCP server and a command line.',
      },
      {
        q: 'Can I restrict one page to a few people?',
        a: 'No. Sharing is per knowledgebase, with Editor, Participant and Viewer roles. Pages that fewer people should see go in a knowledgebase of their own.',
      },
      FREE_FAQ,
    ],
  },
  {
    slug: 'slite',
    name: 'Slite',
    highlights: ['AI included', 'Agents read it', 'Open source'],
    title: 'Slite alternative · liveknowledge',
    description:
      'An open-source Slite alternative: verified pages, cited answers on built-in AI or your own key, and an MCP server that hands agents each passage with its trust.',
    h1: 'An open-source Slite alternative',
    lede: 'Slite is a team knowledge tool built around the same ideas liveknowledge cares about: documents that are verified, and answers that come with their sources. The two are close. They differ in how the AI is paid for, in how agents read, and in being open source.',
    rows: [
      row('Price', US.price, 'Paid plans'),
      row('Open source', US.open, 'No, proprietary'),
      row('Start without an account', US.account, 'An account to create documents'),
      row('Page trust', US.trust, 'Document verification with an expiry'),
      row('AI answers', US.ask, 'Its own AI answers with sources, part of its plans'),
      row('Agents', US.agents, 'An API and integrations'),
      row('Search', US.search, 'AI-assisted search across documents'),
      row('Integrations', US.integrations, 'Integrations with chat and other work tools'),
      row('Mobile', US.mobile, 'Native apps'),
    ],
    themBest: [
      'You want AI answers with no daily limits and no key of your own to add.',
      'You want search that understands meaning, not just the words on the page.',
      'You want integrations with your chat tool and the other tools your team already uses.',
      'You want a polished, focused product with native apps and a company’s support behind it.',
    ],
    usBest: [
      'Ask runs on built-in AI, included, or on your own Claude or OpenAI key with the model you choose.',
      'Agents are first-class readers, through an MCP server and a CLI with trust fields on every passage.',
      'AI Knowledge shows which agents read what, and the questions nobody could answer.',
      'MIT-licensed and free to start.',
      'It sits in a workspace: a page embeds a live diagram, board, document or design from the other apps.',
    ],
    sections: [
      {
        heading: 'Shared ground: verified knowledge and cited answers',
        paragraphs: [
          'Both tools let a team mark a document as verified for a period, and both answer questions with their sources. If that is what you came for, either will do it.',
          'In liveknowledge an answer also carries a trust line, saying how many of the pages it used are verified, and sets aside a stale passage that disagrees with a newer verified one. What it cannot answer becomes a Knowledge Gap, counted each time it is asked.',
        ],
      },
      AGENTS_SECTION,
      {
        heading: 'How the AI is paid for',
        paragraphs: [
          'Ask runs on built-in AI that liveknowledge pays for, with daily limits: 30 questions a person and 100 a knowledgebase. A team that wants more may add its own Claude or OpenAI key in AI Settings; it is encrypted, never shown again, and everything then runs on it. Search needs no AI at all.',
          'That is a trade. The included AI has limits, and going past them means your team brings a key and carries that cost. In return there is no plan to choose and no seat to pay for.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I import from Slite?',
        a: 'There is no Slite importer. If you can export your documents as Markdown files, liveknowledge’s Markdown Folder import reads the folder, keeps its structure as the page tree and turns links between files into page links.',
      },
      {
        q: 'Does liveknowledge verify documents like Slite?',
        a: 'Yes. Each page has an owner and a verified tick with who and when, and the knowledgebase has one Review Period of 30, 90, 180 or 365 days. When it passes, a page reads Review Due.',
      },
      {
        q: 'Do I need a Claude or OpenAI key to use it?',
        a: 'No. Ask and finding pages that disagree run on built-in AI, included. A key of your own is optional. Writing, search, verification, import, export and the agent connection need no AI.',
      },
      FREE_FAQ,
    ],
  },
  {
    slug: 'guru',
    name: 'Guru',
    highlights: ['Verified pages', 'Pages, not cards', 'Open source'],
    title: 'Guru alternative · liveknowledge',
    description:
      'An open-source Guru alternative: knowledge that is verified on a schedule, cited answers on built-in AI or your own key, and an MCP server for your agents.',
    h1: 'An open-source Guru alternative',
    lede: 'Guru made verification the centre of a knowledge tool: every card has an expert who confirms it on a schedule, and the answer reaches people where they work. liveknowledge shares the first idea and is much smaller on the second.',
    rows: [
      row('Price', US.price, 'Paid plans'),
      row('Open source', US.open, 'No, proprietary'),
      row('Start without an account', US.account, 'An account to create cards'),
      row('Page trust', US.trust, 'Cards verified by an expert on an interval'),
      row('AI answers', US.ask, 'Its own AI answers, with sources'),
      row('Agents', US.agents, 'An API and its own connections for AI tools'),
      row(
        'Structure',
        'Long pages in a page tree, linked to each other',
        'Short cards in collections',
      ),
      row('Search', US.search, 'Search across Guru and the apps you connect'),
      row('Integrations', US.integrations, 'A browser extension and integrations with chat tools'),
    ],
    themBest: [
      'You want answers to appear inside the tools people already have open, through a browser extension and chat integrations.',
      'You want one search across your company’s other apps as well as Guru itself.',
      'Your knowledge is short answers for support or sales, which cards suit better than long pages.',
      'You want analytics on what is used and an administrator’s controls for a large team.',
    ],
    usBest: [
      'Verification on every page, with an owner and a review that comes due, at no cost.',
      'Pages rather than cards: a runbook or a handbook stays one piece of writing, with a contents and backlinks.',
      'Agents read through an MCP server and a CLI, and each passage carries its verified state.',
      'Ask runs on built-in AI, or your own key, and says what the pages do not cover.',
      'MIT-licensed and free to start.',
    ],
    sections: [
      {
        heading: 'Verification, as a habit',
        paragraphs: [
          'Guru’s insight is that knowledge needs someone to vouch for it, on a schedule. liveknowledge works the same way: an owner for each page, Verify in one press, and a Review Period after which a page reads Review Due.',
          'A large edit after verifying marks the page Changed Since Verified until someone looks again, so a tick never outlives the words it was given to.',
        ],
      },
      AGENTS_SECTION,
      {
        heading: 'Where Guru reaches further',
        paragraphs: [
          'liveknowledge has no browser extension and no chat integration, and it searches its own pages by keyword. If the value of your knowledge tool is that the answer turns up wherever someone is working, Guru does that and liveknowledge does not.',
          'What liveknowledge offers instead is the other direction: the agent your team already uses comes to the knowledgebase, over MCP, and reads it with the trust attached.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I import from Guru?',
        a: 'There is no Guru importer. If you can get your cards out as Markdown files, the Markdown Folder import reads them, one page per file. Imported pages start unverified, with no owner.',
      },
      {
        q: 'Does liveknowledge work inside Slack or a browser extension?',
        a: 'No. It has neither. People read it in the browser, and agents read it through the MCP server or the command line.',
      },
      {
        q: 'How does verification differ from Guru’s?',
        a: 'It is the same idea: an owner, a verified state and a review period. In liveknowledge that state is also handed to agents with every passage and shown beside every source an answer cites.',
      },
      FREE_FAQ,
    ],
  },
  {
    slug: 'gitbook',
    name: 'GitBook',
    highlights: ['For your team', 'Verified pages', 'Markdown in and out'],
    title: 'GitBook alternative · liveknowledge',
    description:
      'An open-source GitBook alternative for internal knowledge: verified pages, cited answers on built-in AI or your own key, and Markdown in and out.',
    h1: 'An open-source GitBook alternative for internal knowledge',
    lede: 'GitBook is a documentation platform, known for the public docs sites it publishes and for keeping them in step with a Git repository. liveknowledge is for the other half of a team’s writing: what it knows internally, and whether that is still true.',
    rows: [
      row('Price', US.price, 'A free plan, then paid plans'),
      row('Open source', US.open, 'No, proprietary'),
      row('Start without an account', US.account, 'An account to create a space'),
      row('Page trust', US.trust, 'Change requests and page history'),
      row('AI answers', US.ask, 'Its own AI search and assistant'),
      row('Agents', US.agents, 'An API, and published docs any tool can read'),
      row('Publishing', US.publish, 'Public docs sites with custom domains'),
      row(
        'Markdown and Git',
        'Markdown import and export; a whole knowledgebase as a Markdown folder from the CLI',
        'Two-way sync with a Git repository',
      ),
      row('Permissions', US.permissions, 'Per space, and visitor access for published sites'),
    ],
    themBest: [
      'You are publishing documentation for customers: a public site with your own domain, navigation and search. liveknowledge does not publish public sites.',
      'You want your docs to live in a Git repository, reviewed and merged like code.',
      'You are documenting an API and want a platform built for that.',
      'You want changes to go through a review before they are published.',
    ],
    usBest: [
      'It is built for internal knowledge: an owner, a verified date and a review that comes due on every page.',
      'Ask answers from your pages with citations, on built-in AI or your own key.',
      'Agents read over MCP and suggest edits a person accepts, which is its own kind of review.',
      'A knowledgebase exports as a folder of Markdown with relative links, to keep beside a repository.',
      'MIT-licensed and free to start.',
    ],
    sections: [
      {
        heading: 'Internal knowledge is a different job',
        paragraphs: [
          'Public documentation is reviewed before it ships, then read by strangers. Internal knowledge is written quickly by many people and goes stale without anyone deciding it should. liveknowledge is built for the second case: each page has an owner, and its review comes due.',
          'It does not replace a docs site. If your readers are customers, GitBook is the right tool and liveknowledge is not.',
        ],
      },
      AGENTS_SECTION,
      {
        heading: 'Markdown in, Markdown out',
        paragraphs: [
          'A space that syncs to Git is already a folder of Markdown. Choose Markdown Folder in liveknowledge’s Import dialog and the folders become the page tree, with relative links turned into page links and pictures brought along.',
          'The command line exports a knowledgebase back to a folder of Markdown. It is an export you run, not a two-way sync.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I publish a public docs site with liveknowledge?',
        a: 'No. You can share a view-only link, but there is no public site with its own domain or navigation. For customer documentation, GitBook is the better fit.',
      },
      {
        q: 'Can I import from GitBook?',
        a: 'There is no GitBook importer, but a space synced to a Git repository is a folder of Markdown, and the Markdown Folder import reads that with its structure and links.',
      },
      {
        q: 'Does liveknowledge sync with Git?',
        a: 'No. The command line exports a knowledgebase to a Markdown folder and imports one, which you can keep beside a repository. It is not a two-way sync.',
      },
      FREE_FAQ,
    ],
  },
  {
    slug: 'outline',
    name: 'Outline',
    highlights: ['Verified pages', 'Cited answers', 'Agents read it'],
    title: 'Outline alternative · liveknowledge',
    description:
      'An alternative to Outline for team knowledge: pages with owners and verified dates, cited answers on built-in AI or your own key, and an MCP server for agents.',
    h1: 'An alternative to Outline for team knowledge',
    lede: 'Outline is a fast, well-made team knowledge tool whose source is public, and a team can run it on its own servers. On openness the two are close. liveknowledge differs in what it adds on top of the writing: verification on every page, cited answers, and agents as readers.',
    rows: [
      row('Price', US.price, 'A paid hosted service, or run it on your own servers'),
      row('Source', 'Public, MIT-licensed', 'Public, under its own licence'),
      row(
        'Where it runs',
        'The hosted version at liveknowledge.app',
        'Its hosted service, or your own servers',
      ),
      row('Page trust', US.trust, 'Document history and who last edited'),
      row('AI answers', US.ask, 'AI answers on its hosted service'),
      row('Agents', US.agents, 'A documented API'),
      row(
        'Structure',
        'Knowledgebases, each a page tree up to eight levels deep',
        'Collections of nested documents',
      ),
      row('Integrations', US.integrations, 'Integrations with chat and other tools, and an API'),
      row('Publishing', US.publish, 'Documents can be shared publicly'),
    ],
    themBest: [
      'You want to run your team’s knowledge on your own servers. Outline supports that; liveknowledge is offered as a hosted service only.',
      'You want a mature, fast editor with a long record, integrations with your chat tool and public sharing of documents.',
      'You want sign-in through your company’s identity provider and the controls that go with it.',
      'You want a product whose whole focus is team knowledge, rather than one app in a workspace.',
    ],
    usBest: [
      'Every page has an owner, a verified tick and a review that comes due.',
      'Ask cites each claim to its passage, on built-in AI or your own key, and says what the pages do not cover.',
      'An MCP server and a CLI hand agents each passage with its trust fields, and take edits as suggestions.',
      'Free to start on the hosted version, and MIT-licensed.',
      'Pages embed live items from the other liveworkspace apps, under one account.',
    ],
    sections: [
      {
        heading: 'Two open tools, two emphases',
        paragraphs: [
          'Outline’s strength is the writing itself: a quick Markdown editor, collections, a clean reading view, and the choice to run it where you like. If that is the whole of what you need, it is a sound choice.',
          'liveknowledge starts from the same kind of page and asks what happens a year later. Each page has an owner, the knowledgebase has a Review Period, the page tree shows what is due, and Knowledge Health shows the whole picture as one bar.',
        ],
      },
      AGENTS_SECTION,
      {
        heading: 'Moving from Outline',
        paragraphs: [
          'Outline exports a collection as Markdown. Choose Markdown Folder in liveknowledge’s Import dialog and the nested folders become the page tree, links between documents become page links and pictures come with them.',
          'Imported pages start unverified, with no owner. Going the other way is as open: a page exports to Markdown, PDF and Word, and the command line writes a whole knowledgebase as a Markdown folder.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I run liveknowledge on my own servers?',
        a: 'No. The code is public and MIT-licensed, but liveknowledge is offered as a hosted service. If running it on your own servers is a requirement, Outline is the better fit.',
      },
      {
        q: 'Can I import from Outline?',
        a: 'Yes, through Markdown. Export a collection from Outline as Markdown and import the folder: its structure becomes the page tree and links between documents become page links.',
      },
      {
        q: 'What does liveknowledge add on top of the writing?',
        a: 'Verification on every page (an owner, a verified date, a review that comes due), cited answers on built-in AI or your own key, and an MCP server and command line that hand agents each passage with how far to trust it.',
      },
      FREE_FAQ,
    ],
  },
];

export const COMPARISONS: Comparisons = {
  app: 'liveknowledge',
  siteUrl: SITE_URL,
  updated: UPDATED,
  hub: {
    title: 'How liveknowledge compares · alternatives',
    description:
      'Honest comparisons of liveknowledge with Notion, Confluence, Slite, Guru, GitBook and Outline, including where each is the better pick.',
    heading: 'How liveknowledge Compares',
    lede: 'Choosing where your team’s knowledge lives? Here is a side-by-side look at liveknowledge and six tools teams use for it, including where each one is the better pick and where liveknowledge is behind.',
  },
  alternatives: LIST,
};
