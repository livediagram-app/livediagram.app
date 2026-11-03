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
} from '@liveworkspace/icons/lucide';
import { CONTACT_FORM_URL, lucideGlyph, REPO_URL, STATUS_PAGE_URL } from '@livehuddle/ui';
import type { FaqCategory } from '@liveworkspace/marketing-site/lib/faq';

// The /faq page's content (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): questions grouped
// into categories, each with an icon and a one-line blurb. Pure data, exempt from the line target.
// The shape, and what `a` and `aText` are, is @liveworkspace/marketing-site's lib/faq.ts. faq-content.test.tsx
// renders every JSX answer and fails if its text drifts from `aText`, so the structured data stays a faithful
// image of the page.

const ICON = 18;
// Written out rather than read from @livehuddle/templates: this module ships in the FAQ's client bundle, and the
// catalogue is ~15 KB for one number. faq-content.test.tsx pins it to TEMPLATES.length.
export const TEMPLATE_COUNT = 39;
// The template categories, pinned to TEMPLATE_CATEGORIES.length by faq-content.test.tsx the same way.
export const TEMPLATE_CATEGORY_COUNT = 12;

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    blurb: 'What livehuddle is and how to begin.',
    icon: lucideGlyph(lucideZap, ICON),
    items: [
      {
        q: 'What is livehuddle?',
        a: 'A free, real-time Space for meetings and workshops. Open a Space and you walk in as your own little character, gather the team round the table, and run the session on the board with a timer, dot votes, polls and quizzes built in. Share a link and everyone is in the same Space, live, with no account needed.',
      },
      {
        q: 'Do I need an account to use livehuddle?',
        a: (
          <>
            No. Open a Space straight away, with no sign-up. Your work saves in your browser as you
            go, and pressing Share puts it online for others to join. Signing in (also free) keeps
            your spaces with you across devices and unlocks teams, API tokens and the AI connection.
            See <a href="/help/getting-started/guest-vs-account/">guest vs account</a>.
          </>
        ),
        aText:
          'No. Open a Space straight away, with no sign-up. Your work saves in your browser as you go, and pressing Share puts it online for others to join. Signing in (also free) keeps your spaces with you across devices and unlocks teams, API tokens and the AI connection. See guest vs account.',
      },
      {
        q: 'How do I open my first Space?',
        a: `Press Open a Space and pick a Space to walk into (a Team Pod, a Virtual Office, a Coworking Space or an All-Hands Hall) or a session to run, from a retro to a town hall. ${TEMPLATE_COUNT} templates are ready, or start blank. The Space opens with you on your feet, and a short tour offers to show you round.`,
      },
      {
        q: 'Does it work on my phone or tablet?',
        a: (
          <>
            It runs in any modern browser, with nothing to install. A laptop, desktop or tablet
            gives you the full editor, and a tap is all it takes to walk your character. Small phone
            screens are best for viewing and light edits. See{' '}
            <a href="/help/supported-devices/">supported devices</a>.
          </>
        ),
        aText:
          'It runs in any modern browser, with nothing to install. A laptop, desktop or tablet gives you the full editor, and a tap is all it takes to walk your character. Small phone screens are best for viewing and light edits. See supported devices.',
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
            . You can read it, audit it, or contribute.
          </>
        ),
        aText:
          'Yes. The whole codebase is MIT-licensed and public on GitHub. You can read it, audit it, or contribute.',
      },
      {
        q: 'Will features ever move behind a paywall?',
        a: 'No. There are no "Pro" features and no billing anywhere in the code. Every feature is in the one free version at livehuddle.app.',
      },
    ],
  },
  {
    id: 'creating',
    title: 'Creating',
    blurb: 'Templates, stickies, themes and the palette.',
    icon: lucideGlyph(lucideShapes, ICON),
    items: [
      {
        q: 'What can I run with it?',
        a: 'Stand-ups and team check-ins in a Team Pod, retrospectives in five formats, Lean Coffee and town hall Q&A, brainstorms and affinity maps, Crazy Eights, planning poker, meeting agendas, quizzes, icebreakers and party games, and a whole virtual office to walk round between them.',
      },
      {
        q: 'How many templates and themes are there?',
        a: `${TEMPLATE_COUNT} starter templates across ${TEMPLATE_CATEGORY_COUNT} categories, and twenty-five themes that recolour the whole board in one click, including dark and multi-colour schemes. You can also build and save a colour scheme of your own.`,
      },
      {
        q: 'Do I need to switch modes?',
        a: 'No. Every board in livehuddle is a workshop board: stickies, writing, pens, shapes, icons, media, charts and every session tool sit on one palette, and the Session strip at the foot holds the timer, votes and polls. Pick Avatar on the toolbar to walk, and any other tool to work on the board.',
      },
      {
        q: 'Can I organise a big space?',
        a: 'Yes. A space holds as many tabs as you need, which you can group into folders, link between and open two at a time side by side. Each tab has Photoshop-style layers you can hide, lock and restack, and your spaces live in nested folders in the Explorer, shown as a list, as cards or as a sortable Details table. Drag a space onto a folder to file it.',
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
            line chart, a progress bar, a rating or a timeline. See{' '}
            <a href="/help/palette/tools/data-elements/">data elements</a>.
          </>
        ),
        aText:
          'Yes. Add a table and paste cells straight in from a spreadsheet, or place a pie, bar or line chart, a progress bar, a rating or a timeline. See data elements.',
      },
      {
        q: 'Can I use the same tab in two spaces?',
        a: (
          <>
            Yes. Add to Another Space puts the tab you are on into another of your spaces. It is the
            same tab in both places, not a copy, so an edit in one shows up in the other. See{' '}
            <a href="/help/tabs/add-to-document/">Add to Another Space</a>.
          </>
        ),
        aText:
          'Yes. Add to Another Space puts the tab you are on into another of your spaces. It is the same tab in both places, not a copy, so an edit in one shows up in the other. See Add to Another Space.',
      },
      {
        q: 'Can I use it as a whiteboard?',
        a: (
          <>
            Yes. Every board is a whiteboard: the palette’s Draw category holds a pencil, a
            highlighter and arrows, and stickies, text and shapes are a key away, on a plain, dotted
            or grid backdrop in light or dark. See{' '}
            <a href="/help/palette/tools/drawing/">Drawing</a>.
          </>
        ),
        aText:
          'Yes. Every board is a whiteboard: the palette\u2019s Draw category holds a pencil, a highlighter and arrows, and stickies, text and shapes are a key away, on a plain, dotted or grid backdrop in light or dark. See Drawing.',
      },
      {
        q: 'Can I walk the room through something?',
        a: 'Yes. Switch on Spotlight to dim the board around your cursor, or the laser to leave a glowing trail on everyone\u2019s screen. A Bring Focus element offers everyone a jump to the thing you mean, and anyone can press Follow beside you to see what you see.',
      },
      {
        q: 'Can I undo a mistake?',
        a: 'Yes. Press Cmd-Z (or Ctrl-Z) to step back your recent edits and Cmd-Shift-Z to bring one back; the buttons also sit in the bottom-right corner. Undo is personal, so it rewinds your own changes, not a teammate’s; if you both changed the same element, it puts that element back as you had it.',
      },
      {
        q: 'What if I delete something by accident?',
        a: 'Deleted spaces wait in the Trash for 30 days before they are removed for good, so you can restore them from the Trash in the Explorer or in Settings › Account. Team spaces go to their team’s Trash.',
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
        a: 'Yes, that is the point. Share a link and teammates join the same Space in real time, with live cursors, walking characters, selection rings, presence on each tab, comments and a laser pointer. If you have not signed in, a new space starts in your browser, and the first Share syncs it in one step.',
      },
      {
        q: 'What happens if two people edit the same thing at once?',
        a: 'Every change shows up for everyone live. Edits to different elements merge cleanly. If two people change the same element at the same moment, the most recent change is the one that sticks.',
      },
      {
        q: 'Can I leave comments and assign follow-ups?',
        a: 'Yes. Comment on any element and reply in threads, then resolve them when they are done. You can also attach an action to an element and assign it to a teammate, so the follow-ups a meeting produces stay with the space instead of getting lost.',
      },
      {
        q: 'Can I set up a team with shared spaces?',
        a: 'Yes, once you sign in. Create a team from the Explorer, invite people by email, and everyone gets a shared library of spaces. Teams have Admin and Member roles: admins manage membership, everyone else just gets to work.',
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
        q: 'Can we walk around a Space together?',
        a: (
          <>
            Yes. A Space opens with you standing on it as a little pixel character in your own
            colour: click or tap to walk, and share a status, speech bubbles and reactions with
            everyone there. The Virtual Office, Coworking Space, Team Pod and All-Hands Hall
            templates give you rooms, desks and a coffee machine to meet at. See{' '}
            <a href="/help/selection-modes/avatar-mode/">Avatar mode</a>.
          </>
        ),
        aText:
          'Yes. A Space opens with you standing on it as a little pixel character in your own colour: click or tap to walk, and share a status, speech bubbles and reactions with everyone there. The Virtual Office, Coworking Space, Team Pod and All-Hands Hall templates give you rooms, desks and a coffee machine to meet at. See Avatar mode.',
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
            Your Inbox gathers the actions and comment threads waiting on you across every space,
            and Home shows what other people did while you were away. Once you sign in, emails can
            tell you too, and you choose which in Settings. See{' '}
            <a href="/help/explorer/activity/">the Inbox</a>.
          </>
        ),
        aText:
          'Your Inbox gathers the actions and comment threads waiting on you across every space, and Home shows what other people did while you were away. Once you sign in, emails can tell you too, and you choose which in Settings. See the Inbox.',
      },
      {
        q: 'Is it good for running workshops and retros?',
        a: (
          <>
            It is what livehuddle is for. Every board carries a timer, dot votes and polls, and
            templates start a retrospective, Lean Coffee or town hall Q&amp;A in one click. Whoever
            holds the facilitator baton runs the room’s timer, votes, polls and reveals. Estimate
            cards run planning poker, a temperature check shows how the room feels, a quiz asks what
            it knows, and an idea box collects anonymous ideas. See{' '}
            <a href="/help/collaboration/session-tools/">session tools</a>.
          </>
        ),
        aText:
          'It is what livehuddle is for. Every board carries a timer, dot votes and polls, and templates start a retrospective, Lean Coffee or town hall Q&A in one click. Whoever holds the facilitator baton runs the room’s timer, votes, polls and reveals. Estimate cards run planning poker, a temperature check shows how the room feels, a quiz asks what it knows, and an idea box collects anonymous ideas. See session tools.',
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
        a: 'From a space you own, create an editor link (full edit access), a participant link (add stickies, write and vote, without reshaping the board) or a view-only link. Anyone with the link can join. Give a link an expiry of a week, a month or six months so it stops working on its own, or revoke it at any time and it stops working immediately.',
      },
      {
        q: 'Can I password-protect a space?',
        a: 'Yes. Add a password in the Share dialog and every link to that space asks for it before opening.',
      },
      {
        q: 'Can I share just one tab?',
        a: (
          <>
            Yes. When a space has more than one tab, the Share dialog lets a link open a single tab,
            as an editor, participant or view-only link, and the rest of the space stays private.
            See <a href="/help/collaboration/sharing/one-tab/">sharing one tab</a>.
          </>
        ),
        aText:
          'Yes. When a space has more than one tab, the Share dialog lets a link open a single tab, as an editor, participant or view-only link, and the rest of the space stays private. See sharing one tab.',
      },
      {
        q: 'Can I embed a Space in my docs or wiki?',
        a: 'Yes. Any share link can be embedded as a live-updating iframe: an editor link embeds an editable space, and a participant or view-only link a read-only one. Copy the snippet from the Share dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes; it always shows the Space as it is now.',
      },
      {
        q: 'Can I show a board where iframes are blocked, like a README?',
        a: (
          <>
            Yes. A live image is a plain image URL that follows your space, redrawn after each save,
            so a GitHub README or a doc always shows the current version. See{' '}
            <a href="/help/collaboration/sharing/live-image/">live images</a>.
          </>
        ),
        aText:
          'Yes. A live image is a plain image URL that follows your space, redrawn after each save, so a GitHub README or a doc always shows the current version. See live images.',
      },
      {
        q: 'What is the Community?',
        a: (
          <>
            A public gallery of spaces people are proud of. Signed-in owners can publish a space
            with a title, description and tags; anyone can browse it, open it read-only, like it and
            make their own copy in one click. <a href="/community/">Take a look</a>.
          </>
        ),
        aText:
          'A public gallery of spaces people are proud of. Signed-in owners can publish a space with a title, description and tags; anyone can browse it, open it read-only, like it and make their own copy in one click. Take a look.',
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
            Yes. livehuddle runs an MCP server at mcp.livehuddle.app. Connect a compatible AI tool
            and, after a one-time authorisation, it can find, read, create and edit the spaces in
            your account. Its changes appear live for anyone on the tab, outlined so you can see
            them and undo them. <a href="/ai">Build with AI</a> walks you through connecting Claude,
            ChatGPT, Cursor and more.
          </>
        ),
        aText:
          'Yes. livehuddle runs an MCP server at mcp.livehuddle.app. Connect a compatible AI tool and, after a one-time authorisation, it can find, read, create and edit the spaces in your account. Its changes appear live for anyone on the tab, outlined so you can see them and undo them. Build with AI walks you through connecting Claude, ChatGPT, Cursor and more.',
      },
      {
        q: 'Is there an API?',
        a: (
          <>
            Yes. Once you sign in, create an API token and call the REST API to read and manage your
            spaces from scripts, CI or anything that can send a header. See the{' '}
            <a href="/help/developers/api-overview/">API overview</a>.
          </>
        ),
        aText:
          'Yes. Once you sign in, create an API token and call the REST API to read and manage your spaces from scripts, CI or anything that can send a header. See the API overview.',
      },
      {
        q: 'Is there a command-line tool?',
        a: 'Yes. Install it from npm as @livehuddle/cli (or run it with npx). It signs in through your browser and can read, edit, create, share and export spaces from your terminal, which makes it handy for scripts and coding agents.',
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
        a: 'Yes. Export a tab as PNG, SVG, PDF or a portable JSON file you can import back. Hidden layers stay out of image exports unless you switch them on.',
      },
      {
        q: 'Can I move my boards over from another tool?',
        a: 'Not directly yet: there is no importer for other whiteboards. Export a board from the old tool as a PNG and add it to a tab as an image, or start the next session from one of the templates. A livehuddle JSON export imports back in full.',
      },
      {
        q: 'Can I keep a copy in my own Google Drive?',
        a: 'Yes, once you sign in. Connect Google Drive in Settings and your spaces, with your work from every other liveworkspace app, are kept in step with matching files and folders in your own Drive, so you always hold a copy.',
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
            Spaces saved to your account are stored in our database on Cloudflare, and spaces in
            This Browser stay in your browser. There are no tracking pixels, no advertising and no
            third-party analytics. We do record anonymous, first-party usage (which features get
            used, never your content or name) and show it openly on our{' '}
            <a href="/telemetry">telemetry page</a>. See the{' '}
            <a href="https://www.liveworkspace.app/privacy">privacy policy</a> for the details.
          </>
        ),
        aText:
          'Spaces saved to your account are stored in our database on Cloudflare, and spaces in This Browser stay in your browser. There are no tracking pixels, no advertising and no third-party analytics. We do record anonymous, first-party usage (which features get used, never your content or name) and show it openly on our telemetry page. See the privacy policy for the details.',
      },
      {
        q: 'Can I keep a space off your servers entirely?',
        a: (
          <>
            Yes. Offline Mode saves a space only in your browser, never on our servers. Until you
            sign in, new spaces start that way; after, you can choose it when you create one. Either
            way you can switch later. See{' '}
            <a href="/help/privacy-and-security/offline-mode/">Offline Mode</a>.
          </>
        ),
        aText:
          'Yes. Offline Mode saves a space only in your browser, never on our servers. Until you sign in, new spaces start that way; after, you can choose it when you create one. Either way you can switch later. See Offline Mode.',
      },
      {
        q: 'What happens to my spaces if I clear my browser data?',
        a: (
          <>
            A space kept only in your browser goes with it, so share it or sign in first. Share
            syncs a space online in one step, and after you sign in livehuddle offers to move every
            browser-only space into your account. Spaces saved to your account are never touched.
            See <a href="/help/privacy-and-security/offline-mode/">Offline Mode</a>.
          </>
        ),
        aText:
          'A space kept only in your browser goes with it, so share it or sign in first. Share syncs a space online in one step, and after you sign in livehuddle offers to move every browser-only space into your account. Spaces saved to your account are never touched. See Offline Mode.',
      },
      {
        q: 'Is my work saved automatically?',
        a: 'Yes. Every change saves on its own, with a status that shows saving, saved or a problem. Close the tab and reload, and your space comes back exactly as you left it.',
      },
      {
        q: 'How do I delete my data or account?',
        a: (
          <>
            Delete any space you own at any time, and delete your account and everything in it
            yourself from your account settings. See{' '}
            <a href="/help/account-and-data/deleting-your-data/">deleting your data</a>.
          </>
        ),
        aText:
          'Delete any space you own at any time, and delete your account and everything in it yourself from your account settings. See deleting your data.',
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
        q: 'A space will not load. What can I do?',
        a: (
          <>
            Try reloading first. If it still will not open, the editor offers to repair this
            browser’s saved state without touching your spaces. The{' '}
            <a href="/help/troubleshooting/document-not-loading/">troubleshooting guide</a> walks
            through every step.
          </>
        ),
        aText:
          'Try reloading first. If it still will not open, the editor offers to repair this browser’s saved state without touching your spaces. The troubleshooting guide walks through every step.',
      },
      {
        q: 'Is livehuddle up right now?',
        a: (
          <>
            The <a href={STATUS_PAGE_URL}>liveworkspace status page</a> checks each of
            livehuddle&rsquo;s services from your browser while you watch, and from Cloudflare every
            hour, with 90 days of livehuddle&rsquo;s history and any recent incidents, beside the
            services every app shares.
          </>
        ),
        aText:
          'The liveworkspace status page checks each of livehuddle’s services from your browser while you watch, and from Cloudflare every hour, with 90 days of livehuddle’s history and any recent incidents, beside the services every app shares.',
      },
      {
        q: 'Who makes livehuddle?',
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
