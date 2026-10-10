import {
  lucideArrowUpDown,
  lucideGift,
  lucideMessagesSquare,
  lucidePackage,
  lucideShapes,
  lucideShare2,
  lucideShieldCheck,
  lucideSparkles,
  lucideUsers,
  lucideZap,
} from '@livediagram/icons/lucide';
import { lucideGlyph, REPO_URL } from '@livediagram/ui';
import type { ReactNode } from 'react';

// The /faq page's content (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): questions grouped
// into categories, each with an icon and a one-line blurb. Pure data, exempt from the line target.
//
// Each entry's `a` is what renders on the page (a ReactNode, so prose can mix in links). `aText` is the plain-text
// form the FAQPage JSON-LD emits, since schema.org's Answer.text expects a string: entries whose `a` is already a
// string omit it, the rest restate the answer sans markup. faq-content.test.tsx renders every JSX answer and fails
// if its text drifts from `aText`, so the structured data stays a faithful image of the page.

export type FaqItem = { q: string; a: ReactNode; aText?: string };
export type FaqCategory = {
  id: string;
  title: string;
  blurb: string;
  icon: ReturnType<typeof lucideGlyph>;
  items: FaqItem[];
};

const ICON = 18;
// Written out rather than read from @livediagram/templates: this module ships in the FAQ's client bundle, and the
// catalogue is ~15 KB for one number. faq-content.test.tsx pins it to TEMPLATES.length.
export const TEMPLATE_COUNT = 95;
// Illustrate's slide layouts, pinned to the catalogue by faq-content.test.tsx like the template count.
export const SLIDE_LAYOUT_COUNT = 17;
// Illustrate's infographic page layouts and logo layouts, pinned the same way.
export const PAGE_LAYOUT_COUNT = 31;
export const LOGO_LAYOUT_COUNT = 25;

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    blurb: 'What livediagram is and how to begin.',
    icon: lucideGlyph(lucideZap, ICON),
    items: [
      {
        q: 'What is livediagram?',
        a: 'A free, real-time canvas for diagrams, whiteboards, illustrations and plans. Every document is a stack of tabs, and each tab can be worked on in four modes: Diagram for shapes and arrows, Draw for freehand whiteboarding, Illustrate for designed pages, and Plan for boards of cards. Your team can join any of them live.',
      },
      {
        q: 'Do I need an account to use livediagram?',
        a: (
          <>
            No. Open the editor and start drawing straight away, with no sign-up. Your work is saved
            and shareable as a guest. Signing in (also free) keeps your documents with you across
            devices and unlocks teams, API tokens and the AI connection. See{' '}
            <a href="/help/getting-started/guest-vs-account/">guest vs account</a>.
          </>
        ),
        aText:
          'No. Open the editor and start drawing straight away, with no sign-up. Your work is saved and shareable as a guest. Signing in (also free) keeps your documents with you across devices and unlocks teams, API tokens and the AI connection. See guest vs account.',
      },
      {
        q: 'How do I start my first document?',
        a: `Press Start drawing and pick a starting point: a blank canvas in any mode, or one of ${TEMPLATE_COUNT} templates. The document opens straight away, and a short tour points out where everything lives.`,
      },
      {
        q: 'Does it work on my phone or tablet?',
        a: (
          <>
            It runs in any modern browser, with nothing to install. A laptop, desktop or tablet
            gives you the full editor, and a tablet with a pen is lovely in Draw mode. Small phone
            screens are best for viewing and light edits. See{' '}
            <a href="/help/supported-devices/">supported devices</a>.
          </>
        ),
        aText:
          'It runs in any modern browser, with nothing to install. A laptop, desktop or tablet gives you the full editor, and a tablet with a pen is lovely in Draw mode. Small phone screens are best for viewing and light edits. See supported devices.',
      },
      {
        q: 'Are there keyboard shortcuts?',
        a: (
          <>
            Plenty. Cmd-Z (or Ctrl-Z) undoes and Cmd-Shift-Z redoes, Cmd-K opens the command palette
            for any action, and single keys pick tools. The{' '}
            <a href="/help/getting-started/keyboard-essentials/">keyboard essentials</a> article
            lists them all.
          </>
        ),
        aText:
          'Plenty. Cmd-Z (or Ctrl-Z) undoes and Cmd-Shift-Z redoes, Cmd-K opens the command palette for any action, and single keys pick tools. The keyboard essentials article lists them all.',
      },
    ],
  },
  {
    id: 'free-and-open-source',
    title: 'Free and open source',
    blurb: 'No paid tier, no catch.',
    icon: lucideGlyph(lucideGift, ICON),
    items: [
      {
        q: 'Is it really free?',
        a: 'Yes. Every feature is free for everyone, with no paid tier, no trial and no plan to introduce one. If we ship it, every user gets it.',
      },
      {
        q: 'Is the code open source?',
        a: (
          <>
            Yes. The whole codebase is MIT-licensed and{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              public on GitHub
            </a>
            . You can read it, run your own copy, or contribute.
          </>
        ),
        aText:
          'Yes. The whole codebase is MIT-licensed and public on GitHub. You can read it, run your own copy, or contribute.',
      },
      {
        q: 'Will features ever move behind a paywall?',
        a: 'No. There are no "Pro" features and no billing anywhere in the code. The free hosted version and a self-hosted copy run the same software.',
      },
    ],
  },
  {
    id: 'creating',
    title: 'Creating',
    blurb: 'Shapes, templates, themes and modes.',
    icon: lucideGlyph(lucideShapes, ICON),
    items: [
      {
        q: 'What can I make with it?',
        a: 'Flowcharts, mind maps, org charts, retrospectives in five formats, Lean Coffee and town hall Q&A boards, kanban and Plan boards, spreadsheets, roadmaps, story maps, SWOT grids, Business Model Canvases, timelines, Gantt charts, funnels, flywheels, tables, pie, bar and line charts, UML class, sequence and state diagrams, system architecture, event storming, incident postmortems, risk matrices, stakeholder maps, user personas, meeting agendas, UI wireframes, slide decks, articles and a to-scale floor plan.',
      },
      {
        q: 'How many templates and themes are there?',
        a: `${TEMPLATE_COUNT} starter templates across eight categories, and twenty-six themes that recolour every shape and arrow in one click, including dark and multi-colour schemes. You can also build and save a colour scheme of your own.`,
      },
      {
        q: 'What are the four modes?',
        a: 'Diagram is for structured shapes, connectors and layouts. Draw is a freehand whiteboard with pressure-sensitive markers. Illustrate lays out designed pages like posters and slides. Plan turns a tab into boards of cards with columns, WIP limits and quick add, beside spreadsheets with formulas. A mode belongs to the tab, so everyone on it works in the same one, and each tab of a document can have its own.',
      },
      {
        q: 'Can I organise a big document?',
        a: 'Yes. A document holds as many tabs as you need, which you can group into folders, link between and open two at a time side by side. Each tab has Photoshop-style layers you can hide, lock and restack, and your documents live in nested folders in the Explorer, shown as a list, as cards or as a sortable Details table. Drag a document onto a folder to file it.',
      },
      {
        q: 'Can I write documents in it?',
        a: (
          <>
            Yes. Switch a tab to Illustrate and write an article straight onto pages: Markdown
            shortcuts, a / menu for every block, and clean paste from web pages, Google Docs and
            Word. Writing flows onto new pages as it grows, pictures, charts and diagrams sit in the
            text, and teammates comment on the words themselves. Pick one of five looks, then export
            every page as a PDF. See <a href="/help/canvas/illustrate/articles/">Articles</a>.
          </>
        ),
        aText:
          'Yes. Switch a tab to Illustrate and write an article straight onto pages: Markdown shortcuts, a / menu for every block, and clean paste from web pages, Google Docs and Word. Writing flows onto new pages as it grows, pictures, charts and diagrams sit in the text, and teammates comment on the words themselves. Pick one of five looks, then export every page as a PDF. See Articles.',
      },
      {
        q: 'Can I design infographics, posters or a logo?',
        a: (
          <>
            Yes, in Illustrate. Lay out pages in print sizes (A4, US Letter, A3) or social sizes,
            starting from one of {PAGE_LAYOUT_COUNT} layouts, and export them print-ready as PDF,
            PNG or SVG. A logo page is a square artboard with {LOGO_LAYOUT_COUNT} logo layouts,
            construction guides, mirror drawing and wordmark type, and it exports a logo kit. See{' '}
            <a href="/help/canvas/illustrate/">Illustrate mode</a>.
          </>
        ),
        aText: `Yes, in Illustrate. Lay out pages in print sizes (A4, US Letter, A3) or social sizes, starting from one of ${PAGE_LAYOUT_COUNT} layouts, and export them print-ready as PDF, PNG or SVG. A logo page is a square artboard with ${LOGO_LAYOUT_COUNT} logo layouts, construction guides, mirror drawing and wordmark type, and it exports a logo kit. See Illustrate mode.`,
      },
      {
        q: 'Can I use it as a whiteboard?',
        a: (
          <>
            Yes. Switch a tab to Draw for a plain whiteboard: three pressure-sensitive markers,
            text, an eraser and shapes, on a plain, dotted or grid board in light or dark. With a
            stylus, a resting palm never leaves a mark. See{' '}
            <a href="/help/canvas/draw-mode/">Draw mode</a>.
          </>
        ),
        aText:
          'Yes. Switch a tab to Draw for a plain whiteboard: three pressure-sensitive markers, text, an eraser and shapes, on a plain, dotted or grid board in light or dark. With a stylus, a resting palm never leaves a mark. See Draw mode.',
      },
      {
        q: 'Is there a spreadsheet?',
        a: (
          <>
            Yes. Put a Sheet on a Plan tab: cells with over 150 functions, number formats, sort,
            filter and freeze, edited live by everyone on the tab. Formulas can read the cards on
            the board, and Budget Planner, Timesheet, Contact List and Task Tracker templates start
            you off. See <a href="/help/canvas/plan-mode/sheets/">Sheets</a>.
          </>
        ),
        aText:
          'Yes. Put a Sheet on a Plan tab: cells with over 150 functions, number formats, sort, filter and freeze, edited live by everyone on the tab. Formulas can read the cards on the board, and Budget Planner, Timesheet, Contact List and Task Tracker templates start you off. See Sheets.',
      },
      {
        q: 'Can I present from it?',
        a: `Yes. Presentation mode builds a slide deck from elements across your tabs and runs it full screen. Slides point at the real elements, so editing a shape updates every slide it appears on. For designed slides, Illustrate adds 16:9 or 4:3 slide pages started from one of ${SLIDE_LAYOUT_COUNT} layouts, which join the same deck. A laser pointer and spotlight help you guide the room.`,
      },
      {
        q: 'Can I undo a mistake?',
        a: 'Yes. Press Cmd-Z (or Ctrl-Z) to step back your recent edits and Cmd-Shift-Z to bring one back; the buttons also sit in the bottom-right corner. Undo is personal, so it only rewinds your own changes, never a teammate’s.',
      },
      {
        q: 'What if I delete something by accident?',
        a: 'Deleted documents wait in the Trash for 30 days before they are removed for good, so you can restore them from Settings › Account. Team documents go to their team’s Trash.',
      },
    ],
  },
  {
    id: 'working-together',
    title: 'Working together',
    blurb: 'Real-time collaboration and teams.',
    icon: lucideGlyph(lucideUsers, ICON),
    items: [
      {
        q: 'Can I work with my team in real time?',
        a: 'Yes, that is the point. Share a link and teammates join the same document in real time, whatever mode a tab is in, with live cursors, selection rings, presence on each tab, comments and a laser pointer. If you have not signed in, a new document starts in your browser, and the first Share syncs it in one step.',
      },
      {
        q: 'What happens if two people edit the same thing at once?',
        a: 'Every change shows up for everyone live. Edits to different elements merge cleanly. If two people change the same element at the same moment, the most recent change is the one that sticks.',
      },
      {
        q: 'Can I leave comments and assign follow-ups?',
        a: 'Yes. Comment on any element and reply in threads, then resolve them when they are done. You can also attach an action to an element and assign it to a teammate, so the follow-ups a meeting produces stay with the document instead of getting lost.',
      },
      {
        q: 'Can I set up a team with shared documents?',
        a: 'Yes, once you sign in. Create a team from the Explorer, invite people by email, and everyone gets a shared library of documents. Teams have Admin and Member roles: admins manage membership, everyone else just gets to work.',
      },
      {
        q: 'Is it good for running workshops and retros?',
        a: 'Very. There are templates for retrospectives, Lean Coffee, town hall Q&A and event storming, and a facilitator role: whoever holds it runs the room’s timer, votes, polls and reveals.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing and embedding',
    blurb: 'Links, passwords, embeds and the Community.',
    icon: lucideGlyph(lucideShare2, ICON),
    items: [
      {
        q: 'How do share links work?',
        a: 'From a document you own, create an editor link (full edit access), a participant link (add stickies, write and vote, without reshaping the board) or a view-only link. Anyone with the link can join. Give a link an expiry of a week, a month or six months so it stops working on its own, or revoke it at any time and it stops working immediately.',
      },
      {
        q: 'Can I password-protect a document?',
        a: 'Yes. Add a password in the Share dialog and every link to that document asks for it before opening.',
      },
      {
        q: 'Can I embed a diagram in my docs or wiki?',
        a: 'Yes. Any share link can be embedded as a live-updating iframe: an editor link embeds an editable canvas, and a participant or view-only link a read-only one. Copy the snippet from the Share dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes; it always shows the current state of the diagram.',
      },
      {
        q: 'What is the Community?',
        a: (
          <>
            A public gallery of documents people are proud of. Signed-in owners can publish a
            document with a title, description and tags; anyone can browse it, open it read-only,
            like it and make their own copy in one click. <a href="/community/">Take a look</a>.
          </>
        ),
        aText:
          'A public gallery of documents people are proud of. Signed-in owners can publish a document with a title, description and tags; anyone can browse it, open it read-only, like it and make their own copy in one click. Take a look.',
      },
    ],
  },
  {
    id: 'ai-and-integrations',
    title: 'AI, API and MCP',
    blurb: 'Connect your assistant and your scripts.',
    icon: lucideGlyph(lucideSparkles, ICON),
    items: [
      {
        q: 'Can I connect my own AI assistant, like Claude?',
        a: (
          <>
            Yes. livediagram runs an MCP server at mcp.livediagram.app. Connect a compatible AI tool
            and, after a one-time authorisation, it can find, read, create and edit the documents in
            your account, including writing articles, building slide decks and designing logos. Its
            changes appear live for anyone on the tab, outlined so you can see them and undo them.
            See <a href="/features/diagrams#build-diagrams-with-ai">AI and MCP</a>.
          </>
        ),
        aText:
          'Yes. livediagram runs an MCP server at mcp.livediagram.app. Connect a compatible AI tool and, after a one-time authorisation, it can find, read, create and edit the documents in your account, including writing articles, building slide decks and designing logos. Its changes appear live for anyone on the tab, outlined so you can see them and undo them. See AI and MCP.',
      },
      {
        q: 'Is there AI built into the editor?',
        a: 'Optionally. Turn on AI assistance in Settings for an in-editor panel with two modes: Ask answers questions about the tab in front of you, and Clean fixes typos and tidies sizes, positions and styles. It is off by default.',
      },
      {
        q: 'Is there an API?',
        a: (
          <>
            Yes. Once you sign in, create an API token and call the REST API to read and manage your
            documents from scripts, CI or anything that can send a header. See the{' '}
            <a href="/help/developers/api-overview/">API overview</a>.
          </>
        ),
        aText:
          'Yes. Once you sign in, create an API token and call the REST API to read and manage your documents from scripts, CI or anything that can send a header. See the API overview.',
      },
      {
        q: 'Is there a command-line tool?',
        a: 'Yes. Install it from npm as @livediagram/cli (or run it with npx). It signs in through your browser and can read, edit, create, share and export documents from your terminal, which makes it handy for scripts and coding agents.',
      },
    ],
  },
  {
    id: 'import-export',
    title: 'Import and export',
    blurb: 'Bring work in, take it anywhere.',
    icon: lucideGlyph(lucideArrowUpDown, ICON),
    items: [
      {
        q: 'Can I export my work?',
        a: 'Yes. Export any tab as PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or a portable JSON file, Illustrate pages as one print-ready PDF, and a logo page as a logo kit. Hidden layers stay out of exports.',
      },
      {
        q: 'Does it work with Mermaid?',
        a: 'Yes, both ways. Paste or open a Mermaid flowchart, state diagram or ER diagram and livediagram lays it out on the canvas with every connection intact. Export any tab back to Mermaid text for your READMEs, issues and AI tools. Sequence, Gantt and pie Mermaid types are not supported.',
      },
      {
        q: 'Can I move my boards over from another tool?',
        a: 'Yes. Import draw.io diagrams (a tab per page, a whole folder at a time if you like), Excalidraw scenes (a .excalidraw file, or a PNG or SVG exported with the scene embedded) and Microsoft Whiteboard boards, and they land as editable content. Markdown and JSON import too.',
      },
      {
        q: 'Can I turn a photo of sticky notes into a board?',
        a: 'Yes, on an event storming board. Take a photo of the wall and livediagram finds the sticky notes and places them on the canvas for you to tidy up.',
      },
      {
        q: 'Can I keep a copy in my own Google Drive?',
        a: 'Yes, once you sign in. Switch on the Google Drive mirror and your documents are kept in step with matching files and folders in your own Drive, so you always hold a copy.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and your data',
    blurb: 'What we keep, and what we never do.',
    icon: lucideGlyph(lucideShieldCheck, ICON),
    items: [
      {
        q: 'Where is my data stored, and do you track me?',
        a: (
          <>
            Documents saved to your account are stored in our database on Cloudflare, and Local only
            documents stay in your browser. There are no tracking pixels, no advertising and no
            third-party analytics. We do record anonymous, first-party usage (which features get
            used, never your content or name) and show it openly on our{' '}
            <a href="/telemetry">telemetry page</a>. See the{' '}
            <a href="/help/policies/privacy-policy/">privacy policy</a> for the details.
          </>
        ),
        aText:
          'Documents saved to your account are stored in our database on Cloudflare, and Local only documents stay in your browser. There are no tracking pixels, no advertising and no third-party analytics. We do record anonymous, first-party usage (which features get used, never your content or name) and show it openly on our telemetry page. See the privacy policy for the details.',
      },
      {
        q: 'Can I keep a document off your servers entirely?',
        a: (
          <>
            Yes. Offline Mode saves a document only in your browser, never on our servers. Until you
            sign in, new documents start that way; after, you can choose it when you create one.
            Either way you can switch later. See{' '}
            <a href="/help/privacy-and-security/offline-mode/">Offline Mode</a>.
          </>
        ),
        aText:
          'Yes. Offline Mode saves a document only in your browser, never on our servers. Until you sign in, new documents start that way; after, you can choose it when you create one. Either way you can switch later. See Offline Mode.',
      },
      {
        q: 'Is my work saved automatically?',
        a: 'Yes. Every change saves on its own, with a status that shows saving, saved or a problem. Close the tab and reload, and your document comes back exactly as you left it.',
      },
      {
        q: 'How do I delete my data or account?',
        a: (
          <>
            Delete any document you own at any time, and delete your account and everything in it
            yourself from your account settings. See{' '}
            <a href="/help/account-and-data/deleting-your-data/">deleting your data</a>.
          </>
        ),
        aText:
          'Delete any document you own at any time, and delete your account and everything in it yourself from your account settings. See deleting your data.',
      },
    ],
  },
  {
    id: 'self-hosting',
    title: 'Self-hosting',
    blurb: 'Run your own copy.',
    icon: lucideGlyph(lucidePackage, ICON),
    items: [
      {
        q: 'Can I self-host livediagram?',
        a: (
          <>
            Yes. It is MIT-licensed and the source is{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              on GitHub
            </a>
            . Deploy the static frontends and the Cloudflare Workers backend to your own Cloudflare
            account and you get every feature. See{' '}
            <a href="/help/self-hosting/deploying-livediagram/">deploying livediagram</a>.
          </>
        ),
        aText:
          'Yes. It is MIT-licensed and the source is on GitHub. Deploy the static frontends and the Cloudflare Workers backend to your own Cloudflare account and you get every feature. See deploying livediagram.',
      },
      {
        q: 'Do I need sign-in or an AI key to self-host?',
        a: 'No. Without sign-in configured, your copy runs in guest mode with persistence, sharing and real-time collaboration all working. AI assistance, email and the Google Drive mirror are optional and switch on only when you add their keys.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Help and support',
    blurb: 'When something is not right.',
    icon: lucideGlyph(lucideMessagesSquare, ICON),
    items: [
      {
        q: 'A document will not load. What can I do?',
        a: (
          <>
            Try reloading first. If it still will not open, the editor offers to repair this
            browser’s saved state without touching your documents. The{' '}
            <a href="/help/troubleshooting/document-not-loading/">troubleshooting guide</a> walks
            through every step.
          </>
        ),
        aText:
          'Try reloading first. If it still will not open, the editor offers to repair this browser’s saved state without touching your documents. The troubleshooting guide walks through every step.',
      },
      {
        q: 'Is livediagram up right now?',
        a: (
          <>
            The <a href="/status">status page</a> shows the live state of every part of the service.
          </>
        ),
        aText: 'The status page shows the live state of every part of the service.',
      },
      {
        q: 'Who makes livediagram?',
        a: (
          <>
            It is built in the open by{' '}
            <a href="https://github.com/tommcclean" target="_blank" rel="noopener noreferrer">
              Tom McClean
            </a>{' '}
            and{' '}
            <a href="https://github.com/webbertakken" target="_blank" rel="noopener noreferrer">
              Webber
            </a>
            , with contributions welcome on GitHub.
          </>
        ),
        aText:
          'It is built in the open by Tom McClean and Webber, with contributions welcome on GitHub.',
      },
      {
        q: 'How do I get in touch?',
        a: (
          <>
            Use the <a href="/help/contact/">contact page</a>, or email{' '}
            <a href="mailto:hello@livediagram.app">hello@livediagram.app</a>. Bug reports and ideas
            are welcome on GitHub too.
          </>
        ),
        aText:
          'Use the contact page, or email hello@livediagram.app. Bug reports and ideas are welcome on GitHub too.',
      },
    ],
  },
];

// The plain-text answer for the JSON-LD and the page search.
export function faqAnswerText(item: FaqItem): string {
  return item.aText ?? (typeof item.a === 'string' ? item.a : '');
}
