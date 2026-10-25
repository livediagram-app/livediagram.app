import {
  lucideArrowUpDown,
  lucideGift,
  lucideMessagesSquare,
  lucideShapes,
  lucideShare2,
  lucideShieldCheck,
  lucideSparkles,
  lucideUsers,
  lucideZap,
} from '@livedocuments/icons/lucide';
import { CONTACT_FORM_URL, lucideGlyph, REPO_URL } from '@livedocuments/ui';
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
// Written out rather than read from @livedocuments/templates: this module ships in the FAQ's client bundle, and the
// catalogue is ~15 KB for one number. faq-content.test.tsx pins it to TEMPLATES.length.
export const TEMPLATE_COUNT = 23;
// The template categories, pinned to TEMPLATE_CATEGORIES.length by faq-content.test.tsx the same way.
export const TEMPLATE_CATEGORY_COUNT = 2;
// The slide layouts, pinned to the catalogue by faq-content.test.tsx like the template count.
export const SLIDE_LAYOUT_COUNT = 61;
// The infographic page layouts, pinned the same way.
export const PAGE_LAYOUT_COUNT = 92;

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    blurb: 'What livedocuments is and how to begin.',
    icon: lucideGlyph(lucideZap, ICON),
    items: [
      {
        q: 'What is livedocuments?',
        a: 'A free, real-time editor for documents made of pages: articles you write like a doc, slide decks you present, and infographics and posters for print or social. Every document is a stack of tabs, each holding its pages, and your team can work on any of them with you live.',
      },
      {
        q: 'Do I need an account to use livedocuments?',
        a: (
          <>
            No. Open the editor and start straight away, with no sign-up. Your work saves in your
            browser as you go, and pressing Share puts it online for others to join. Signing in
            (also free) keeps your documents with you across devices and unlocks teams, API tokens
            and the AI connection. See{' '}
            <a href="/help/getting-started/guest-vs-account/">guest vs account</a>.
          </>
        ),
        aText:
          'No. Open the editor and start straight away, with no sign-up. Your work saves in your browser as you go, and pressing Share puts it online for others to join. Signing in (also free) keeps your documents with you across devices and unlocks teams, API tokens and the AI connection. See guest vs account.',
      },
      {
        q: 'How do I start my first document?',
        a: `Press Start and choose what you are making: an article, a slide deck or an infographic. Begin from a blank page or one of ${TEMPLATE_COUNT} templates, and a short tour offers to show you round.`,
      },
      {
        q: 'Does it work on my phone or tablet?',
        a: (
          <>
            It runs in any modern browser, with nothing to install. A laptop, desktop or tablet
            gives you the full editor. Small phone screens are best for reading, presenting and
            light edits. See <a href="/help/supported-devices/">supported devices</a>.
          </>
        ),
        aText:
          'It runs in any modern browser, with nothing to install. A laptop, desktop or tablet gives you the full editor. Small phone screens are best for reading, presenting and light edits. See supported devices.',
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
      {
        q: 'Can I use it with a keyboard or a screen reader?',
        a: (
          <>
            Yes. The canvas is a stop in the Tab order: move through its elements and edit them with
            the keyboard, and screen readers announce what is selected. See{' '}
            <a href="/help/getting-started/accessibility/">accessibility</a>.
          </>
        ),
        aText:
          'Yes. The canvas is a stop in the Tab order: move through its elements and edit them with the keyboard, and screen readers announce what is selected. See accessibility.',
      },
      {
        q: 'Is there a dark mode?',
        a: (
          <>
            Yes. Choose Light, Dark or System from the Appearance button, and one choice covers the
            editor and the help centre alike. See <a href="/help/tools/dark-mode/">dark mode</a>.
          </>
        ),
        aText:
          'Yes. Choose Light, Dark or System from the Appearance button, and one choice covers the editor and the help centre alike. See dark mode.',
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
            . You can read it, fork it, or contribute.
          </>
        ),
        aText:
          'Yes. The whole codebase is MIT-licensed and public on GitHub. You can read it, fork it, or contribute.',
      },
      {
        q: 'Will features ever move behind a paywall?',
        a: 'No. There are no "Pro" features and no billing anywhere in the code. Every feature ships to every user.',
      },
    ],
  },
  {
    id: 'creating',
    title: 'Creating',
    blurb: 'Articles, decks and infographics.',
    icon: lucideGlyph(lucideShapes, ICON),
    items: [
      {
        q: 'What can I make with it?',
        a: 'Articles, project briefs and reports, slide decks and keynotes, posters, one-pagers and social posts, infographics and data stories, résumés and recipe cards, storyboards and a to-scale floor plan. Pages hold shapes, text, pictures, icons, tables and charts.',
      },
      {
        q: 'How many templates and themes are there?',
        a: `${TEMPLATE_COUNT} starter templates across ${TEMPLATE_CATEGORY_COUNT} categories, and twenty-four themes that recolour every page in one click, including dark and multi-colour schemes. On top of the templates, a page starts from ${PAGE_LAYOUT_COUNT} infographic layouts or ${SLIDE_LAYOUT_COUNT} slide layouts. You can also build and save a colour scheme of your own.`,
      },
      {
        q: 'Can I write documents in it?',
        a: (
          <>
            Yes. Write an article straight onto pages: Markdown shortcuts, a / menu for every block,
            and clean paste from web pages, Google Docs and Word. Writing flows onto new pages as it
            grows, pictures, charts and tables sit in the text, and teammates comment on the words
            themselves. Pick one of five looks, then export every page as a PDF. See{' '}
            <a href="/help/pages/articles/">Articles</a>.
          </>
        ),
        aText:
          'Yes. Write an article straight onto pages: Markdown shortcuts, a / menu for every block, and clean paste from web pages, Google Docs and Word. Writing flows onto new pages as it grows, pictures, charts and tables sit in the text, and teammates comment on the words themselves. Pick one of five looks, then export every page as a PDF. See Articles.',
      },
      {
        q: 'Can I make and present a slide deck?',
        a: (
          <>
            Yes. Add 16:9 or 4:3 slide pages, each started from one of {SLIDE_LAYOUT_COUNT} layouts,
            and present the deck full screen. Any page can join the deck, from any tab. Each slide
            can carry presenter notes and a time budget, and a laser pointer and spotlight help you
            guide the room. Presenting happens on your screen only, so collaborators carry on
            working. See <a href="/help/pages/slide-pages/">slide pages</a>.
          </>
        ),
        aText: `Yes. Add 16:9 or 4:3 slide pages, each started from one of ${SLIDE_LAYOUT_COUNT} layouts, and present the deck full screen. Any page can join the deck, from any tab. Each slide can carry presenter notes and a time budget, and a laser pointer and spotlight help you guide the room. Presenting happens on your screen only, so collaborators carry on working. See slide pages.`,
      },
      {
        q: 'Can I design infographics or posters?',
        a: (
          <>
            Yes. Lay out pages in print sizes (A4, US Letter, A3) or social sizes, starting from one
            of {PAGE_LAYOUT_COUNT} layouts, and export them print-ready as PDF, PNG or SVG. See{' '}
            <a href="/help/pages/working-with-pages/">working with pages</a>.
          </>
        ),
        aText: `Yes. Lay out pages in print sizes (A4, US Letter, A3) or social sizes, starting from one of ${PAGE_LAYOUT_COUNT} layouts, and export them print-ready as PDF, PNG or SVG. See working with pages.`,
      },
      {
        q: 'Can I organise a big document?',
        a: 'Yes. A document holds as many tabs as you need, which you can group into folders, and a Contents sidebar lists every page with a picture of it. Your documents live in nested folders in the Explorer, shown as a list, as cards or as a sortable Details table, with favourites and tags to find them again. Drag a document onto a folder to file it.',
      },
      {
        q: 'Can I add pictures?',
        a: (
          <>
            Yes. Upload an image once and reuse it from your gallery, or search Openverse for an
            openly licensed photo or illustration without leaving the editor. See{' '}
            <a href="/help/palette/tools/images/">images</a>.
          </>
        ),
        aText:
          'Yes. Upload an image once and reuse it from your gallery, or search Openverse for an openly licensed photo or illustration without leaving the editor. See images.',
      },
      {
        q: 'Can I show data, like a chart?',
        a: (
          <>
            Yes. Add a table and paste cells straight in from a spreadsheet, or place a pie, bar or
            line chart, a progress bar, a rating or a timeline on a page. See{' '}
            <a href="/help/palette/tools/data-elements/">data elements</a>.
          </>
        ),
        aText:
          'Yes. Add a table and paste cells straight in from a spreadsheet, or place a pie, bar or line chart, a progress bar, a rating or a timeline on a page. See data elements.',
      },
      {
        q: 'Can I undo a mistake?',
        a: 'Yes. Press Cmd-Z (or Ctrl-Z) to step back your recent edits and Cmd-Shift-Z to bring one back; the buttons also sit in the bottom-right corner. Undo is personal, so it rewinds your own changes, not a teammate’s; if you both changed the same element, it puts that element back as you had it.',
      },
      {
        q: 'What if I delete something by accident?',
        a: 'Deleted documents wait in the Trash for 30 days before they are removed for good, so you can restore them from the Trash in the Explorer or in Settings › Account. Team documents go to their team’s Trash.',
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
        a: 'Yes, that is the point. Share a link and teammates join the same document in real time, with live cursors, selection rings, presence on each tab, comments and a laser pointer. If you have not signed in, a new document starts in your browser, and the first Share syncs it in one step.',
      },
      {
        q: 'What happens if two people edit the same thing at once?',
        a: 'Every change shows up for everyone live. Edits to different elements merge cleanly. If two people change the same element at the same moment, the most recent change is the one that sticks.',
      },
      {
        q: 'Can I leave comments and assign follow-ups?',
        a: 'Yes. Comment on anything on a page, or on the words of an article, and reply in threads, then resolve them when they are done. You can also attach an action and assign it to a teammate, so the follow-ups stay with the document instead of getting lost.',
      },
      {
        q: 'Can I set up a team with shared documents?',
        a: 'Yes, once you sign in. Create a team from the Explorer, invite people by email, and everyone gets a shared library of documents. Teams have Admin and Member roles: admins manage membership, everyone else just gets to work.',
      },
      {
        q: 'Can I follow what someone else is looking at?',
        a: (
          <>
            Yes. Open Collaborators from the avatars on the tab bar and press Follow beside a
            teammate: your view goes wherever theirs goes, until you move away yourself. See{' '}
            <a href="/help/canvas/follow-along/">following along</a>.
          </>
        ),
        aText:
          'Yes. Open Collaborators from the avatars on the tab bar and press Follow beside a teammate: your view goes wherever theirs goes, until you move away yourself. See following along.',
      },
      {
        q: 'Can I stop a finished tab being changed?',
        a: (
          <>
            Yes. Lock it from the tab’s menu and the whole canvas becomes read-only until someone
            unlocks it, with a padlock beside its name. You can also lock single elements or whole
            layers. See <a href="/help/tabs/locking-tabs/">locking a tab</a>.
          </>
        ),
        aText:
          'Yes. Lock it from the tab’s menu and the whole canvas becomes read-only until someone unlocks it, with a padlock beside its name. You can also lock single elements or whole layers. See locking a tab.',
      },
      {
        q: 'How do I keep up with what changed?',
        a: (
          <>
            Your Inbox gathers the actions and comment threads waiting on you across every document,
            and Home shows what other people did while you were away. Once you sign in, emails can
            tell you too, and you choose which in Settings. See{' '}
            <a href="/help/explorer/activity/">the Inbox</a>.
          </>
        ),
        aText:
          'Your Inbox gathers the actions and comment threads waiting on you across every document, and Home shows what other people did while you were away. Once you sign in, emails can tell you too, and you choose which in Settings. See the Inbox.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing and embedding',
    blurb: 'Links, passwords and embeds.',
    icon: lucideGlyph(lucideShare2, ICON),
    items: [
      {
        q: 'How do share links work?',
        a: 'From a document you own, create an editor link (full edit access) or a view-only link. Anyone with the link can join. Give a link an expiry of a week, a month or six months so it stops working on its own, or revoke it at any time and it stops working immediately.',
      },
      {
        q: 'Can I password-protect a document?',
        a: 'Yes. Add a password in the Share dialog and every link to that document asks for it before opening.',
      },
      {
        q: 'Can I share just one tab?',
        a: (
          <>
            Yes. When a document has more than one tab, the Share dialog lets a link open a single
            tab, as an editor or view-only link, and the rest of the document stays private. See{' '}
            <a href="/help/collaboration/sharing/one-tab/">sharing one tab</a>.
          </>
        ),
        aText:
          'Yes. When a document has more than one tab, the Share dialog lets a link open a single tab, as an editor or view-only link, and the rest of the document stays private. See sharing one tab.',
      },
      {
        q: 'Can I embed a document in my docs or wiki?',
        a: 'Yes. Any share link can be embedded as a live-updating iframe: an editor link embeds an editable document, and a view-only link a read-only one. Copy the snippet from the Share dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes; it always shows the current state of the pages.',
      },
      {
        q: 'Can I show a page where iframes are blocked, like a README?',
        a: (
          <>
            Yes. A live image is a plain image URL that follows your document, redrawn after each
            save, so a GitHub README or a doc always shows the current version. See{' '}
            <a href="/help/collaboration/sharing/live-image/">live images</a>.
          </>
        ),
        aText:
          'Yes. A live image is a plain image URL that follows your document, redrawn after each save, so a GitHub README or a doc always shows the current version. See live images.',
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
            Yes. livedocuments runs an MCP server at mcp.livedocuments.app. Connect a compatible AI
            tool and, after a one-time authorisation, it can find, read, create and edit the
            documents in your account, including writing articles, building slide decks and laying
            out infographics. Its changes appear live for anyone on the tab, outlined so you can see
            them and undo them. <a href="/ai">Build with AI</a> walks you through connecting Claude,
            ChatGPT, Cursor and more.
          </>
        ),
        aText:
          'Yes. livedocuments runs an MCP server at mcp.livedocuments.app. Connect a compatible AI tool and, after a one-time authorisation, it can find, read, create and edit the documents in your account, including writing articles, building slide decks and laying out infographics. Its changes appear live for anyone on the tab, outlined so you can see them and undo them. Build with AI walks you through connecting Claude, ChatGPT, Cursor and more.',
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
        a: 'Yes. Install it from npm as @livedocuments/cli (or run it with npx). It signs in through your browser and can read, edit, create, share and export documents from your terminal, which makes it handy for scripts and coding agents.',
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
        a: 'Yes. Export pages as PNG, SVG, one print-ready PDF or an animated GIF, and any tab as a portable JSON file to import back with full fidelity. Hidden layers stay out of image exports unless you switch them on.',
      },
      {
        q: 'Can I bring in writing from elsewhere?',
        a: 'Yes. Paste into an article from web pages, Google Docs and Word and it keeps its headings, lists and links. Through the MCP server, the CLI or the API, an AI assistant or a script can write an article from Markdown.',
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
            Documents saved to your account are stored in our database on Cloudflare, and documents
            in This Browser stay in your browser. There are no tracking pixels, no advertising and
            no third-party analytics. We do record anonymous, first-party usage (which features get
            used, never your content or name) and show it openly on our{' '}
            <a href="/telemetry">telemetry page</a>. See the{' '}
            <a href="/help/policies/privacy-policy/">privacy policy</a> for the details.
          </>
        ),
        aText:
          'Documents saved to your account are stored in our database on Cloudflare, and documents in This Browser stay in your browser. There are no tracking pixels, no advertising and no third-party analytics. We do record anonymous, first-party usage (which features get used, never your content or name) and show it openly on our telemetry page. See the privacy policy for the details.',
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
        q: 'What happens to my documents if I clear my browser data?',
        a: (
          <>
            A document kept only in your browser goes with it, so share it or sign in first. Share
            syncs a document online in one step, and after you sign in livedocuments offers to move
            every browser-only document into your account. Documents saved to your account are never
            touched. See <a href="/help/privacy-and-security/offline-mode/">Offline Mode</a>.
          </>
        ),
        aText:
          'A document kept only in your browser goes with it, so share it or sign in first. Share syncs a document online in one step, and after you sign in livedocuments offers to move every browser-only document into your account. Documents saved to your account are never touched. See Offline Mode.',
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
        q: 'Is livedocuments up right now?',
        a: (
          <>
            The <a href="/status">status page</a> lists every part of the service and notes any
            incident we are working on. If it loads, the site is up.
          </>
        ),
        aText:
          'The status page lists every part of the service and notes any incident we are working on. If it loads, the site is up.',
      },
      {
        q: 'Who makes livedocuments?',
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
            Use the <a href="/help/contact/">contact page</a>, or send us a message through the{' '}
            <a href={CONTACT_FORM_URL} target="_blank" rel="noopener noreferrer">
              contact form
            </a>
            . Bug reports and ideas are welcome on GitHub too.
          </>
        ),
        aText:
          'Use the contact page, or send us a message through the contact form. Bug reports and ideas are welcome on GitHub too.',
      },
    ],
  },
];

// The plain-text answer for the JSON-LD and the page search.
export function faqAnswerText(item: FaqItem): string {
  return item.aText ?? (typeof item.a === 'string' ? item.a : '');
}
