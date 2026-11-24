import type { ReactNode } from 'react';
import type { FeatureProps } from '@liveworkspace/marketing-site/components/Section';

import {
  AgentsArt,
  AskArt,
  ImportExportArt,
  PagesArt,
  TrustArt,
  WorkspaceArt,
} from '@/components/FeatureArt';
import {
  AgentsCardArt,
  AskCardArt,
  ImportCardArt,
  PagesCardArt,
  TrustCardArt,
  WorkspaceCardArt,
} from '@/components/feature-art/cards';

// Each feature card's Learn More is its help article, in the help centre the router serves at /help, written out
// whole so lib/help-links.test.ts checks every one.

/**
 * A feature section of the landing page (docs/specs/019-marketing/marketing-site.md "Feature sections"): one
 * thing liveknowledge does, told as a story beat with its own art. Pure data plus its drawing; every sentence is
 * something a visitor can do today (the spec's golden rule), and lib/product-claims.test.ts keeps out what the
 * fork brought and liveknowledge cut.
 */
export type LandingSection = {
  /** The section's anchor on the landing page (`/#import`). */
  id: string;
  /** The plain name shown beside the section's icon. */
  label: string;
  /** The headline, in Title Case. */
  title: string;
  /** Two or three plain sentences. */
  description: string;
  /** Three short points, each ticked. */
  points: [string, string, string];
  art: ReactNode;
  /** Its page's search description (`/features/<id>`), 50 to 160 characters. */
  metaDescription: string;
  /** Its page's cards (docs/specs/019-marketing/marketing-site.md "Feature pages"): six, each drawn. */
  items: FeatureProps[];
};

