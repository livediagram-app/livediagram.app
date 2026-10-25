import {
  lucideArrowUpDown,
  lucideGift,
  lucideMessagesSquare,
  lucideShare2,
  lucideShieldCheck,
  lucideSparkles,
  lucideSquareKanban,
  lucideTable,
  lucideUsers,
  lucideZap,
} from '@liveworkspace/icons/lucide';
import { CONTACT_FORM_URL, lucideGlyph } from '@liveplanner/ui';
import type { FaqCategory } from '@liveworkspace/marketing-site/lib/faq';

// The /faq page's content (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): questions grouped
// into categories, each with an icon and a one-line blurb. Pure data, exempt from the line target.
// The shape, and what `a` and `aText` are, is @liveworkspace/marketing-site's lib/faq.ts. faq-content.test.tsx
// renders every JSX answer and fails if its text drifts from `aText`, so the structured data stays a faithful
// image of the page.
//
// The copy says "project" for what the code calls a project: a person reads projects, each a stack of Board,
// Sheet, Dashboard and Form tabs.

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
        a: 'A free planner you work on together in real time, with no ads and no trackers. Every plan is a stack of tabs: Board tabs hold kanban-style boards of cards, Sheet tabs hold spreadsheets with real formulas and charts, Dashboard tabs bring boards, sheets, charts and notes onto one page, and Form tabs collect answers that turn into cards or rows. Share a link and your team works on it with you, live.',
      },
      {
        q: 'Do I need an account to use liveplanner?',
        a: (
          <>
            No. Open liveplanner and start planning straight away, with no sign-up. Your work saves
            in your browser as you go, and pressing Share puts it online for others to join. Signing
            in (also free) keeps your plans with you across devices and unlocks teams, API tokens
            and the AI connection. See <a href="/help/account-and-data/signing-in/">signing in</a>.
          </>
        ),
        aText:
          'No. Open liveplanner and start planning straight away, with no sign-up. Your work saves in your browser as you go, and pressing Share puts it online for others to join. Signing in (also free) keeps your plans with you across devices and unlocks teams, API tokens and the AI connection. See signing in.',
      },
      {
        q: 'How do I start my first plan?',
        a: `Press New Plan and Start Planning opens: begin from a blank board, sheet or form, or from one of ${TEMPLATE_COUNT} ready-made templates, from a Kanban Board and a Project Planner to a Budget Planner and an Event RSVP Form. The plan opens straight away, and a short tour offers to show you round.`,
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
    id: 'free',
    title: 'Free to use',
    blurb: 'No paid tier, no catch.',
    icon: lucideGlyph(lucideGift, ICON),
    items: [
      {
        q: 'Is it really free?',
        a: 'Yes. Every feature is free for everyone, with no paid tier, no trial and no plan to introduce one. If we ship it, every user gets it.',
      },
      {
        q: 'How is it free? What is the catch?',
        a: (
          <>
            There is no catch. liveplanner shows no ads, runs no third-party trackers and never
            sells your data. The <a href="https://liveworkspace.app/privacy">privacy policy</a> sets
            out what the service does with your data, and you can export your work whenever you
            like.
          </>
        ),
        aText:
          'There is no catch. liveplanner shows no ads, runs no third-party trackers and never sells your data. The privacy policy sets out what the service does with your data, and you can export your work whenever you like.',
      },
      {
        q: 'Will features ever move behind a paywall?',
        a: 'No. There are no "Pro" features and no billing anywhere in liveplanner. Everyone gets the same product.',
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
            <a href="/help/plan/boards/">boards</a>.
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
            between the two. See <a href="/help/plan/cards/">cards</a>.
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
            <a href="/help/plan/card-types/">card types</a>.
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
            at once. Move it on one and it moves on both. See <a href="/help/plan/items/">items</a>.
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
            <a href="/help/plan/visualisations/">charts of your cards</a>.
          </>
        ),
        aText:
          'Yes. Plan views draw charts straight from the cards: a Gantt chart, due and start calendars you can drag cards across, cards by any field and priority by status. Because they read the cards themselves, a chart is never out of date. See charts of your cards.',
      },
      {
        q: 'How do I find a card again?',
        a: 'The Cards list searches every card in the plan by number, title or description, newest change first. Add filters such as Type: Bug or Assignee: No assignee, or show only the cards no board is showing.',
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
            <a href="/help/plan/sheets/">sheets</a>.
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
            resize slots as you go. See <a href="/help/plan/dashboards/">dashboards</a>.
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
            turn straight into work. See <a href="/help/plan/forms/">forms</a>.
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
            Yes, that is the point. Share a link and teammates join the same plan in real time, with
            live cursors, presence on each tab and every change landing as it is made. If you have
            not signed in, a new plan starts in your browser, and the first Share syncs it in one
            step. See <a href="/help/collaboration/live-presence/">live presence</a>.
          </>
        ),
        aText:
          'Yes, that is the point. Share a link and teammates join the same plan in real time, with live cursors, presence on each tab and every change landing as it is made. If you have not signed in, a new plan starts in your browser, and the first Share syncs it in one step. See live presence.',
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
        q: 'Can I set up a team with shared plans?',
        a: (
          <>
            Yes, once you sign in. Teams belong to your liveworkspace account: choose Manage Teams
            in the Explorer sidebar to create one and invite people by email on liveworkspace.app.
            Each team then shows in the Explorer as a space with its own shared folders of plans.
            Teams have Admin and Member roles: admins manage membership, everyone else just gets to
            work. See <a href="/help/collaboration/teams/">teams</a>.
          </>
        ),
        aText:
          'Yes, once you sign in. Teams belong to your liveworkspace account: choose Manage Teams in the Explorer sidebar to create one and invite people by email on liveworkspace.app. Each team then shows in the Explorer as a space with its own shared folders of plans. Teams have Admin and Member roles: admins manage membership, everyone else just gets to work. See teams.',
      },
      {
        q: 'How do I keep my plans organised?',
        a: (
          <>
            Your plans live in nested folders in the Explorer, shown as a list, as cards or as a
            sortable table. Drag a plan onto a folder to file it, and tag plans to find them again.
            See <a href="/help/explorer/folders/">folders</a>.
          </>
        ),
        aText:
          'Your plans live in nested folders in the Explorer, shown as a list, as cards or as a sortable table. Drag a plan onto a folder to file it, and tag plans to find them again. See folders.',
      },
      {
        q: 'How do I keep up with what changed?',
        a: (
          <>
            Your Inbox gathers the cards and comment threads waiting on you across every plan, and
            Home shows what other people did while you were away. Once you sign in, emails can tell
            you too, and you choose which in Settings. See{' '}
            <a href="/help/explorer/activity/">the Inbox</a>.
          </>
        ),
        aText:
          'Your Inbox gathers the cards and comment threads waiting on you across every plan, and Home shows what other people did while you were away. Once you sign in, emails can tell you too, and you choose which in Settings. See the Inbox.',
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
            From a plan you own, create an editor link (full edit access), a participant link (add
            and work on cards and fill in cells, without reshaping the boards) or a view-only link.
            Anyone with the link can join. Give a link an expiry of a week, a month or six months so
            it stops working on its own, or revoke it at any time and it stops working immediately.
            See <a href="/help/collaboration/sharing/">sharing</a>.
          </>
        ),
        aText:
          'From a plan you own, create an editor link (full edit access), a participant link (add and work on cards and fill in cells, without reshaping the boards) or a view-only link. Anyone with the link can join. Give a link an expiry of a week, a month or six months so it stops working on its own, or revoke it at any time and it stops working immediately. See sharing.',
      },
      {
        q: 'Can I password-protect a plan?',
        a: 'Yes. Add a password in the Share dialog and every link to that plan asks for it before opening.',
      },
      {
        q: 'Can I share just one tab?',
        a: (
          <>
            Yes. When a plan has more than one tab, the Share dialog lets a link open a single tab,
            as an editor, participant or view-only link, and the rest of the plan stays private. See{' '}
            <a href="/help/collaboration/sharing/one-tab/">sharing one tab</a>.
          </>
        ),
        aText:
          'Yes. When a plan has more than one tab, the Share dialog lets a link open a single tab, as an editor, participant or view-only link, and the rest of the plan stays private. See sharing one tab.',
      },
      {
        q: 'Can I embed a board in my wiki?',
        a: (
          <>
            Yes. Any share link can be embedded as a live iframe: copy the snippet from the Share
            dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes, and
            it always shows the plan as it is now. See{' '}
            <a href="/help/collaboration/sharing/embeds/">embeds</a>.
          </>
        ),
        aText:
          'Yes. Any share link can be embedded as a live iframe: copy the snippet from the Share dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes, and it always shows the plan as it is now. See embeds.',
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
            and, after a one-time authorisation, it can find and read your plans, put boards, sheets
            and forms on their tabs, and add, edit and move cards, naming columns and fields the way
            the board shows them. Its changes appear live for anyone on the tab.{' '}
            <a href="/ai">Build with AI</a> walks you through connecting Claude, ChatGPT, Cursor and
            more.
          </>
        ),
        aText:
          'Yes. liveplanner runs an MCP server at mcp.liveplanner.app. Connect a compatible AI tool and, after a one-time authorisation, it can find and read your plans, put boards, sheets and forms on their tabs, and add, edit and move cards, naming columns and fields the way the board shows them. Its changes appear live for anyone on the tab. Build with AI walks you through connecting Claude, ChatGPT, Cursor and more.',
      },
      {
        q: 'Can an AI only read my plans, and not change them?',
        a: 'Yes. Switch on Read-only access when you approve the connection, and the AI can find and read your plans but never change them. Each connection is an API token you can revoke at any time.',
      },
      {
        q: 'Is there an API?',
        a: (
          <>
            Yes. Once you sign in, create an API token and call the REST API to read and manage your
            plans, cards and sheets from scripts, CI or anything that can send a header. See the{' '}
            <a href="/help/developers/api-overview/">API overview</a>.
          </>
        ),
        aText:
          'Yes. Once you sign in, create an API token and call the REST API to read and manage your plans, cards and sheets from scripts, CI or anything that can send a header. See the API overview.',
      },
      {
        q: 'Is there a command-line tool?',
        a: (
          <>
            Yes. Install it from npm as @liveplanner/cli (or run it with npx). It signs in through
            your browser and can read, edit, create and share plans from your terminal, which makes
            it handy for scripts and coding agents. See the{' '}
            <a href="/help/developers/cli/">CLI guide</a>.
          </>
        ),
        aText:
          'Yes. Install it from npm as @liveplanner/cli (or run it with npx). It signs in through your browser and can read, edit, create and share plans from your terminal, which makes it handy for scripts and coding agents. See the CLI guide.',
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
        a: 'Yes. Export a board as CSV, a Markdown outline, an image (PNG or SVG) or a PDF; a sheet as CSV, an image or a PDF; and a dashboard or form as JSON you can import into another plan. Your work is never locked in.',
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
            Plans saved to your account are stored in our database on Cloudflare, and plans in This
            Browser stay in your browser. There are no tracking pixels, no advertising and no
            third-party analytics. We do record anonymous, first-party usage (which features get
            used, never your content or name) and show it openly on our{' '}
            <a href="/telemetry">telemetry page</a>. See the{' '}
            <a href="https://liveworkspace.app/privacy">privacy policy</a> for the details.
          </>
        ),
        aText:
          'Plans saved to your account are stored in our database on Cloudflare, and plans in This Browser stay in your browser. There are no tracking pixels, no advertising and no third-party analytics. We do record anonymous, first-party usage (which features get used, never your content or name) and show it openly on our telemetry page. See the privacy policy for the details.',
      },
      {
        q: 'Can I keep a plan off your servers entirely?',
        a: 'Yes. Offline Mode saves a plan only in your browser, never on our servers. Until you sign in, new plans start that way; after, you can choose it when you create one. Either way you can switch later.',
      },
      {
        q: 'What happens to my plans if I clear my browser data?',
        a: 'A plan kept only in your browser goes with it, so share it or sign in first. Share syncs a plan online in one step, and after you sign in liveplanner offers to move every browser-only plan into your account. Plans saved to your account are never touched.',
      },
      {
        q: 'Is my work saved automatically?',
        a: 'Yes. Every change saves on its own, with a status that shows saving, saved or a problem. Close the tab and reload, and your plan comes back exactly as you left it.',
      },
      {
        q: 'What if I delete something by accident?',
        a: (
          <>
            Press Cmd-Z (or Ctrl-Z) to step back your recent edits; undo rewinds your own changes,
            not a teammate’s. Deleted plans wait in the Trash for 30 days before they are removed
            for good, so you can restore them. See{' '}
            <a href="/help/account-and-data/trash/">the Trash</a>.
          </>
        ),
        aText:
          'Press Cmd-Z (or Ctrl-Z) to step back your recent edits; undo rewinds your own changes, not a teammate’s. Deleted plans wait in the Trash for 30 days before they are removed for good, so you can restore them. See the Trash.',
      },
      {
        q: 'How do I delete my data or account?',
        a: (
          <>
            Delete any plan you own at any time, and delete your account and everything in it
            yourself from your account settings. See{' '}
            <a href="/help/account-and-data/deleting-your-data/">deleting your data</a>.
          </>
        ),
        aText:
          'Delete any plan you own at any time, and delete your account and everything in it yourself from your account settings. See deleting your data.',
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
        q: 'A plan will not load. What can I do?',
        a: 'Try reloading first. If it still will not open, liveplanner offers to repair this browser’s saved state without touching your plans.',
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
        a: 'liveplanner is made by Tom McClean and Webber.',
      },
      {
        q: 'How do I get in touch?',
        a: (
          <>
            Use the <a href="/help/contact/">contact page</a>, or send us a message through the{' '}
            <a href={CONTACT_FORM_URL} target="_blank" rel="noopener noreferrer">
              contact form
            </a>
            . Bug reports and ideas are welcome there too.
          </>
        ),
        aText:
          'Use the contact page, or send us a message through the contact form. Bug reports and ideas are welcome there too.',
      },
    ],
  },
];
