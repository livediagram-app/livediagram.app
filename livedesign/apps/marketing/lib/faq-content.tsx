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
import { CONTACT_FORM_URL, lucideGlyph, REPO_URL, STATUS_PAGE_URL } from '@livedesign/ui';
import type { FaqCategory } from '@liveworkspace/marketing-site/lib/faq';

// The /faq page's content (docs/specs/019-marketing/marketing-site.md "Content pages (FAQ)"): questions grouped
// into categories, each with an icon and a one-line blurb. Pure data, exempt from the line target.
// The shape, and what `a` and `aText` are, is @liveworkspace/marketing-site's lib/faq.ts. faq-content.test.tsx
// renders every JSX answer and fails if its text drifts from `aText`, so the structured data stays a faithful
// image of the page.

const ICON = 18;
// Written out rather than read from @livedesign/templates: this module ships in the FAQ's client bundle, and the
// catalogue is ~15 KB for one number. faq-content.test.tsx pins it to TEMPLATES.length.
export const TEMPLATE_COUNT = 33;
// The template categories, pinned to TEMPLATE_CATEGORIES.length by faq-content.test.tsx the same way.
export const TEMPLATE_CATEGORY_COUNT = 10;
// The logo layouts, pinned the same way.
export const LOGO_LAYOUT_COUNT = 25;

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    blurb: 'What livedesign is and how to begin.',
    icon: lucideGlyph(lucideZap, ICON),
    items: [
      {
        q: 'What is livedesign?',
        a: 'A free, real-time editor for designing on pages: logos on a square artboard, wireframes framed by their device and photos edited in layers, exported as PDF, PNG or SVG. Every design is a stack of tabs, each holding its pages, and your team can work on any of them with you live.',
      },
      {
        q: 'Do I need an account to use livedesign?',
        a: (
          <>
            No. Open the editor and start straight away, with no sign-up. Your work saves in your
            browser as you go, and pressing Share puts it online for others to join. Signing in
            (also free, with a liveworkspace account and an emailed code) keeps your designs with
            you across devices and unlocks teams, API tokens and the AI connection. See{' '}
            <a href="/help/getting-started/guest-vs-account/">guest vs account</a>.
          </>
        ),
        aText:
          'No. Open the editor and start straight away, with no sign-up. Your work saves in your browser as you go, and pressing Share puts it online for others to join. Signing in (also free, with a liveworkspace account and an emailed code) keeps your designs with you across devices and unlocks teams, API tokens and the AI connection. See guest vs account.',
      },
      {
        q: 'How do I start my first design?',
        a: `Press Start and choose what you are making: a logo, a wireframe or a photo. Begin from a blank page or one of ${TEMPLATE_COUNT} templates, and a short tour offers to show you round.`,
      },
      {
        q: 'Does it work on my phone or tablet?',
        a: (
          <>
            It runs in any modern browser, with nothing to install. A laptop, desktop or tablet
            gives you the full editor. Small phone screens are best for reading, following along and
            light edits. See <a href="/help/supported-devices/">supported devices</a>.
          </>
        ),
        aText:
          'It runs in any modern browser, with nothing to install. A laptop, desktop or tablet gives you the full editor. Small phone screens are best for reading, following along and light edits. See supported devices.',
      },
      {
        q: 'Are there keyboard shortcuts?',
        a: (
          <>
            Plenty. Cmd-Z (or Ctrl-Z) undoes and Cmd-Shift-Z redoes, Cmd-K opens search and
            commands, and single keys pick tools and add elements: V selects, H pans, K is the laser
            pointer, T adds text. The{' '}
            <a href="/help/getting-started/keyboard-essentials/">keyboard essentials</a> guide lists
            the ones worth learning.
          </>
        ),
        aText:
          'Plenty. Cmd-Z (or Ctrl-Z) undoes and Cmd-Shift-Z redoes, Cmd-K opens search and commands, and single keys pick tools and add elements: V selects, H pans, K is the laser pointer, T adds text. The keyboard essentials guide lists the ones worth learning.',
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
        a: 'No. There are no "Pro" features and no billing anywhere in the code. Every feature is free for everyone.',
      },
    ],
  },
  {
    id: 'creating',
    title: 'Creating',
    blurb: 'Logos, wireframes, photos and showing them off.',
    icon: lucideGlyph(lucideShapes, ICON),
    items: [
      {
        q: 'What can I make with it?',
        a: 'Logos, wordmarks and brand marks, and wireframes for phone, tablet, watch and web apps and websites, each framed by its device, and photos edited in layers. Pages hold shapes, text, pictures, icons, tables and charts, and every page exports as a PDF, PNG or SVG.',
      },
      {
        q: 'How many templates and themes are there?',
        a: `${TEMPLATE_COUNT} starter templates across ${TEMPLATE_CATEGORY_COUNT} categories, grouped by what you are making (branding, shopping, social, travel, work, websites and more), and twenty-four themes that recolour every page in one click, including dark and multi-colour schemes. On top of the templates, a logo page starts from one of ${LOGO_LAYOUT_COUNT} logo layouts. You can also build and save a colour scheme of your own.`,
      },
      {
        q: 'Can I walk people through a design?',
        a: (
          <>
            Yes. Share your screen, or the design itself, and point with the laser: a glowing trail
            everyone in the design can see. Spotlight dims the page round your cursor so one thing
            stands out, Zen mode hides the toolbars and panels, and a teammate can follow your view
            as you move. See <a href="/help/selection-modes/laser/">the laser</a>.
          </>
        ),
        aText:
          'Yes. Share your screen, or the design itself, and point with the laser: a glowing trail everyone in the design can see. Spotlight dims the page round your cursor so one thing stands out, Zen mode hides the toolbars and panels, and a teammate can follow your view as you move. See the laser.',
      },
      {
        q: 'Can I design a logo?',
        a: (
          <>
            Yes. A logo page is a square artboard with {LOGO_LAYOUT_COUNT} logo layouts,
            construction guides, mirror drawing and wordmark type, and it exports a logo kit. Any
            page exports print-ready as PDF, PNG or SVG. See{' '}
            <a href="/help/pages/logo-pages/">logo pages</a>.
          </>
        ),
        aText: `Yes. A logo page is a square artboard with ${LOGO_LAYOUT_COUNT} logo layouts, construction guides, mirror drawing and wordmark type, and it exports a logo kit. Any page exports print-ready as PDF, PNG or SVG. See logo pages.`,
      },
      {
        q: 'Can I wireframe an app or a website?',
        a: (
          <>
            Yes. A wireframe page draws a phone, a tablet, a browser, a laptop or a watch round the
            screen you are planning, and starts from a ready-made screen. Five templates lay out
            whole flows, from a mobile app to a web dashboard. See{' '}
            <a href="/help/pages/wireframe-pages/">wireframe pages</a>.
          </>
        ),
        aText:
          'Yes. A wireframe page draws a phone, a tablet, a browser, a laptop or a watch round the screen you are planning, and starts from a ready-made screen. Five templates lay out whole flows, from a mobile app to a web dashboard. See wireframe pages.',
      },
      {
        q: 'Can I edit photos?',
        a: (
          <>
            Yes. A photo page edits a picture in layers, with masks, blend modes, adjustments, 44
            filters and tools to select, paint and retouch. Open a PSD with its layers, and export
            PNG, JPEG, WebP or a layered PSD. See <a href="/help/pages/photo-pages/">photo pages</a>
            .
          </>
        ),
        aText:
          'Yes. A photo page edits a picture in layers, with masks, blend modes, adjustments, 44 filters and tools to select, paint and retouch. Open a PSD with its layers, and export PNG, JPEG, WebP or a layered PSD. See photo pages.',
      },
      {
        q: 'Can I organise a big design?',
        a: 'Yes. A design holds as many tabs as you need, which you can group into folders, and a Contents sidebar lists every page with a picture of it. Your designs live in nested folders in the Explorer, shown as a list, as cards or as a sortable Details table, with favourites and tags to find them again. Drag a design onto a folder to file it.',
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
        a: 'Deleted designs wait in the Trash for 30 days before they are removed for good, so you can restore them from the Trash in the Explorer or in Settings › Account. Team designs go to their team’s Trash.',
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
        a: 'Yes, that is the point. Share a link and teammates join the same design in real time, with live cursors, selection rings, presence on each tab, comments and a laser pointer. If you have not signed in, a new design starts in your browser, and the first Share syncs it in one step.',
      },
      {
        q: 'What happens if two people edit the same thing at once?',
        a: 'Every change shows up for everyone live. Edits to different elements merge cleanly. If two people change the same element at the same moment, the most recent change is the one that sticks.',
      },
      {
        q: 'Can I leave comments and assign follow-ups?',
        a: 'Yes. Comment on anything on a page and reply in threads, then resolve them when they are done. You can also attach an action and assign it to a teammate, so the follow-ups stay with the design instead of getting lost.',
      },
      {
        q: 'Can I set up a team with shared designs?',
        a: 'Yes, once you sign in. Create a team from the Explorer, invite people by email, and everyone gets a shared library of designs. Teams have Admin and Member roles: admins manage membership, everyone else just gets to work.',
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
            Yes. Lock it from the tab’s menu and every page on it becomes read-only until someone
            unlocks it, with a padlock beside its name. You can also lock single elements or whole
            layers. See <a href="/help/tabs/locking-tabs/">locking a tab</a>.
          </>
        ),
        aText:
          'Yes. Lock it from the tab’s menu and every page on it becomes read-only until someone unlocks it, with a padlock beside its name. You can also lock single elements or whole layers. See locking a tab.',
      },
      {
        q: 'How do I keep up with what changed?',
        a: (
          <>
            Your Inbox gathers the actions and comment threads waiting on you across every design,
            and Home shows what other people did while you were away. Once you sign in, emails can
            tell you too, and you choose which in Settings. See{' '}
            <a href="/help/explorer/activity/">the Inbox</a>.
          </>
        ),
        aText:
          'Your Inbox gathers the actions and comment threads waiting on you across every design, and Home shows what other people did while you were away. Once you sign in, emails can tell you too, and you choose which in Settings. See the Inbox.',
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
        a: 'From a design you own, issue a pass with a role: Editor (designs with you), Participant (adds stickies, text and pictures but cannot reshape the pages) or Viewer (watches only). Anyone with the link can join in that role. Give a pass an expiry of a week, a month or six months so it stops working on its own, or revoke it at any time and it stops working immediately.',
      },
      {
        q: 'Can I password-protect a design?',
        a: 'Yes. Add a password in the Share dialog and every link to that design asks for it before opening.',
      },
      {
        q: 'Can I share just one tab?',
        a: (
          <>
            Yes. When a design has more than one tab, the Share dialog lets a link open a single
            tab, in any role, and the rest of the design stays private. See{' '}
            <a href="/help/collaboration/sharing/one-tab/">sharing one tab</a>.
          </>
        ),
        aText:
          'Yes. When a design has more than one tab, the Share dialog lets a link open a single tab, in any role, and the rest of the design stays private. See sharing one tab.',
      },
      {
        q: 'Can I embed a design in my docs or wiki?',
        a: 'Yes. Any share link can be embedded as a live-updating iframe: an Editor pass embeds an editable design, and a Viewer or Participant pass a read-only one. Copy the snippet from the Share dialog and paste it into Notion, Confluence, a wiki or any page that allows iframes; it always shows the current state of the pages.',
      },
      {
        q: 'Can I show a page where iframes are blocked, like a README?',
        a: (
          <>
            Yes. A live image is a plain image URL that follows your design, redrawn after each
            save, so a GitHub README or a doc always shows the current version. See{' '}
            <a href="/help/collaboration/sharing/live-image/">live images</a>.
          </>
        ),
        aText:
          'Yes. A live image is a plain image URL that follows your design, redrawn after each save, so a GitHub README or a doc always shows the current version. See live images.',
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
            Yes. livedesign runs an MCP server at mcp.livedesign.app. Connect a compatible AI tool
            and, after a one-time authorisation, it can find, read, create and edit the designs in
            your account, including designing logos and wireframing screens. Its changes appear live
            for anyone on the tab, outlined so you can see them and undo them.{' '}
            <a href="/ai">Build with AI</a> walks you through connecting Claude, ChatGPT, Cursor and
            more.
          </>
        ),
        aText:
          'Yes. livedesign runs an MCP server at mcp.livedesign.app. Connect a compatible AI tool and, after a one-time authorisation, it can find, read, create and edit the designs in your account, including designing logos and wireframing screens. Its changes appear live for anyone on the tab, outlined so you can see them and undo them. Build with AI walks you through connecting Claude, ChatGPT, Cursor and more.',
      },
      {
        q: 'Is there an API?',
        a: (
          <>
            Yes. Once you sign in, create an API token and call the REST API to read and manage your
            designs from scripts, CI or anything that can send a header. See the{' '}
            <a href="/help/developers/api-overview/">API overview</a>.
          </>
        ),
        aText:
          'Yes. Once you sign in, create an API token and call the REST API to read and manage your designs from scripts, CI or anything that can send a header. See the API overview.',
      },
      {
        q: 'Is there a command-line tool?',
        a: 'Yes. Install it from npm as @livedesign/cli (or run it with npx). It signs in through your browser and can read, edit, create, share and export designs from your terminal, which makes it handy for scripts and coding agents.',
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
        a: 'Yes. Export pages as PNG, SVG or one print-ready PDF, a logo page as a logo kit, a photo as PNG, JPEG, WebP or a layered PSD, and any tab as a portable JSON file to import back with full fidelity. Hidden layers stay out of image exports unless you switch them on.',
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
            Designs saved to your account are stored in our database on Cloudflare, and designs in
            This Browser stay in your browser. There are no tracking pixels, no advertising and no
            third-party analytics. We do record anonymous, first-party usage (which features get
            used, never your content or name) and show it openly on our{' '}
            <a href="/telemetry">telemetry page</a>. See the{' '}
            <a href="https://www.liveworkspace.app/privacy">privacy policy</a> for the details.
          </>
        ),
        aText:
          'Designs saved to your account are stored in our database on Cloudflare, and designs in This Browser stay in your browser. There are no tracking pixels, no advertising and no third-party analytics. We do record anonymous, first-party usage (which features get used, never your content or name) and show it openly on our telemetry page. See the privacy policy for the details.',
      },
      {
        q: 'Can I keep a design off your servers entirely?',
        a: (
          <>
            Yes. Offline Mode saves a design only in your browser, never on our servers. Until you
            sign in, new designs start that way; after, you can choose it when you create one.
            Either way you can switch later. See{' '}
            <a href="/help/privacy-and-security/offline-mode/">Offline Mode</a>.
          </>
        ),
        aText:
          'Yes. Offline Mode saves a design only in your browser, never on our servers. Until you sign in, new designs start that way; after, you can choose it when you create one. Either way you can switch later. See Offline Mode.',
      },
      {
        q: 'What happens to my designs if I clear my browser data?',
        a: (
          <>
            A design kept only in your browser goes with it, so share it or sign in first. Share
            syncs a design online in one step, and after you sign in livedesign offers to move every
            browser-only design into your account. Designs saved to your account are never touched.
            See <a href="/help/privacy-and-security/offline-mode/">Offline Mode</a>.
          </>
        ),
        aText:
          'A design kept only in your browser goes with it, so share it or sign in first. Share syncs a design online in one step, and after you sign in livedesign offers to move every browser-only design into your account. Designs saved to your account are never touched. See Offline Mode.',
      },
      {
        q: 'Is my work saved automatically?',
        a: 'Yes. Every change saves on its own, with a status that shows saving, saved or a problem. Close the tab and reload, and your design comes back exactly as you left it.',
      },
      {
        q: 'How do I delete my data or account?',
        a: (
          <>
            Delete any design you own at any time, and delete your account and everything in it
            yourself from your account settings. See{' '}
            <a href="/help/account-and-data/deleting-your-data/">deleting your data</a>.
          </>
        ),
        aText:
          'Delete any design you own at any time, and delete your account and everything in it yourself from your account settings. See deleting your data.',
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
        q: 'A design will not load. What can I do?',
        a: (
          <>
            Try reloading first. If it still will not open, the editor offers to repair this
            browser’s saved state without touching your designs. The{' '}
            <a href="/help/troubleshooting/design-not-loading/">troubleshooting guide</a> walks
            through every step.
          </>
        ),
        aText:
          'Try reloading first. If it still will not open, the editor offers to repair this browser’s saved state without touching your designs. The troubleshooting guide walks through every step.',
      },
      {
        q: 'Is livedesign up right now?',
        a: (
          <>
            The <a href={STATUS_PAGE_URL}>liveworkspace status page</a> checks each of
            livedesign&rsquo;s services from your browser while you watch, and from Cloudflare every
            hour, with 90 days of livedesign&rsquo;s history and any recent incidents, beside the
            services every app shares.
          </>
        ),
        aText:
          'The liveworkspace status page checks each of livedesign’s services from your browser while you watch, and from Cloudflare every hour, with 90 days of livedesign’s history and any recent incidents, beside the services every app shares.',
      },
      {
        q: 'Who makes livedesign?',
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
