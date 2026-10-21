import {
  lucideArrowUpDown,
  lucideGift,
  lucideMessagesSquare,
  lucidePackage,
  lucideShare2,
  lucideShieldCheck,
  lucideSparkles,
  lucideSquareKanban,
  lucideTable,
  lucideUsers,
  lucideZap,
} from '@liveplanner/icons/lucide';
import { CONTACT_FORM_URL, lucideGlyph, REPO_URL } from '@liveplanner/ui';
import type { ReactNode } from 'react';

// The /faq page's content (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): questions grouped
// into categories, each with an icon and a one-line blurb. Pure data, exempt from the line target.
//
// Each entry's `a` is what renders on the page (a ReactNode, so prose can mix in links). `aText` is the plain-text
// form the FAQPage JSON-LD emits, since schema.org's Answer.text expects a string: entries whose `a` is already a
// string omit it, the rest restate the answer sans markup. faq-content.test.tsx renders every JSX answer and fails
// if its text drifts from `aText`, so the structured data stays a faithful image of the page.
//
// The copy says "project" for what the code calls a document: a person reads projects, each a stack of Board,
// Sheet, Dashboard and Form tabs.

export type FaqItem = { q: string; a: ReactNode; aText?: string };
export type FaqCategory = {
  id: string;
  title: string;
  blurb: string;
  icon: ReturnType<typeof lucideGlyph>;
  items: FaqItem[];
};

