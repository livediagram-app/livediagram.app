import {
  lucideArrowUpDown,
  lucideCpu,
  lucideShare2,
  lucideShieldCheck,
  lucideSparkles,
  lucideZap,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph, REPO_URL } from '@liveknowledge/ui';
import type { FaqCategory, FaqItem } from '@liveworkspace/marketing-site/lib/faq';

// The /faq page's content (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): questions grouped
// into categories, each with an icon and a one-line blurb. Pure data, exempt from the line target.
// The shape, and what `a` and `aText` are, is @liveworkspace/marketing-site's lib/faq.ts. faq-content.test.tsx
// renders every JSX answer and fails if its text drifts from `aText`, so the structured data stays a faithful
// image of the page. Every answer says what is built today, including what is not.

const ICON = 18;

// The structure groups as the answers name them, and how many structures there are, pinned to STRUCTURE_GROUPS and
// SETUP_STRUCTURES by faq-content.test.tsx. Written out rather than read from @liveknowledge/knowledge: this module
// ships in the FAQ's client bundle.
export const STRUCTURE_GROUP_NAMES = [
  'Company and Team',
  'Engineering',
  'Product and Research',
  'Customers',
  'Operations',
  'Clients and Communities',
  'Education',
  'Personal',
];
export const STRUCTURE_COUNT_WORD = 'thirty-two';

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    blurb: 'What liveknowledge is, what it costs and how to begin.',
    icon: lucideGlyph(lucideZap, ICON),
    items: [
      {
        q: 'What is liveknowledge?',
        a: 'A team knowledgebase, for people and for AI. Your team writes its how-tos, decisions and handbooks as pages in a page tree. Each page has an owner and a verified date, and your colleagues and your agents read the same pages under the same rules. It is part of liveworkspace, beside livediagram, liveplanner, livedocuments, livedesign and livehuddle.',
      },
      {
        q: 'Is liveknowledge free?',
        a: (
          <>
            It is free to start, with no card and no trial clock, and it is open source under the
            MIT licence: the code is on{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            . Writing, linking, verifying, searching and connecting an agent cost nothing. Ask runs
            on your team’s own AI key, so that usage is paid to your provider, not to us. Describe
            to Set Up runs on built-in AI when your team has no key.
          </>
        ),
        aText:
          'It is free to start, with no card and no trial clock, and it is open source under the MIT licence: the code is on GitHub. Writing, linking, verifying, searching and connecting an agent cost nothing. Ask runs on your team’s own AI key, so that usage is paid to your provider, not to us. Describe to Set Up runs on built-in AI when your team has no key.',
      },
      {
        q: 'Is there a paid tier?',
        a: 'Not at launch. Everything this site describes is free to use, and the one AI cost a team carries is Ask, which runs on its own Claude or OpenAI key.',
      },
      {
        q: 'How do I start a knowledgebase?',
        a: 'Open the editor and a new knowledgebase starts on a screen of choices. Start blank, pick a structure such as Team Handbook or Runbooks and On-Call with its pages already in place, import from Notion, Confluence or a folder of Markdown, or describe what it is for and AI proposes the pages for you to accept. Describe to Set Up runs on built-in AI when your team has no key, and on your team’s key once it has one.',
      },
      {
        q: 'Do I need an account?',
        a: 'Not to write. Open the editor and start a knowledgebase, and it is kept Offline in your browser. Verifying pages, Ask, Describe to Set Up, AI Knowledge, sharing and connecting an agent need a free account, because each of them has to know who you are.',
      },
      {
        q: 'What is liveknowledge not?',
        a: 'It is not a slide or page layout tool: for slide decks, infographics and documents laid out on paper pages, use livedocuments. It is not a chat or a project tracker either. A knowledgebase page is writing, with tables, pictures, charts and drawings in the text.',
      },
      {
        q: 'How do I edit a page?',
        a: 'A page opens to read. Press Edit, or double-click the writing, and you are in a draft that everyone editing the page shares live, each with their own caret. Readers, search, Ask and agents keep seeing the saved page until someone presses Save. Cancel leaves the draft to anyone still editing; if you are the last, it asks before throwing your changes away.',
      },
      {
        q: 'Can a page have a cover?',
        a: 'Yes. Add Cover, beside the reading time under a page’s title, sets a picture, one of the theme’s gradients or an animated background across the top of the page. Knowledgebase Style sets the look of every page at once: its theme and its fonts.',
      },
      {
        q: 'How big can a knowledgebase be?',
        a: 'Up to 500 pages, nested up to eight levels deep. Both limits are checked on the server as well as in the editor, and the control that would pass one says why it is disabled.',
      },
      {
        q: 'Are there templates?',
        a: `Yes, and each is a whole knowledgebase rather than a single page: ${STRUCTURE_COUNT_WORD} structures such as Team Handbook, Engineering Handbook, Runbooks and On-Call and Sales Playbook, each a tree of pages with a line on what belongs on each and the headings to write under. They are grouped under ${STRUCTURE_GROUP_NAMES.slice(0, -1).join(', ')} and ${STRUCTURE_GROUP_NAMES.at(-1)}. Pick one from the template gallery or from a new knowledgebase’s start.`,
      },
    ],
  },
  {
    id: 'verification',
    title: 'Trust and Verification',
    blurb: 'Owners, verified pages and reviews that come due.',
    icon: lucideGlyph(lucideShieldCheck, ICON),
    items: [
      {
        q: 'How does verification work?',
        a: 'Each page has an owner. An Editor or a Participant presses Verify, and the page shows a green tick with who verified it and when. The knowledgebase has one Review Period (30, 90, 180 or 365 days, or never), and once it has passed a page reads Review Due until someone verifies it again. Nothing is verified automatically, and a large change made after verifying is marked Changed Since Verified.',
      },
      {
        q: 'Who can verify a page?',
        a: 'Editors and Participants. Viewers see every page’s state but cannot change it. Only an Editor sets the Review Period, from Page Health beside any page, and it applies to every page. Verifying needs an account, so a knowledgebase kept Offline has no verified pages.',
      },
      {
        q: 'How do owners know a review is due?',
        a: 'The Knowledgebase Home lists Yours to Review: the pages you own whose review is due, oldest first, each with a Still Right button that verifies it. Each owner also gets one email, Pages Due for Review, at most once a day, while their Knowledgebase Reviews notification is on.',
      },
      {
        q: 'What is AI Context?',
        a: 'A section in every page’s right rail: whether the page is Always in Context (handed to every agent first, with its size in tokens), the questions Ask answered from it, and which agents read it this week, each shown once there is one. Always in Context pages share a budget of 8,000 tokens, and a page that would pass it says so.',
      },
      {
        q: 'What does AI Knowledge show?',
        a: 'Which agents read your knowledgebase and what they read most, the questions nobody could answer, pages that disagree with each other, the edits agents have suggested, and the pages you marked Always in Context. Finding pages that disagree uses a model, so it needs your own Claude or OpenAI key; the rest needs none.',
      },
    ],
  },
  {
    id: 'ask',
    title: 'Ask and AI',
    blurb: 'Cited answers, your own key and what search needs.',
    icon: lucideGlyph(lucideSparkles, ICON),
    items: [
      {
        q: 'What is Ask?',
        a: 'Ask answers a question in plain words from your knowledgebase’s own pages. Each claim carries a numbered citation, and a Sources rail shows every cited passage with its page and who verified it. A trust line says how many of the pages it used are verified.',
      },
      {
        q: 'Who pays for Ask?',
        a: 'Your team does, on its own Claude or OpenAI key, so Ask appears once an Editor adds the knowledgebase’s key in AI Settings. Search, verification, import, export and the agent connection need no key.',
      },
      {
        q: 'Does anything use AI without our key?',
        a: 'One thing: Describe to Set Up. With no key it asks built-in AI, Cloudflare Workers AI paid for by liveknowledge, up to 10 suggestions a person a day; once your team adds a key, it uses that instead. Ask, finding pages that disagree and drafting a page from a question always use your team’s key.',
      },
      {
        q: 'Is my API key safe?',
        a: 'The key is sent once over TLS, encrypted before it is stored, and kept with that knowledgebase. It is never sent back to a browser: AI Settings shows only its last four characters, with Replace and Remove. It is never written to logs or telemetry.',
      },
      {
        q: 'What happens when the pages do not cover my question?',
        a: 'Ask says so instead of guessing. The part it could not answer is shown as a Knowledge Gap, recorded in AI Knowledge with how often it was asked, and an Editor can start a page from it.',
      },
      {
        q: 'Does search need a key?',
        a: 'No. Search is keyword search over your pages, split into passages, and it works for every role and in an Offline knowledgebase. Semantic search is not built.',
      },
      {
        q: 'Can someone with a share link use Ask?',
        a: 'Not anonymously. Ask is off for anonymous share links, because it would spend your team’s key for strangers. People you share the knowledgebase with by name can ask, at any role.',
      },
    ],
  },
  {
    id: 'agents',
    title: 'Agents',
    blurb: 'The MCP server, the command line and what an agent may do.',
    icon: lucideGlyph(lucideCpu, ICON),
    items: [
      {
        q: 'Can I connect my own AI tool?',
        a: (
          <>
            Yes. liveknowledge has an MCP server and a command line. Connect Claude, ChatGPT,
            Cursor, VS Code or any MCP client from <a href="/ai">Build with AI</a>: one address, one
            approval, then your agent can read the knowledgebase.
          </>
        ),
        aText:
          'Yes. liveknowledge has an MCP server and a command line. Connect Claude, ChatGPT, Cursor, VS Code or any MCP client from Build with AI: one address, one approval, then your agent can read the knowledgebase.',
      },
      {
        q: 'What can an agent see?',
        a: 'Only what the person or token it acts for can open. Share roles apply to agents exactly as to people: a Viewer’s agent reads, and a Participant’s or an Editor’s agent can also suggest edits. A read-only connection never suggests.',
      },
      {
        q: 'Can an agent change a page?',
        a: 'By default an agent’s edit arrives as a suggestion with its reason, and a person accepts or dismisses it. Accepting applies it as one undo step and does not verify the page. An Editor can allow one connection to write, but a page that is Verified or Review Due is only ever changed by suggestion.',
      },
      {
        q: 'What does an agent get with a passage?',
        a: 'How far to trust it: whether the page is verified, when, whether its review is due, and any page it is known to disagree with. Reading a whole page also gives who verified it, its backlinks and its subpages.',
      },
      {
        q: 'Does liveknowledge train a model on my pages?',
        a: 'No. Ask sends your question and the passages it found to Claude or OpenAI, whichever your team chose, under your team’s own API key. With no key, Describe to Set Up sends only what you describe, and the titles of pages already there, to built-in AI. An agent you connect reads only what you let it.',
      },
    ],
  },
  {
    id: 'import-export',
    title: 'Import and Export',
    blurb: 'Bringing pages in from elsewhere, and taking them out.',
    icon: lucideGlyph(lucideArrowUpDown, ICON),
    items: [
      {
        q: 'Can I import from Notion and Confluence?',
        a: 'Yes. In the editor’s Import dialog choose Notion (its Markdown and CSV export, a .zip), Confluence (a space’s HTML export, a .zip) or a folder of Markdown. You see the pages and pictures it found before anything is imported. Google Docs import is not built yet.',
      },
      {
        q: 'What comes across in an import?',
        a: 'The pages and their hierarchy, the links between them and their pictures. A Notion database’s CSV becomes a table on its page, Confluence’s info, note and warning boxes become quotes, and code blocks stay code. Other attachments are listed by name, because liveknowledge stores pictures only. Imported pages start unverified, with no owner.',
      },
      {
        q: 'How large an import can I make?',
        a: 'An archive up to 200 MB and 500 pages (the size of a knowledgebase), with pictures up to 10 MB each. The archive is read in your browser, and pages are written in batches, so a failed page is reported by name and the rest are kept.',
      },
      {
        q: 'How do I get my pages out?',
        a: 'A page exports to Markdown, PDF and Word, and also to PNG, SVG and JSON. The command line exports a whole knowledgebase as a folder of Markdown with relative links, so it can be kept beside a repository.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing and Privacy',
    blurb: 'Roles, Offline, and what liveknowledge does not do yet.',
    icon: lucideGlyph(lucideShare2, ICON),
    items: [
      {
        q: 'How is a knowledgebase shared?',
        a: 'Like every liveworkspace item: by link or with named people, as Editor, Participant or Viewer. A Participant does everything an Editor does except the Review Period, Knowledgebase Style, AI Settings and who has access: it edits pages, changes the page tree, sets covers, verifies and imports. A Viewer reads, searches, asks and exports.',
      },
      {
        q: 'Can I restrict a single page?',
        a: 'No. Sharing is per knowledgebase, as it is for every liveworkspace app, and page-level permissions are not built. To keep some pages to fewer people, put them in a knowledgebase of their own.',
      },
      {
        q: 'Does liveknowledge work offline?',
        a: 'Yes. A knowledgebase kept Offline lives only in your browser, where it is written, searched and exported without an account. Verification, Ask, Describe to Set Up, AI Knowledge and sharing need the server, so they are not available for an Offline knowledgebase.',
      },
      {
        q: 'Can I publish a knowledgebase as a public website?',
        a: 'Not yet. You can share a view-only link, but a public site with its own domain is not built.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'There is no native app. The editor runs in a phone’s browser and can be installed to the home screen.',
      },
      {
        q: 'What is tracked?',
        a: 'Anonymous, first-party counts of which features are used, sent to liveworkspace’s own telemetry service and listed publicly on /telemetry. No third-party analytics, no advertising pixels, and never the words you write.',
      },
    ],
  },
];

// The landing page's questions (docs/specs/019-marketing/marketing-site.md "Structure" 9): eight of the answers
// above, by question, in the order the page asks them. faq-content.test.tsx fails if one no longer exists.
const LANDING_QUESTIONS = [
  'Is liveknowledge free?',
  'Who pays for Ask?',
  'What can an agent see?',
  'How does verification work?',
  'Can I import from Notion and Confluence?',
  'How do I edit a page?',
  'Does liveknowledge work offline?',
  'What is liveknowledge not?',
];

const ALL_ITEMS = FAQ_CATEGORIES.flatMap((c) => c.items);

export const LANDING_FAQ: FaqItem[] = LANDING_QUESTIONS.flatMap((q) => {
  const item = ALL_ITEMS.find((i) => i.q === q);
  return item ? [item] : [];
});

/** How many questions the landing page means to show; the test holds LANDING_FAQ to it. */
export const LANDING_FAQ_COUNT = LANDING_QUESTIONS.length;