/**
 * The sections in the order the page tells them: what a knowledgebase is made of, why it can be trusted, how a
 * person and then an agent gets an answer from it, how a team's existing pages arrive, and where it sits.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    id: 'pages',
    label: 'Pages',
    title: 'Pages That Stay Organised',
    description:
      'A knowledgebase is a tree of pages, so a how-to lives under the team it belongs to and is found there again. Each page is one continuous page of writing, with tables, contents, footnotes, pictures, charts and drawings in the text. Type [[ to link to another page, label pages across the tree, and watch the ones you rely on to hear when they change.',
    points: [
      'A page tree with subpages',
      'Labels that cut across the tree',
      'Watch a page, and hear when it changes',
    ],
    art: <PagesArt />,
    metaDescription:
      'Pages in a tree, edited in a shared draft, linked with [[ and Linked From, with labels, Watch, comments, reactions, covers and Describe to Set Up.',
    items: [
      {
        title: 'A Page Tree',
        description:
          'Pages nest under pages, up to eight levels deep and 500 pages a knowledgebase. A how-to lives under the team it belongs to, and is found there again.',
        art: <PagesCardArt.PageTreeArt />,
        href: '/help/knowledgebase/the-page-tree/',
      },
      {
        title: 'Read First, Edit on Purpose',
        description:
          'Every page opens to read. Edit opens one draft that everyone editing shares live, and readers, search and agents see the change only when someone presses Save.',
        art: <PagesCardArt.ReadEditArt />,
        href: '/help/knowledgebase/writing-on-a-page/',
      },
      {
        title: 'Links Between Pages',
        description:
          'Type [[ and pick a page to link to it. A link follows its page when the page is renamed or moved, so it never goes stale.',
        art: <PagesCardArt.PageLinksArt />,
        href: '/help/knowledgebase/linking-pages/',
      },
      {
        title: 'Linked From',
        description:
          'The foot of every page lists the pages that link to it, so you can see where a page is relied on before you change it.',
        art: <PagesCardArt.LinkedFromArt />,
        href: '/help/knowledgebase/linking-pages/',
      },
      {
        title: 'Covers',
        description:
          'Give a page a cover across its top: a picture, one of the theme’s gradients or an animated background. Add Cover sits beside the reading time.',
        art: <PagesCardArt.CoversArt />,
        href: '/help/knowledgebase/writing-on-a-page/',
      },
      {
        title: 'Start From a Structure',
        description:
          'Start a knowledgebase from a structure such as Team Handbook or Runbooks and On-Call, or describe it and AI proposes the pages. Describe to Set Up runs on built-in AI, included.',
        art: <PagesCardArt.DescribeArt />,
        href: '/help/knowledgebase/the-page-tree/',
      },
      {
        title: 'Labels Across the Tree',
        description:
          'Labels such as Onboarding or Security cut across the sections. Press one to filter the page tree to it, and narrow a search or a question in Ask to it.',
        art: <PagesCardArt.LabelsArt />,
        href: '/help/knowledgebase/the-page-tree/',
      },
      {
        title: 'Watch a Page',
        description:
          'Watch a page, or a whole section and every page added under it later, and hear when someone changes it. Nobody sees who watches, only how many.',
        art: <PagesCardArt.WatchArt />,
        href: '/help/knowledgebase/watching-a-page/',
      },
      {
        title: 'Comments and Reactions',
        description:
          'Comment threads at the foot of a page hold the questions and corrections, and anyone may react with any emoji, Viewers too. Neither is an edit, and a reaction notifies nobody.',
        art: <PagesCardArt.ReactionsArt />,
        href: '/help/collaboration/comments/',
      },
    ],
  },
  {
    id: 'trust',
    label: 'Verification',
    title: 'Trust Built Into Every Page',
    description:
      'Every page has an owner, and says who verified it and when. A review comes due after 30, 90, 180 or 365 days, and a Health Score from 0 to 100 says how far each page can be relied on. People see this on the page, agents receive it with every passage, and Required Reading asks the team to read the pages that matter.',
    points: [
      'Verified, with a name and a date',
      'A Health Score for every page',
      'Required Reading, and who has read it',
    ],
    art: <TrustArt />,
    metaDescription:
      'Owners, verified ticks with a name and a date, a Review Period, a Health Score, Required Reading and Yours to Review: trust on every page.',
    items: [
      {
        title: 'An Owner for Every Page',
        description:
          'Each page names the person who vouches for it. Whoever verifies a page with no owner becomes its owner, and an owner can hand it on.',
        art: <TrustCardArt.OwnerArt />,
        href: '/help/knowledgebase/owners-and-verifying/',
      },
      {
        title: 'Verified, With a Name and a Date',
        description:
          'Verify puts a green tick on the page with who verified it and when: in its meta row, its row in the page tree and every link’s hover card.',
        art: <TrustCardArt.VerifiedArt />,
        href: '/help/knowledgebase/owners-and-verifying/',
      },
      {
        title: 'Reviews That Come Due',
        description:
          'The knowledgebase has one Review Period: 30, 90 or 180 days, a year, or never. Once it passes, a page reads Review Due until someone verifies it again.',
        art: <TrustCardArt.ReviewPeriodArt />,
        href: '/help/knowledgebase/review-due-and-the-review-period/',
      },
      {
        title: 'Changed Since Verified',
        description:
          'Writing on a verified page keeps its tick. A change to more than a fifth of the writing adds Changed Since Verified until someone checks it again.',
        art: <TrustCardArt.ChangedArt />,
        href: '/help/knowledgebase/owners-and-verifying/',
      },
      {
        title: 'Page Health',
        description:
          'The right rail shows a page’s state with a freshness ring, its owner, when its review is due, and how many people and agents read it this week.',
        art: <TrustCardArt.PageHealthArt />,
        href: '/help/knowledgebase/page-health/',
      },
      {
        title: 'Yours to Review',
        description:
          'The Knowledgebase Home lists the pages you own that are due, oldest first, each with Still Right. Owners also get one email when pages of theirs come due.',
        art: <TrustCardArt.YoursToReviewArt />,
        href: '/help/knowledgebase/knowledge-health-and-reminders/',
      },
      {
        title: 'A Health Score for Every Page',
        description:
          'Every page scores 0 to 100 from its verification, freshness, owner, length, structure, links and open issues, with the reason it lost most. Agents get the same score.',
        art: <TrustCardArt.HealthScoreArt />,
        href: '/help/knowledgebase/page-health/',
      },
      {
        title: 'Required Reading',
        description:
          'Ask everyone, or chosen people, to read a policy page and press I’ve Read This. Editors see who has and who has not, and a big change can ask everyone again.',
        art: <TrustCardArt.RequiredReadingArt />,
        href: '/help/knowledgebase/required-reading/',
      },
      {
        title: 'Not Read in 90 Days',
        description:
          'Insights lists the pages nobody has read in 90 days, so a team can see what to check, merge or retire before it misleads someone.',
        art: <TrustCardArt.NotReadArt />,
        href: '/help/knowledgebase/knowledge-health-and-reminders/',
      },
    ],
  },
  {
    id: 'ask',
    label: 'Ask',
    title: 'Ask, With Sources',
    description:
      'Ask a question in plain words and get an answer written from your pages, and from the diagrams, plans and Spaces connected to them, each claim numbered to the passage it came from and to the person who verified it. When the pages do not cover something, Ask says so and offers to start that page: it does not guess. Ask runs on built-in AI, included, or your own Claude or OpenAI key, and search needs no AI at all.',
    points: [
      'A citation on every claim',
      'It says what the pages do not cover',
      'Answers from your other apps too',
    ],
    art: <AskArt />,
    metaDescription:
      'Ask answers from your pages and connected items with a citation on every claim, Knowledge Gaps, and built-in AI or your own Claude or OpenAI key.',
    items: [
      {
        title: 'Every Claim Cited',
        description:
          'Ask answers in plain words from your knowledgebase’s own pages, and numbers each claim to the passage it came from.',
        art: <AskCardArt.CitationsArt />,
        href: '/help/knowledgebase/ask/',
      },
      {
        title: 'A Sources Rail',
        description:
          'Beside the answer, every cited passage with its page and who verified it, and a trust line saying how many of the pages it used are verified.',
        art: <AskCardArt.SourcesArt />,
        href: '/help/knowledgebase/ask/',
      },
      {
        title: 'It Does Not Guess',
        description:
          'When the pages do not cover a question, Ask says so. The gap is kept with how often it was asked, and an Editor can start the page from it.',
        art: <AskCardArt.GapArt />,
        href: '/help/knowledgebase/questions-nobody-could-answer/',
      },
      {
        title: 'Built-In AI, or Your Own Key',
        description:
          'Built-in AI is included, with daily limits. An Editor may add a Claude or OpenAI key in AI Settings instead: it is encrypted, never sent back to a browser.',
        art: <AskCardArt.OwnKeyArt />,
        href: '/help/knowledgebase/ai-settings/',
      },
      {
        title: 'Search Needs No AI',
        description:
          'Keyword search over titles and passages, verified pages first. It works for every role, through a share link and in an Offline knowledgebase.',
        art: <AskCardArt.SearchArt />,
        href: '/help/knowledgebase/searching-a-knowledgebase/',
      },
      {
        title: 'Save an Answer as a Page',
        description:
          'A good answer becomes a subpage of the page you pick, its words ready to edit, so the next person finds it in the tree.',
        art: <AskCardArt.SaveAsPageArt />,
        href: '/help/knowledgebase/ask/',
      },
      {
        title: 'Ask Across Your Apps',
        description:
          'Ask also answers from the diagrams, plans, documents, designs and Spaces connected to the knowledgebase, pages first, each source named with its app and a link to it.',
        art: <AskCardArt.AskAcrossAppsArt />,
        href: '/help/knowledgebase/ask-across-apps/',
      },
      {
        title: 'Ask Within a Label',
        description:
          'Pick a label and Ask answers only from the pages that carry it, so a question about security is answered from the security pages.',
        art: <AskCardArt.AskLabelArt />,
        href: '/help/knowledgebase/ask/',
      },
      {
        title: 'Choose What Ask Reads',
        description:
          'AI Settings says what Ask may read: the knowledgebase always, the items connected to it unless an Editor turns them off, and one team folder if an Editor picks it.',
        art: <AskCardArt.SourcesSettingsArt />,
        href: '/help/knowledgebase/ask-across-apps/',
      },
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    title: 'The Knowledgebase Your Agents Read',
    description:
      'An MCP server and a command line give your agents the pages your team reads, as pages and passages. Every passage arrives with how far to trust it: verified or not, when, and whether its review is due. An agent’s edit lands as a suggestion for a person to accept unless AI Editing lets it write, and a question no page answered is kept so someone can write that page.',
    points: [
      'An MCP server and a CLI',
      'Trust fields on every passage',
      'Suggested edits, or AI Editing',
    ],
    art: <AgentsArt />,
    metaDescription:
      'An MCP server and a CLI for your agents: Always in Context pages, trust fields on every passage, suggested edits, AI Editing and Insights.',
    items: [
      {
        title: 'An MCP Server',
        description:
          'Connect Claude, ChatGPT, Cursor, VS Code or any MCP client with one address and one approval. Your agent reads pages and passages, on its own model.',
        art: <AgentsCardArt.McpArt />,
        href: '/help/knowledgebase/connecting-an-agent/',
      },
      {
        title: 'A Command Line',
        description:
          'The liveknowledge CLI reads and searches a knowledgebase, exports it as a folder of Markdown with relative links, and imports one back.',
        art: <AgentsCardArt.CliArt />,
        href: '/help/knowledgebase/connecting-an-agent/',
      },
      {
        title: 'Always in Context',
        description:
          'Mark the pages every agent is handed before it starts, within a budget of 8,000 tokens. Each page says how much of the budget it takes.',
        art: <AgentsCardArt.AlwaysInContextArt />,
        href: '/help/knowledgebase/always-in-context/',
      },
      {
        title: 'Trust Fields on Every Passage',
        description:
          'Every passage arrives with how far to trust it: verified or not, by whom and when, whether its review is due, and any page it disagrees with.',
        art: <AgentsCardArt.TrustFieldsArt />,
        href: '/help/knowledgebase/what-agents-can-do/',
      },
      {
        title: 'Suggested Edits',
        description:
          'By default an agent’s edit arrives with its reason, for a person to accept or dismiss on the page or from the Inbox. Accepting it never verifies the page.',
        art: <AgentsCardArt.SuggestedEditArt />,
        href: '/help/knowledgebase/suggested-edits/',
      },
      {
        title: 'Insights',
        description:
          'One tab shows which agents read what, the questions nobody could answer and the pages that disagree. Finding those runs on built-in AI or your own key.',
        art: <AgentsCardArt.InsightsArt />,
        href: '/help/knowledgebase/pages-that-disagree/',
      },
      {
        title: 'AI Editing',
        description:
          'One setting says how far agents may change pages: Suggest Edits Only, Edit Unverified Pages or Edit Any Page. An agent’s connection still needs the write scope.',
        art: <AgentsCardArt.AiEditingArt />,
        href: '/help/knowledgebase/suggested-edits/',
      },
      {
        title: 'Agents Draft and Arrange',
        description:
          'An agent can add a page, never verified, and move the drafts it made into place in the tree, for a person to check and verify.',
        art: <AgentsCardArt.DraftArrangeArt />,
        href: '/help/knowledgebase/what-agents-can-do/',
      },
      {
        title: 'Named in History',
        description:
          'A page an agent made or changed says so: Created, Updated and Version History name the agent and the person it acts for, such as Claude for Priya.',
        art: <AgentsCardArt.NamedInHistoryArt />,
        href: '/help/knowledgebase/what-agents-can-do/',
      },
    ],
  },
  {
    id: 'import',
    label: 'Import and Export',
    title: 'Bring Everything With You',
    description:
      'In the editor’s Import dialog, bring in a folder of Markdown, a Notion export or a Confluence space export. The folders become the page tree, links between pages become page links, and you see what was found before anything is imported. Export a page to Markdown, PDF or Word whenever you like.',
    points: [
      'Markdown folders, Notion and Confluence',
      'A review before anything is imported',
      'Markdown, PDF and Word out',
    ],
    art: <ImportExportArt />,
    metaDescription:
      'Import Notion and Confluence exports or a Markdown folder into a page tree, review it first, and export pages to Markdown, PDF and Word.',
    items: [
      {
        title: 'From Notion',
        description:
          'Notion’s Markdown and CSV export, as a .zip. Pages keep their nesting, and a database becomes a table on its page.',
        art: <ImportCardArt.NotionImportArt />,
        href: '/help/knowledgebase/import-from-notion/',
      },
      {
        title: 'From Confluence',
        description:
          'A space’s HTML export, as a .zip. Pages keep the space’s order and nesting, and its info, note and warning boxes become quotes.',
        art: <ImportCardArt.ConfluenceImportArt />,
        href: '/help/knowledgebase/import-from-confluence/',
      },
      {
        title: 'A Folder of Markdown',
        description:
          'A folder of .md files and pictures, or a .zip of one. Folders become the page tree, and a README.md becomes its folder’s page.',
        art: <ImportCardArt.MarkdownFolderArt />,
        href: '/help/knowledgebase/import-a-markdown-folder/',
      },
      {
        title: 'A Review Before Anything Lands',
        description:
          'You see the pages and pictures that were found, and anything that will be left out, before a single page is imported.',
        art: <ImportCardArt.ImportReviewArt />,
        href: '/help/knowledgebase/import-from-notion/',
      },
      {
        title: 'Links Become Page Links',
        description:
          'Links between the imported pages arrive as page links, so Linked From is right from the first day. Imported pages start unverified, with no owner.',
        art: <ImportCardArt.ImportLinksArt />,
        href: '/help/knowledgebase/import-a-markdown-folder/',
      },
      {
        title: 'Export Whenever You Like',
        description:
          'A page exports to Markdown, PDF and Word. The command line takes a whole knowledgebase out as a folder of Markdown.',
        art: <ImportCardArt.ExportArt />,
        href: '/help/knowledgebase/exporting-a-knowledgebase/',
      },
    ],
  },
  {
    id: 'workspace',
    label: 'liveworkspace',
    title: 'Part of liveworkspace',
    description:
      'Embed a diagram from livediagram, a board from liveplanner, a document from livedocuments, a design from livedesign or a Space from livehuddle, and the page shows it as it is now. One account opens every app, and a knowledgebase is shared like everything else, with Editor, Participant and Viewer roles. Publish one, or a section of it, as a public site anyone can read, keep one Offline, or mirror it to Google Drive.',
    points: [
      'Live embeds from five apps',
      'Editor, Participant and Viewer roles',
      'Publish to the web for anyone to read',
    ],
    art: <WorkspaceArt />,
    metaDescription:
      'Live embeds from five apps, Editor, Participant and Viewer roles, Publish to the Web, Automations, calls, Offline and the Google Drive mirror.',
    items: [
      {
        title: 'Live Embeds From Five Apps',
        description:
          'Embed a diagram, a board, a document, a design or a Space, and the page shows it as it is now, not a picture taken once.',
        art: <WorkspaceCardArt.EmbedsArt />,
        href: '/help/knowledgebase/embedding-from-other-apps/',
      },
      {
        title: 'Editor, Participant and Viewer',
        description:
          'A Participant does everything an Editor does except the knowledgebase’s settings, its style, its AI key and who has access. A Viewer reads, searches and asks.',
        art: <WorkspaceCardArt.RolesArt />,
        href: '/help/knowledgebase/knowledgebase-roles/',
      },
      {
        title: 'Knowledgebase Style',
        description:
          'Pick a look for every page of a knowledgebase at once: a theme and a font, or a Mashup. No page falls out of step with the rest.',
        art: <WorkspaceCardArt.StyleArt />,
        href: '/help/knowledgebase/knowledgebase-style/',
      },
      {
        title: 'Offline',
        description:
          'Start without an account: a knowledgebase kept Offline lives in your browser, where it is written, searched and exported.',
        art: <WorkspaceCardArt.OfflineArt />,
        href: '/help/privacy-and-security/offline-mode/',
      },
      {
        title: 'The Google Drive Mirror',
        description:
          'Mirror a knowledgebase to your own Google Drive as a file you keep, the same way every liveworkspace app can.',
        art: <WorkspaceCardArt.DriveArt />,
        href: '/help/account-and-data/google-drive/',
      },
      {
        title: 'One Account',
        description:
          'One liveworkspace account opens every app, and the Explorer keeps your knowledgebases beside your diagrams, plans, documents, designs and Spaces.',
        art: <WorkspaceCardArt.OneAccountArt />,
        href: '/help/knowledgebase/knowledgebase-roles/',
      },
      {
        title: 'Publish to the Web',
        description:
          'Make a knowledgebase, or one section of it, a public, read-only site anyone can read and search, with no account. Only saved pages go public, never drafts or comments.',
        art: <WorkspaceCardArt.PublishArt />,
        href: '/help/knowledgebase/publishing-to-the-web/',
      },
      {
        title: 'Automations',
        description:
          'Rules that run on their own, with steps in the other apps: when a page comes due for review, a card for its owner lands in a liveplanner plan.',
        art: <WorkspaceCardArt.AutomationsArt />,
        href: '/help/tools/automations/',
      },
      {
        title: 'Calls and Cards From a Page',
        description:
          'Start a livehuddle call about the knowledgebase from its Call button, and send a paragraph or a comment to a liveplanner board as a card.',
        art: <WorkspaceCardArt.CallsCardsArt />,
        href: '/help/collaboration/start-a-call/',
      },
    ],
  },
];

/** Section ids, in order, for the sitemap-free anchors and the tests. */
export const LANDING_SECTION_IDS = LANDING_SECTIONS.map((s) => s.id);

export function getLandingSection(id: string): LandingSection | undefined {
  return LANDING_SECTIONS.find((s) => s.id === id);
}