const ICON = 18;
// Written out rather than read from @liveplanner/templates: this module ships in the FAQ's client bundle, and the
// catalogue is ~15 KB for one number. faq-content.test.tsx pins it to the listed Plan templates, blanks aside.
export const TEMPLATE_COUNT = 28;

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    blurb: 'What liveplanner is and how to begin.',
    icon: lucideGlyph(lucideZap, ICON),
    items: [
      {
        q: 'What is liveplanner?',
        a: 'A free, open-source planner you work on together in real time. Every project is a stack of tabs: Board tabs hold kanban-style boards of cards, Sheet tabs hold spreadsheets with real formulas and charts, Dashboard tabs bring boards, sheets, charts and notes onto one page, and Form tabs collect answers that turn into cards or rows. Share a link and your team works on it with you, live.',
      },
      {
        q: 'Do I need an account to use liveplanner?',
        a: (
          <>
            No. Open liveplanner and start planning straight away, with no sign-up. Your work saves
            in your browser as you go, and pressing Share puts it online for others to join. Signing
            in (also free) keeps your projects with you across devices and unlocks teams, API tokens
            and the AI connection. See <a href="/help/account-and-data/signing-in/">signing in</a>.
          </>
        ),
        aText:
          'No. Open liveplanner and start planning straight away, with no sign-up. Your work saves in your browser as you go, and pressing Share puts it online for others to join. Signing in (also free) keeps your projects with you across devices and unlocks teams, API tokens and the AI connection. See signing in.',
      },
      {
        q: 'How do I start my first project?',
        a: `Press New Project and Start Planning opens: begin from a blank board, sheet or form, or from one of ${TEMPLATE_COUNT} ready-made templates, from a Kanban Board and a Project Planner to a Budget Planner and an Event RSVP Form. The project opens straight away, and a short tour offers to show you round.`,
      },
      {
        q: 'Does it work on my phone or tablet?',
        a: 'It runs in any modern browser, with nothing to install. A laptop, desktop or tablet gives you the most room for a board or a sheet. On a phone, a dashboard stacks its slots one under another so each is easy to read and work in.',
      },
      {
        q: 'Are there keyboard shortcuts?',
        a: 'Plenty. Cmd-Z (or Ctrl-Z) undoes and Cmd-Shift-Z redoes, and Cmd-K opens the command palette for any action. In a sheet, the keys you already know from other spreadsheets move, select and fill cells.',
      },
      {
        q: 'Is there a dark mode?',
        a: 'Yes. Choose Light, Dark or System from the Appearance button, and one choice covers the planner and the help centre alike.',
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
    id: 'boards-and-cards',
    title: 'Boards and cards',
    blurb: 'Columns, cards, card types and charts.',
    icon: lucideGlyph(lucideSquareKanban, ICON),
    items: [
      {
        q: 'How do boards work?',
        a: (
          <>
            A Board tab holds columns of cards you drag along as the work moves. Split a board into
            swimlanes by assignee, type, priority or any field, and give a column a WIP limit so its
            count turns amber the moment it goes over. Widgets in the board header, such as
            Completion, Due Soon and Stale Cards, narrow the board to just those cards. See{' '}
            <a href="/help/canvas/plan-mode/boards/">boards</a>.
          </>
        ),
        aText:
          'A Board tab holds columns of cards you drag along as the work moves. Split a board into swimlanes by assignee, type, priority or any field, and give a column a WIP limit so its count turns amber the moment it goes over. Widgets in the board header, such as Completion, Due Soon and Stale Cards, narrow the board to just those cards. See boards.',
      },
      {
        q: 'What can a card hold?',
        a: (
          <>
            Everything about a piece of work: a rich-text description, a checklist that counts down
            to done, a status, an assignee, a priority, labels, start and due dates, and its own
            comment thread. A task card can belong to a Project card, so you can follow the trail
            between the two. See <a href="/help/canvas/plan-mode/cards/">cards</a>.
          </>
        ),
        aText:
          'Everything about a piece of work: a rich-text description, a checklist that counts down to done, a status, an assignee, a priority, labels, start and due dates, and its own comment thread. A task card can belong to a Project card, so you can follow the trail between the two. See cards.',
      },
      {
        q: 'Can I track my own fields?',
        a: (
          <>
            Yes. Five card types come built in (Project, Task, Note, Idea and Action), and you can
            make your own with the fields your team tracks: text, number, date, a choice, a link to
            another card and more. A board shows the card types it takes. See{' '}
            <a href="/help/canvas/plan-mode/card-types/">card types</a>.
          </>
        ),
        aText:
          'Yes. Five card types come built in (Project, Task, Note, Idea and Action), and you can make your own with the fields your team tracks: text, number, date, a choice, a link to another card and more. A board shows the card types it takes. See card types.',
      },
      {
        q: 'Can the same card sit on two boards?',
        a: (
          <>
            Yes. A card is one item, not a copy, so it can sit on the sprint board and the roadmap
            at once. Move it on one and it moves on both. See{' '}
            <a href="/help/canvas/plan-mode/items/">items</a>.
          </>
        ),
        aText:
          'Yes. A card is one item, not a copy, so it can sit on the sprint board and the roadmap at once. Move it on one and it moves on both. See items.',
      },
      {
        q: 'Can I see the plan as a timeline or a calendar?',
        a: (
          <>
            Yes. Plan views draw charts straight from the cards: a Gantt chart, due and start
            calendars you can drag cards across, cards by any field and priority by status. Because
            they read the cards themselves, a chart is never out of date. See{' '}
            <a href="/help/canvas/plan-mode/visualisations/">charts of your cards</a>.
          </>
        ),
        aText:
          'Yes. Plan views draw charts straight from the cards: a Gantt chart, due and start calendars you can drag cards across, cards by any field and priority by status. Because they read the cards themselves, a chart is never out of date. See charts of your cards.',
      },
      {
        q: 'How do I find a card again?',
        a: 'The Cards list searches every card in the project by number, title or description, newest change first. Add filters such as Type: Bug or Assignee: No assignee, or show only the cards no board is showing.',
      },
      {
        q: 'Is it good for retros?',
        a: 'Yes. On the Team Retro template, cards stay face down while the team writes, so nobody anchors on the first idea. Press Reveal, then vote for what matters most, and turn the actions into cards on the board.',
      },
      {
        q: 'What templates are there?',
        a: `${TEMPLATE_COUNT} ready-made templates, each set up with its tabs: plans such as Project Planner, Kanban Board, Bug Tracker, Team Retro, Weekly Planner, Content Calendar, Hiring Pipeline, OKRs, Product Launch, Feedback Board and Task Tracker; spreadsheets such as a Budget Planner, Timesheet, Invoice, Expense Report, Sales Pipeline and Inventory; and forms such as a Bug Report, Feedback, Feature Request, Event RSVP, Job Application and Contact form. Or start from a blank board, sheet or form.`,
      },
    ],
  },
  {
    id: 'sheets-dashboards-forms',
    title: 'Sheets, dashboards and forms',
    blurb: 'Numbers, overviews and answers.',
    icon: lucideGlyph(lucideTable, ICON),
    items: [
      {
        q: 'Is there a spreadsheet?',
        a: (
          <>
            Yes. A Sheet tab has cells with over 150 functions, number formats, sort, filter and
            freeze, edited live by everyone on it. Formulas can read the cards on a board, or list
            the cards as rows that stay linked both ways. Select some cells to chart them as bars,
            lines or a pie, and turn cells into dropdowns or checkboxes. See{' '}
            <a href="/help/canvas/plan-mode/sheets/">sheets</a>.
          </>
        ),
        aText:
          'Yes. A Sheet tab has cells with over 150 functions, number formats, sort, filter and freeze, edited live by everyone on it. Formulas can read the cards on a board, or list the cards as rows that stay linked both ways. Select some cells to chart them as bars, lines or a pie, and turn cells into dropdowns or checkboxes. See sheets.',
      },
      {
        q: 'Can I paste from Excel or Google Sheets?',
        a: 'Yes. Copy and paste works both ways with Google Sheets and Excel, and CSV files come in and go out.',
      },
      {
        q: 'What is a dashboard?',
        a: (
          <>
            A Dashboard tab is a page of rows, each split into slots, and each slot shows one thing,
            live: a board you can work on, a sheet you can edit, a chart, a figure such as
            Completion or a column total, or a note, a checklist or a key date. Start from a layout
            such as Overview or Report, or one built around your own boards, then add, move and
            resize slots as you go. See <a href="/help/canvas/plan-mode/dashboards/">dashboards</a>.
          </>
        ),
        aText:
          'A Dashboard tab is a page of rows, each split into slots, and each slot shows one thing, live: a board you can work on, a sheet you can edit, a chart, a figure such as Completion or a column total, or a note, a checklist or a key date. Start from a layout such as Overview or Report, or one built around your own boards, then add, move and resize slots as you go. See dashboards.',
      },
      {
        q: 'Can I make a form or survey?',
        a: (
          <>
            Yes. Start a Form tab from a template such as Feedback, Bug Report or Event RSVP, or a
            blank one, and build it in place. Share its link and anyone can fill it in without an
            account; every response lands as a card on a board or a row in a sheet, so the answers
            turn straight into work. See <a href="/help/canvas/plan-mode/forms/">forms</a>.
          </>
        ),
        aText:
          'Yes. Start a Form tab from a template such as Feedback, Bug Report or Event RSVP, or a blank one, and build it in place. Share its link and anyone can fill it in without an account; every response lands as a card on a board or a row in a sheet, so the answers turn straight into work. See forms.',
      },
      {
        q: 'Can people who answer a form see my plan?',
        a: 'No. Someone filling in a form sees the form and nothing else of yours. You can close it, set a closing date or a response limit at any time.',
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
        a: (
          <>
            Yes, that is the point. Share a link and teammates join the same project in real time,
            with live cursors, presence on each tab and every change landing as it is made. If you
            have not signed in, a new project starts in your browser, and the first Share syncs it
            in one step. See <a href="/help/collaboration/live-presence/">live presence</a>.
          </>
        ),
        aText:
          'Yes, that is the point. Share a link and teammates join the same project in real time, with live cursors, presence on each tab and every change landing as it is made. If you have not signed in, a new project starts in your browser, and the first Share syncs it in one step. See live presence.',
      },
      {
        q: 'What happens if two people edit the same thing at once?',
        a: 'Every change shows up for everyone live. Edits to different cards or cells merge cleanly. If two people change the same thing at the same moment, the most recent change is the one that sticks.',
      },
      {
        q: 'Can I leave comments?',
        a: (
          <>
            Yes. Every card has its own thread, and so can a single cell in a sheet. @mention a
            teammate and they get an email that opens the card, then resolve the thread when it is
            settled. See <a href="/help/collaboration/comments/">comments</a>.
          </>
        ),
        aText:
          'Yes. Every card has its own thread, and so can a single cell in a sheet. @mention a teammate and they get an email that opens the card, then resolve the thread when it is settled. See comments.',
      },
      {
        q: 'Can I set up a team with shared projects?',
        a: (
          <>
            Yes, once you sign in. Create a team from the Explorer, invite people by email, and
            everyone gets a shared space of projects. Teams have Admin and Member roles: admins
            manage membership, everyone else just gets to work. See{' '}
            <a href="/help/collaboration/teams/">teams</a>.
          </>
        ),
        aText:
          'Yes, once you sign in. Create a team from the Explorer, invite people by email, and everyone gets a shared space of projects. Teams have Admin and Member roles: admins manage membership, everyone else just gets to work. See teams.',
      },
      {
        q: 'How do I keep my projects organised?',
        a: (
          <>
            Your projects live in nested folders in the Explorer, shown as a list, as cards or as a
            sortable table. Drag a project onto a folder to file it, and tag projects to find them
            again. See <a href="/help/explorer/folders/">folders</a>.
          </>
        ),
        aText:
          'Your projects live in nested folders in the Explorer, shown as a list, as cards or as a sortable table. Drag a project onto a folder to file it, and tag projects to find them again. See folders.',
      },
      {
        q: 'How do I keep up with what changed?',
        a: (
          <>
            Your Inbox gathers the cards and comment threads waiting on you across every project,
            and Home shows what other people did while you were away. Once you sign in, emails can
            tell you too, and you choose which in Settings. See{' '}
            <a href="/help/explorer/activity/">the Inbox</a>.
          </>
        ),
        aText:
          'Your Inbox gathers the cards and comment threads waiting on you across every project, and Home shows what other people did while you were away. Once you sign in, emails can tell you too, and you choose which in Settings. See the Inbox.',
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
        a: (
          <>
            From a project you own, create an editor link (full edit access), a participant link
            (add and work on cards and fill in cells, without reshaping the boards) or a view-only
            link. Anyone with the link can join. Give a link an expiry of a week, a month or six
            months so it stops working on its own, or revoke it at any time and it stops working
            immediately. See <a href="/help/collaboration/sharing/">sharing</a>.
          </>
        ),
        aText:
          'From a project you own, create an editor link (full edit access), a participant link (add and work on cards and fill in cells, without reshaping the boards) or a view-only link. Anyone with the link can join. Give a link an expiry of a week, a month or six months so it stops working on its own, or revoke it at any time and it stops working immediately. See sharing.',
      },
      {
        q: 'Can I password-protect a project?',
        a: 'Yes. Add a password in the Share dialog and every link to that project asks for it before opening.',
      },
      {
        q: 'Can I share just one tab?',
        a: (
          <>
            Yes. When a project has more than one tab, the Share dialog lets a link open a single
            tab, as an editor, participant or view-only link, and the rest of the project stays
            private. See <a href="/help/collaboration/sharing/one-tab/">sharing one tab</a>.
          </>
        ),
        aText:
          'Yes. When a project has more than one tab, the Share dialog lets a link open a single tab, as an editor, participant or view-only link, and the rest of the project stays private. See sharing one tab.',
      },
      {
        q: 'Can I embed a board in my wiki?',
        a: (
          <>
            Yes. Any share link can be embedded as a live iframe: copy the snippet from the Share
            dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes, and
            it always shows the project as it is now. See{' '}
            <a href="/help/collaboration/sharing/embeds/">embeds</a>.
          </>
        ),
        aText:
          'Yes. Any share link can be embedded as a live iframe: copy the snippet from the Share dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes, and it always shows the project as it is now. See embeds.',
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
            Yes. liveplanner runs an MCP server at mcp.liveplanner.app. Connect a compatible AI tool
            and, after a one-time authorisation, it can find and read your projects, put boards,
            sheets and forms on their tabs, and add, edit and move cards, naming columns and fields
            the way the board shows them. Its changes appear live for anyone on the tab.{' '}
            <a href="/ai">Build with AI</a> walks you through connecting Claude, ChatGPT, Cursor and
            more.
          </>
        ),
        aText:
          'Yes. liveplanner runs an MCP server at mcp.liveplanner.app. Connect a compatible AI tool and, after a one-time authorisation, it can find and read your projects, put boards, sheets and forms on their tabs, and add, edit and move cards, naming columns and fields the way the board shows them. Its changes appear live for anyone on the tab. Build with AI walks you through connecting Claude, ChatGPT, Cursor and more.',
      },
      {
        q: 'Can an AI only read my projects, and not change them?',
        a: 'Yes. Switch on Read-only access when you approve the connection, and the AI can find and read your projects but never change them. Each connection is an API token you can revoke at any time.',
      },
      {
        q: 'Is there an API?',
        a: (
          <>
            Yes. Once you sign in, create an API token and call the REST API to read and manage your
            projects, cards and sheets from scripts, CI or anything that can send a header. See the{' '}
            <a href="/help/developers/api-overview/">API overview</a>.
          </>
        ),
        aText:
          'Yes. Once you sign in, create an API token and call the REST API to read and manage your projects, cards and sheets from scripts, CI or anything that can send a header. See the API overview.',
      },
      {
        q: 'Is there a command-line tool?',
        a: (
          <>
            Yes. Install it from npm as @liveplanner/cli (or run it with npx). It signs in through
            your browser and can read, edit, create and share projects from your terminal, which
            makes it handy for scripts and coding agents. See the{' '}
            <a href="/help/developers/cli/">CLI guide</a>.
          </>
        ),
        aText:
          'Yes. Install it from npm as @liveplanner/cli (or run it with npx). It signs in through your browser and can read, edit, create and share projects from your terminal, which makes it handy for scripts and coding agents. See the CLI guide.',
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
        q: 'Can I move my boards over from another tool?',
        a: 'Yes, as CSV. Import a CSV or TSV file onto a board and each row becomes a card, landing in the column its Status names and with the person its Assignee names; only a title is required, and one undo takes it all back. A CSV file can also become a sheet.',
      },
      {
        q: 'Can I export my work?',
        a: 'Yes. Export a board as CSV, an image, a PDF or a Markdown outline, and a sheet as CSV. Your work is never locked in.',
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
            Projects saved to your account are stored in our database on Cloudflare, and projects in
            This Browser stay in your browser. There are no tracking pixels, no advertising and no
            third-party analytics. We do record anonymous, first-party usage (which features get
            used, never your content or name) and show it openly on our{' '}
            <a href="/telemetry">telemetry page</a>. See the{' '}
            <a href="/help/policies/privacy-policy/">privacy policy</a> for the details.
          </>
        ),
        aText:
          'Projects saved to your account are stored in our database on Cloudflare, and projects in This Browser stay in your browser. There are no tracking pixels, no advertising and no third-party analytics. We do record anonymous, first-party usage (which features get used, never your content or name) and show it openly on our telemetry page. See the privacy policy for the details.',
      },
      {
        q: 'Can I keep a project off your servers entirely?',
        a: 'Yes. Offline Mode saves a project only in your browser, never on our servers. Until you sign in, new projects start that way; after, you can choose it when you create one. Either way you can switch later.',
      },
      {
        q: 'What happens to my projects if I clear my browser data?',
        a: 'A project kept only in your browser goes with it, so share it or sign in first. Share syncs a project online in one step, and after you sign in liveplanner offers to move every browser-only project into your account. Projects saved to your account are never touched.',
      },
      {
        q: 'Is my work saved automatically?',
        a: 'Yes. Every change saves on its own, with a status that shows saving, saved or a problem. Close the tab and reload, and your project comes back exactly as you left it.',
      },
      {
        q: 'What if I delete something by accident?',
        a: (
          <>
            Press Cmd-Z (or Ctrl-Z) to step back your recent edits; undo rewinds your own changes,
            not a teammate’s. Deleted projects wait in the Trash for 30 days before they are removed
            for good, so you can restore them. See{' '}
            <a href="/help/account-and-data/trash/">the Trash</a>.
          </>
        ),
        aText:
          'Press Cmd-Z (or Ctrl-Z) to step back your recent edits; undo rewinds your own changes, not a teammate’s. Deleted projects wait in the Trash for 30 days before they are removed for good, so you can restore them. See the Trash.',
      },
      {
        q: 'How do I delete my data or account?',
        a: (
          <>
            Delete any project you own at any time, and delete your account and everything in it
            yourself from your account settings. See{' '}
            <a href="/help/account-and-data/deleting-your-data/">deleting your data</a>.
          </>
        ),
        aText:
          'Delete any project you own at any time, and delete your account and everything in it yourself from your account settings. See deleting your data.',
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
        q: 'Can I self-host liveplanner?',
        a: (
          <>
            Yes. It is MIT-licensed and the source is{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              on GitHub
            </a>
            . Deploy the static frontends and the Cloudflare Workers backend to your own Cloudflare
            account and you get every feature.
          </>
        ),
        aText:
          'Yes. It is MIT-licensed and the source is on GitHub. Deploy the static frontends and the Cloudflare Workers backend to your own Cloudflare account and you get every feature.',
      },
      {
        q: 'Do I need sign-in to self-host?',
        a: 'No. Without sign-in configured, your copy runs in guest mode with saving, sharing and real-time collaboration all working. Teams, API tokens and the MCP server need accounts, and email switches on once sign-in and its own key are set up.',
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
        q: 'A project will not load. What can I do?',
        a: 'Try reloading first. If it still will not open, liveplanner offers to repair this browser’s saved state without touching your projects.',
      },
      {
        q: 'Is liveplanner up right now?',
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
        q: 'Who makes liveplanner?',
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
