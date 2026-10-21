// Single source of truth for the comparison / "alternative" pages
// (see docs/specs/019-marketing/comparison-pages.md). The dynamic route, its metadata,
// the index page, and the sitemap all derive from this list, so adding
// a competitor is a one-place change.
//
// Honesty rules (docs/specs/019-marketing/comparison-pages.md): every liveplanner claim maps to a shipped
// feature; every competitor gets a real "where they're the better pick"
// section; competitor facts are qualitative (positioning, not volatile
// pricing/numbers); free + open-source competitors (Excalidraw, draw.io)
// are never implied to be paid or proprietary. The deep-dive `sections`
// and `faqs` follow the same rules: honest answers, including partial
// ones ("no direct importer, but...").

// Last-revised date for the comparison set, shared by `app/sitemap.ts`
// (drives `lastModified` for /alternatives + /alternatives/<slug>) and
// by the alternatives pages' `pageMetadata({ modifiedTime })`
// (drives `article:modified_time` OG meta). Co-located with the
// ALTERNATIVES array so revising a competitor row + bumping the date
// lands in one diff. Bump this when adding a competitor or revising
// any row / claim / lede.
export const ALTERNATIVES_LAST_UPDATED = new Date('2026-10-18');

type ComparisonRow = {
  label: string;
  // Short, factual cell text. `us` = liveplanner, `them` = competitor.
  us: string;
  them: string;
};

type DeepDiveSection = {
  // On-page h2 for the section.
  heading: string;
  // One to three prose paragraphs expanding on a key value theme for
  // this comparison. Rendered as plain <p> elements.
  paragraphs: string[];
};

type Faq = {
  q: string;
  // Plain string (no JSX) so the same text feeds the on-page answer
  // and the FAQPage JSON-LD verbatim.
  a: string;
};

export type Alternative = {
  slug: string;
  // Competitor display name + how we refer to it in prose.
  name: string;
  // SEO. Title targets the "<tool> alternative" query; description is
  // the meta + social description.
  title: string;
  description: string;
  // On-page hero.
  h1: string;
  lede: string;
  // Comparison table rows (liveplanner vs competitor).
  rows: ComparisonRow[];
  // Fairness section: genuine reasons to pick the competitor.
  themBest: string[];
  // Shipped liveplanner differentiators for this comparison.
  usBest: string[];
  // Deep-dive prose: competitor-specific sections expanding the key
  // value themes (collaboration model, open-source story, structure,
  // interop). This is where the page earns its depth.
  sections: DeepDiveSection[];
  // Competitor-specific questions, rendered on-page and emitted as
  // FAQPage JSON-LD (docs/specs/019-marketing/comparison-pages.md "Metadata").
  faqs: Faq[];
};

export const ALTERNATIVES: Alternative[] = [
  {
    slug: 'microsoft-whiteboard',
    name: 'Microsoft Whiteboard',
    title: 'Microsoft Whiteboard alternative · liveplanner',
    description:
      'A free, open-source Microsoft Whiteboard alternative: pressure-sensitive ink, no Microsoft account, and an import that keeps your boards editable.',
    h1: 'The open-source Microsoft Whiteboard alternative',
    lede: 'Microsoft has retired Whiteboard for personal accounts: boards became read-only in September 2026, and on 16 October 2026 the remaining legacy boards were deleted and the standalone apps retired. liveplanner is a free, open-source home for that work: a real-time whiteboard with pressure-sensitive ink, no Microsoft account needed, and an import that brings your boards across with every stroke still editable.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Included with Microsoft 365 work and school plans',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Personal accounts',
        us: 'Yes, or no account at all',
        them: 'Retired: legacy boards deleted on 16 October 2026',
      },
      {
        label: 'Where it runs',
        us: 'Any modern browser, on any device',
        them: 'Teams and the web, for work and school accounts',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Ink',
        us: 'Pressure-sensitive markers in Draw mode',
        them: 'Natural pen inking, strongest on Windows',
      },
      {
        label: 'Beyond the whiteboard',
        us: 'Structured diagrams, templates, tabs and folders, Presentation mode',
        them: 'A freeform board inside the Microsoft 365 suite',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'Your organisation already runs on Microsoft 365, and you want whiteboards inside Teams meetings.',
      'Admin control, compliance and data residency handled by your existing Microsoft tenant.',
      'Pen inking inside Teams meetings, which Whiteboard is built around.',
    ],
    usBest: [
      'Your boards outlive the retirement: import a board export and each board becomes a document of its own, named and dated as the board, with pen strokes, colours, sticky notes, text, shapes and images all editable.',
      'No Microsoft account, no sign-up, no install: open a link and start drawing.',
      'Draw mode is a plain whiteboard: three pressure-sensitive markers, text, an eraser and shapes on a plain, dotted or grid board, light or dark.',
      'Real-time multiplayer with live cursors, comments and a laser pointer, for anyone with the link.',
      'Three kinds of link: Editor, Participant (add stickies, write and vote without reshaping the board, handy for a class) or view-only.',
      'For a class: quizzes with a countdown and a reveal of who got it right, live polls, an anonymous idea box and a shared timer.',
      'Run the lesson on the board: an agenda that starts the timer for each segment, a roll call, and a picker that chooses someone at random so nobody has to volunteer.',
      'Around 190 emoji stickers and 32 word badges like APPROVED and WIP, for reacting to work and marking it.',
      'Switch the same tab to Diagram mode when a sketch needs to become a tidy flowchart, org chart or plan, and draw it in the Marker finish so it still looks like it came off the whiteboard.',
      '147 templates, including retrospectives, Lean Coffee, town hall Q&A and event storming boards.',
      'Free and MIT-licensed, so no future retirement can take your boards away: you can always run your own copy.',
    ],
    sections: [
      {
        heading: 'What the retirement means',
        paragraphs: [
          'Microsoft Whiteboard has not gone away for everyone. Work and school accounts keep it inside Teams and on the web. What has ended is Whiteboard for personal Microsoft accounts and the standalone apps: personal boards became read-only on 25 September 2026, and on 16 October 2026 the remaining legacy boards were deleted and the standalone Windows, iOS and Android apps retired, for every kind of account.',
          'If you used Whiteboard on a personal account, for teaching, family planning, tutoring or your own thinking, you need a new home for the next boards, and for any board you exported before the deletion. Check Microsoft’s own retirement notice for the details that apply to your account.',
        ],
      },
      {
        heading: 'Bring your boards across, ink and all',
        paragraphs: [
          'Whiteboard’s own exports are a flat picture: nothing in them stays editable. liveplanner imports a board export instead, the folder of the board’s own edit history, and replays it, so every stroke comes back as data. Each board becomes its own document with one whiteboard tab, named after the board and dated as the board, so your library keeps its history.',
          'Pen strokes keep their pressure, so thick and thin stay as you drew them. Black ink on a light board, or white ink on a dark one, becomes the whiteboard’s own ink, so it reads in light and dark. Highlighter stays highlighter, and sticky notes, text, shapes and images keep their place. The board is read in your browser, and the import needs no Microsoft account. When it finishes, it says what changed on the way, such as rainbow ink drawn in pink.',
        ],
      },
      {
        heading: 'A whiteboard that grows into more',
        paragraphs: [
          'Draw mode is a plain whiteboard, close to what Whiteboard users are used to: pick a marker, draw, erase, add text and shapes. But the same tab can switch to Diagram mode when a sketch needs structure, with shapes and arrows that stay attached as you move things, and the Marker or Sketch finish keeps that structure looking hand-drawn. A document holds as many tabs as you need, grouped into folders, and Presentation mode turns elements from any tab into a slide deck, or Pages makes slides from ready-made layouts.',
          'For sessions, switch a tab to Workshop, the mode for running a room: there are templates for retrospectives, Lean Coffee and town hall Q&A, and a facilitator can run a shared timer, votes, polls and quizzes for the room, with the right answer revealed when the time is up.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [
          'A retirement like this is a reminder of what it means to rely on someone else’s product. liveplanner is MIT-licensed and its whole codebase is public. The hosted version is free with no paid tier, and if you would rather not depend on it, you can deploy the same code to your own Cloudflare account.',
          'You can also keep a document entirely in your browser with Offline Mode, or, once signed in, mirror your documents to your own Google Drive.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is Microsoft Whiteboard being discontinued?',
        a: 'For personal Microsoft accounts, yes: boards became read-only on 25 September 2026, and on 16 October 2026 the remaining legacy boards were deleted and the standalone Windows, iOS and Android apps retired. Work and school accounts keep Whiteboard in Teams and on the web. Microsoft’s retirement notice has the details for your account.',
      },
      {
        q: 'Can I import my Microsoft Whiteboard boards?',
        a: 'Yes, from a board export: the folder of a board’s edit history, as the Whiteboard web app syncs it. Import one board, a folder of many boards, or a .zip of either from the Explorer, and each board becomes its own document with editable ink, sticky notes, text, shapes and images. For a personal account, that means a board export saved before the 16 October 2026 deletion. Whiteboard’s own picture exports are not editable; you can still add one to a tab as an image.',
      },
      {
        q: 'Do I need a Microsoft account to use liveplanner?',
        a: 'No. liveplanner needs no account at all: open the editor and start drawing. Signing in, with email or Google, is optional and keeps your documents with you across devices.',
      },
      {
        q: 'Does liveplanner work with a pen or stylus?',
        a: 'Yes. Draw mode has three pressure-sensitive markers, so a pen on a tablet or touchscreen draws thick and thin lines as you press. It runs in the browser, so there is nothing to install on any device.',
      },
      {
        q: 'When should I stay with Microsoft Whiteboard?',
        a: 'If you have a work or school account and your team lives in Teams, Whiteboard stays available there and fits naturally into your meetings and your organisation’s admin controls. liveplanner suits personal use, mixed teams without a shared Microsoft tenant, and anyone who wants their boards in open, self-hostable software.',
      },
    ],
  },
  {
    slug: 'miro',
    name: 'Miro',
    title: 'Miro alternative · liveplanner',
    description:
      'An open-source, free Miro alternative: real-time diagrams, whiteboards and workshop boards you can open without an account and host yourself.',
    h1: 'The open-source Miro alternative',
    lede: 'Miro is a powerful, sprawling online workspace. liveplanner is a lighter, open-source take on the same idea: real-time multiplayer diagrams, whiteboards and workshop boards you can start in one click, with no sign-up, and run on your own account if you want to.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free tier, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary SaaS' },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create boards; guest editing on paid plans',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out, plus an animated GIF of a Pages tab; CSV both ways for Sheets',
        them: 'Broad import + export options',
      },
      {
        label: 'Programmatic access',
        us: 'REST API and an MCP server for AI tools, both free',
        them: 'Developer platform + marketplace',
      },
      {
        label: 'Focus',
        us: 'One document, five modes: diagrams, whiteboards, Workshop sessions, designed pages and slides, and Plan boards and Sheets',
        them: 'All-in-one visual workspace',
      },
    ],
    themBest: [
      'Facilitating very large workshops: breakout-scale sessions and a marketplace of meeting apps around the board.',
      'A deep template and integration marketplace (Jira, Slack, and more).',
      'AI across the canvas: assistants, flows and generators, well beyond a single panel.',
      'Enterprise admin, SSO, and compliance at large scale.',
    ],
    usBest: [
      "It's free and MIT-licensed, so you can self-host it instead of paying per seat.",
      'Open a link and draw, with no sign-up wall in front of the canvas, even to create a document.',
      'Real-time multiplayer, live cursors and comments come standard, not gated behind a plan.',
      'Five ways to work one tab: Diagram for structure, Draw for freehand whiteboarding, Workshop for running a session with your team, Pages for slides, articles, posters and logos, and Plan for boards of cards, spreadsheets, forms and dashboards.',
      'Participant links let a workshop add stickies, write and vote without being able to reshape the board.',
      'Assign action items to teammates on the canvas itself, tracked beside comments in the Collaborate panel.',
      'Workshop tools built in: Workshop mode, a facilitator role, a shared timer, dot-voting, live polls, planning-poker estimate cards, temperature checks, quizzes, an anonymous idea box and a Q&A board.',
      'Run the meeting itself on the board: an agenda that starts the timer for each segment, a roll call, a random picker, reveal zones that cover work until the room is ready, and decision records that keep what was agreed.',
      '147 templates, 24 one-click whole-canvas themes and ready-made looks turn a blank canvas into a polished diagram fast, drawn clean, crisp and Professional, or by hand in Sketch or Marker.',
      'Forms built in: share a link, and every response lands as a card on a board or a row in a Sheet.',
      'Meet on the board: everyone walks an avatar round a virtual office or team space, with speech bubbles and a status.',
      'Present a document as a slide deck built from its own elements, with a laser pointer and spotlight, no export needed.',
      'Bring boards across from Excalidraw, draw.io and Microsoft Whiteboard; export PNG, SVG, PDF, Mermaid or Excalidraw.',
    ],
    sections: [
      {
        heading: 'One workspace, five ways to work',
        paragraphs: [
          'Miro grew into a broad workspace: boards, workshops, docs, tables, video walkthroughs and a marketplace of apps. liveplanner covers the same ground in one document with tabs, and each tab works in one of five modes. Diagram for structure, with arrows that stay attached and re-route as you move things. Draw for freehand whiteboarding with pressure-sensitive markers. Workshop for running the session itself: timers, dot votes, polls and reveals. Pages for designed pages: infographics, written documents, slide decks and logos. Plan for boards of cards with WIP limits and swimlanes, beside Sheets with real formulas that can read the cards, forms whose responses arrive as cards or rows, and dashboards that bring them together.',
          'Every tab also has a finish, the way it is drawn: Flexible by default, Professional for crisp, print-ready work, Sketch for pencil on paper and Marker for felt-tip on a whiteboard. A look sets the theme, finish, font and canvas pattern in one click, and switching it never changes the content underneath.',
          'Workshops are built in rather than bolted on. A facilitator can run the room with a shared timer, dot-voting, live polls, planning-poker estimate cards, quizzes, a Q&A board and responses kept hidden until the reveal, and templates cover retrospectives, Lean Coffee, town hall Q&A and event storming, including turning a photo of a sticky-note wall into notes. When the session ends, the actions it produced are assigned on the board and the plan picks up on the next tab.',
        ],
      },
      {
        heading: 'Free means free, not a free tier',
        paragraphs: [
          "Miro's free tier is real, but it's the top of a pricing funnel: board limits and gated features exist to move teams onto paid seats. liveplanner has no paid tier and no plan to introduce one. The hosted version at liveplanner.app is free, every user gets every feature, and there is nothing to upgrade to.",
          "That's sustainable because the whole codebase is MIT-licensed and public. If you'd rather not depend on the hosted service at all, you can deploy the same code to your own Cloudflare account: the editor, the API, and the realtime collaboration all self-host, with no license keys and no phone-home checks.",
        ],
      },
      {
        heading: 'Collaboration without the onboarding',
        paragraphs: [
          'In Miro, creating a board starts with an account, and anonymous guest editing depends on the plan you are on. In liveplanner, collaborating is a URL. Anyone can create a document without signing up; a guest’s new document is kept in their browser until they press Share, which syncs it in one step. Whoever opens the link is on the canvas with you, live cursors and all. A link is an Editor, Participant or view-only link (a Participant adds stickies, writes and votes but cannot reshape the board), and it can carry a password or an expiry date when you need it locked down.',
          'The collaboration tools go beyond cursors: leave comments on elements and assign action items to teammates directly on the canvas, tracked together in the Collaborate panel, with optional email notifications. A selection lock shows when someone is editing an element, so two people rarely end up changing the same thing at once.',
        ],
      },
      {
        heading: 'Connected to the rest of your workflow',
        paragraphs: [
          'Diagrams rarely live alone. liveplanner imports Mermaid (flowcharts, state and ER diagrams, the diagram-as-code format that lives in READMEs and AI output), Markdown outlines, Excalidraw scenes, draw.io files and Microsoft Whiteboard boards, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or a portable JSON file. Any share link embeds as a live-updating iframe in a wiki or doc: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'For programmatic use there is a free REST API with personal tokens and an MCP server at mcp.liveplanner.app that lets AI assistants read and edit your documents directly; their edits arrive live, outlined, and undoable as one unit. None of it sits behind a plan.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner really free?',
        a: 'Yes. The hosted version at liveplanner.app is free with every feature included, and there is no paid tier or plan to add one. The code is MIT-licensed, so you can also self-host the whole product on your own Cloudflare account.',
      },
      {
        q: 'Do my teammates need an account to edit with me?',
        a: 'No. Share a link and anyone who opens it can edit in real time, with live cursors and comments, without signing up. You do not need an account to create a document either: a guest’s document is kept in their browser until they press Share, which syncs it in one step. Accounts are optional and mainly useful for syncing your documents across devices and using teams.',
      },
      {
        q: 'Can I import my existing Miro boards?',
        a: "There's no direct Miro importer today. If your board is structured content (a flowchart, an org chart, a plan), the fastest path is to start from a liveplanner template, or to import a Mermaid or Markdown version of the structure and let liveplanner lay it out as a themed diagram. Boards from Excalidraw, draw.io and Microsoft Whiteboard do import directly.",
      },
      {
        q: 'Can liveplanner run workshops the way Miro does?',
        a: 'Sessions like retros, brainstorms, estimation and planning work well: switch a tab to Workshop and a facilitator can run a shared timer, dot-voting, live polls, a Q&A board and hidden responses that are revealed together, estimate cards run planning poker on the board, everyone can follow the facilitator’s view, and the document keeps the comments and assigned actions that came out of it. What liveplanner does not have is Miro’s large-scale facilitation ecosystem (breakout-style sessions, a meeting-app marketplace), so for big multi-team workshops Miro is still the deeper toolkit.',
      },
      {
        q: 'Can I self-host liveplanner?',
        a: 'Yes. The whole monorepo (editor, API, realtime, marketing site) is MIT-licensed and deploys to a Cloudflare account you control. There are no license checks and no required calls to our servers.',
      },
    ],
  },
  {
    slug: 'xmind',
    name: 'XMind',
    title: 'XMind alternative · liveplanner',
    description:
      'A free, open-source, browser-based XMind alternative for mind maps, plus flowcharts, whiteboards, Plan boards and more, with no account needed.',
    h1: 'The open-source, browser-based XMind alternative',
    lede: 'XMind is a polished tool built around mind maps, across desktop, mobile and the web. liveplanner is free and open source, needs no install and no account, and handles mind maps alongside flowcharts, whiteboards, Plan boards, timelines and wireframes in the same document.',
    rows: [
      {
        label: 'Runs in',
        us: 'Any browser, nothing to install',
        them: 'Desktop, mobile + web apps',
      },
      {
        label: 'Real-time multiplayer',
        us: 'Yes, share a link, no account needed',
        them: 'Yes, for maps in its cloud; how many depends on the plan',
      },
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Free tier, subscription for full features',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No' },
      {
        label: 'Mind-map editing',
        us: 'Tab for a child, Enter for a sibling, six layouts, an editable outline',
        them: 'Keyboard-first, with many map structures',
      },
      {
        label: 'Import your maps',
        us: "Yes, via XMind's Markdown export",
        them: 'Native .xmind files',
      },
      {
        label: 'Export',
        us: 'PNG, SVG, PDF, Mermaid, Markdown, JSON, all free',
        them: 'Multiple formats',
      },
      {
        label: 'Beyond mind maps',
        us: 'Flowcharts, whiteboards, Plan boards, spreadsheets, timelines, wireframes…',
        them: 'Mind-map focused',
      },
    ],
    themBest: [
      'The deepest mind-map toolkit: many map structures, branch folding and a distraction-free ZEN mode.',
      'A refined native desktop experience with dedicated mobile apps.',
      "Pitch mode turns a map's branches into presentation slides.",
    ],
    usBest: [
      'Brainstorm together in real time, with live cursors and comments, by sharing one link: nobody needs an account.',
      'Map from the keyboard: Tab adds a child and Enter a sibling, six layouts (Tree, Leftward, Balanced, Downward, Upward and Bubble) and Tidy Map keep it neat.',
      'Edit Outline opens the whole map as an indented list: rename, nest and reorder there, then save it back to the map in one step.',
      'More than mind maps: flowcharts, freehand whiteboards, Plan boards of cards, timelines, wireframes and charts in the same document.',
      'Nothing to install: open a link in any browser and start.',
      'Bring existing maps across: export Markdown from XMind and import it as a themed diagram.',
      'Sketch with the Freehand pen, or the Shape Pen to have a rough shape tidied into a clean one.',
      '147 templates (three mind-map styles among them), 24 one-click themes and ready-made looks make a map look polished instantly, clean or hand-drawn in the Sketch and Marker finishes.',
      'Free, open source, and self-hostable.',
    ],
    sections: [
      {
        heading: 'No install, no account, no subscription',
        paragraphs: [
          'XMind has grown well beyond the desktop: it now has a web version and real-time co-editing for maps kept in its cloud, with the number of shared maps set by your plan. Where liveplanner still differs is the friction before the first idea. It opens on any machine with a browser, including locked-down work laptops where you cannot install anything, and you can start a map without creating an account at all.',
          'Collaboration works the same way: send the link to a teammate and you are both on the map at the same time, with live cursors showing who is where, whether or not they have signed up. Comments and assigned actions live on the elements themselves, so feedback lands where the idea is, not in a separate chat thread.',
        ],
      },
      {
        heading: 'Bring your existing maps with you',
        paragraphs: [
          "You don't have to start over. XMind exports maps as Markdown outlines, and liveplanner imports Markdown directly: the outline becomes a real, themed node-and-link diagram, laid out for you, in place of the tab's contents (add a new tab first to keep what is there). Or paste the outline into a mind map's Edit Outline and every line becomes a mind node you can keep growing. Mermaid text imports too.",
          'Going the other direction is just as open: export a map as PNG, SVG, or PDF for documents, or as Mermaid or Markdown text to keep the structure portable. Nothing about export sits behind a subscription.',
        ],
      },
      {
        heading: 'One document for everything after the brainstorm',
        paragraphs: [
          'A mind map is usually the start of something: the ideas become a plan, the plan becomes a flowchart or a board of tasks. In XMind that next step usually happens in a different tool. In liveplanner it happens on the next tab: one document holds the mind map, the flowchart, the timeline, and the wireframe side by side, with tabs grouped into folders and per-tab layers when things get big. Plan mode turns a tab into a board of cards with columns, WIP limits and quick add, so the follow-up work can live next to the map that produced it.',
          'Templates cover the common shapes of that follow-up work (flowcharts, kanban, retros, org charts, timelines and more), and one-click themes restyle the whole canvas so everything stays visually consistent as the project grows. When it is time to walk people through it, Presentation mode turns elements from any tab into a slide deck, and a Pages tab adds designed slides from ready-made layouts.',
        ],
      },
      {
        heading: 'Free and open, with no upgrade prompts',
        paragraphs: [
          'XMind is a subscription product: the free version is capable but the full feature set is paid. liveplanner is MIT-licensed open source with a free hosted version and no paid tier at all. Every feature, including export, collaboration, and the API, is available to everyone, and you can self-host the whole thing on your own Cloudflare account if you prefer.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I import my XMind files?',
        a: "Not the .xmind file directly, but there is a clean path: export the map from XMind as Markdown, then use liveplanner's Markdown import. The outline becomes a themed, laid-out node-and-link diagram on the current tab, replacing what is there, so add a new tab first. To keep growing it as a mind map, paste the outline into a mind map's Edit Outline instead.",
      },
      {
        q: 'Does liveplanner work offline like the XMind desktop app?',
        a: "liveplanner is a browser app, and its Offline Mode keeps a document stored only in your browser, never sent to a server. A guest’s new documents start that way, and anyone can choose it when creating a document. But if fully offline desktop work is your main requirement, XMind's native apps are the stronger fit.",
      },
      {
        q: 'Is there a desktop or mobile app?',
        a: 'No. liveplanner runs in a modern browser with nothing to install. If you specifically want native desktop and mobile apps, XMind is the better pick there.',
      },
      {
        q: 'Is liveplanner really free?',
        a: 'Yes. There is no subscription and no feature gating: the hosted version is free with everything included, the code is MIT-licensed, and you can self-host it.',
      },
    ],
  },
  {
    slug: 'excalidraw',
    name: 'Excalidraw',
    title: 'Excalidraw alternative · liveplanner',
    description:
      'A more structured Excalidraw alternative: the same free, open-source, no-sign-up spirit, a hand-drawn Sketch finish, templates, tabs and free presentations.',
    h1: 'A more structured Excalidraw alternative',
    lede: 'Excalidraw is a much-loved open-source whiteboard with a hand-drawn feel. liveplanner shares the open-source, free, no-sign-up spirit, and can be drawn by hand too, in its Sketch and Marker finishes, but leans structured: start from a template, theme the whole canvas, split work across tabs, keep documents in folders and present them as slides, with a freehand Draw mode when you just want to sketch.',
    rows: [
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'Yes, MIT-licensed' },
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Free (paid Excalidraw+ hosted plan available)',
      },
      { label: 'Start without an account', us: 'Yes', them: 'Yes' },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Visual style',
        us: 'Four finishes, per tab or element: Flexible, Professional, Sketch (hand-drawn) and Marker (felt-tip)',
        them: 'Hand-drawn sketch look, with adjustable sloppiness',
      },
      {
        label: 'Structure',
        us: 'Templates, tabs, folders, layers, themes, five editor modes',
        them: 'A freeform canvas (Excalidraw+ adds workspaces and presentations)',
      },
      {
        label: 'Presentations',
        us: 'Free: slides from your canvas or 61 layouts, presenter notes, transitions',
        them: 'On the Excalidraw+ hosted plan, with a presenter view',
      },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + .excalidraw out',
        them: '.excalidraw, PNG + SVG; Mermaid flowcharts in',
      },
    ],
    themBest: [
      'The signature hand-drawn aesthetic that made it famous, with its own Excalifont lettering: one look, tuned over years.',
      'A huge community, shared shape libraries, and integrations that embed it in other tools.',
      'Dead-simple, single-canvas freeform sketching.',
      'Excalidraw+ adds presentations with a presenter view, and AI features that can run on your own model keys, on top of the free editor.',
    ],
    usBest: [
      'The hand-drawn look on any tab: the Sketch finish draws wobbly double strokes, pencil-shaded fills and handwriting, Marker draws one bold felt-tip stroke, and switching back to clean changes nothing about the diagram.',
      'Start from a real template (flowchart, kanban, retro, org chart…) instead of a blank page: 150 of them.',
      'Keep a whole project together: several tabs in one document, organised in folders, with per-tab layers.',
      '24 themes recolour the whole canvas, shapes and arrows, in one click, and ready-made looks such as Doodle, Notebook and Flipchart set the theme, finish, font and canvas pattern together.',
      'Draw mode is a plain whiteboard: pressure-sensitive markers, an eraser and shapes on a plain, dotted or grid board, light or dark.',
      'Sketching tools beyond the marker: a Path tool for clean curves, optional shape recognition, an eraser that takes a whole stroke or just part of one, and Draw templates such as Sketchnote, Rich Picture and Comic Strip.',
      'Paste an Excalidraw copy straight onto a tab, or import .excalidraw files as documents of their own.',
      'Presentations free for everyone: build a deck from elements on any tab, or design slides from 61 layouts in Pages, then present with notes, time budgets, transitions, a laser pointer and a spotlight.',
      'Animate a drawing so it draws itself on, or export a Pages tab as an animated GIF.',
      'Built-in charts, an icon library, comments and assigned actions, without add-ons.',
      'Smart alignment guides and snapping line everything up as you drag.',
      'Mermaid in and out: import flowchart, state and ER text, export flowcharts back to it.',
    ],
    sections: [
      {
        heading: 'The same spirit, more structure',
        paragraphs: [
          'liveplanner and Excalidraw agree on the important things: MIT-licensed, free, and no sign-up wall in front of the canvas. Where they diverge is what happens after the first sketch. Excalidraw keeps to a freeform board, and that simplicity is a feature. liveplanner assumes the sketch is going to grow: you start from a real template instead of a blank page, split the work across tabs inside one document, group tabs into folders, and separate annotation from content with per-tab layers.',
          'Themes carry that structure visually. Instead of styling shapes one by one, a single click restyles the entire canvas (shapes, arrows, text), and style presets plus a format painter keep new elements consistent with the rest.',
        ],
      },
      {
        heading: 'Hand-drawn when you want it',
        paragraphs: [
          'Every liveplanner tab has a finish, the way its elements are drawn, and two of the four are by hand. Sketch draws wobbly double-stroked outlines, pencil-shaded fills, arrowheads as two loose strokes and lettering in a handwriting font, like a diagram drawn on paper. Marker draws one bold, slightly see-through stroke per edge, darker where strokes cross, like a flip chart. Professional is the opposite: square corners, thin lines and crisp lettering for print. A finish is set per tab, or on one element, and it is only a look: switching back restores exactly what was there.',
          "Excalidraw's own style is still its signature, with its own typeface and sloppiness controls, and if that exact aesthetic is the point, Excalidraw wins it. But sketching isn't exclusive to it. Any liveplanner tab can also switch into Draw mode, a plain whiteboard with three pressure-sensitive markers, text, an eraser and shapes, on a plain, dotted or grid board in light or dark. In Diagram mode, the Freehand pen keeps a stroke exactly as drawn and the Shape Pen tidies a rough box into a clean element on release. Switching mode never changes the document: the same tab can hold a structured diagram and the freehand notes scribbled over it.",
        ],
      },
      {
        heading: 'Bring your Excalidraw boards along',
        paragraphs: [
          'An Excalidraw copy pasted onto a tab, or a file dropped on it, lands as whiteboard-native content in Draw mode. A .excalidraw file (or a PNG or SVG exported with the scene embedded) imports with shapes, arrows, text and connections intact, and the Explorer can import Excalidraw files as documents of their own. Each import ends with a report of anything that changed on the way in.',
          'Excalidraw’s wobble and hatched fills are a matter of look, so an import draws its shapes in the tab’s own finish: switch the tab to Sketch to keep the hand-drawn feel. Export goes the other way too: any diagram or whiteboard tab saves back out as a .excalidraw file. Excalidraw has fewer element types, so richer liveplanner elements simplify on the way out.',
        ],
      },
      {
        heading: 'Presentations, free',
        paragraphs: [
          'Presenting is one of the things Excalidraw+ adds on its paid plan. In liveplanner it is part of the free product. Pick elements on any tab and make them a slide, so the deck points at the real diagram and changes when it does, or switch a tab to Pages and design 16:9 or 4:3 slides from 61 ready-made layouts, with a Tab Window that shows another tab live on a slide.',
          'Present full screen with presenter notes, a time budget per slide, Slide or Fade transitions, auto-advance and loop, a laser pointer and a spotlight. Animate an element so a drawing draws itself on or a title types itself in, and export a Pages tab as PDF, PNG, SVG or an animated GIF.',
        ],
      },
      {
        heading: 'A workspace, not just a canvas',
        paragraphs: [
          'The free Excalidraw editor deliberately stays a single board, and its paid Excalidraw+ plan adds the workspace around it. liveplanner ships that workspace to everyone for free: an explorer with folders, thumbnail previews and a details list, teams with shared libraries any member can manage, a 30-day Trash, and share links that can carry a password or an expiry date.',
          'Collaboration is more than co-drawing, too: comments attach to elements, action items can be assigned to teammates and tracked in the Collaborate panel, and the Timeline gathers what happened across your documents into one day-by-day feed.',
        ],
      },
      {
        heading: 'Diagrams as code, and AI',
        paragraphs: [
          'liveplanner treats diagram text formats as first-class: Mermaid flowcharts import as real, editable diagrams and export back out, state and ER diagrams import too, and Markdown outlines import as laid-out node-and-link maps. There is also a free REST API with personal tokens and an MCP server that lets AI assistants read and edit documents directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner open source like Excalidraw?',
        a: "Yes. Both projects are MIT-licensed. liveplanner's whole monorepo is public, the hosted version is free with no paid tier, and you can self-host it on your own Cloudflare account.",
      },
      {
        q: 'Can I get the hand-drawn look in liveplanner?',
        a: "Yes. Switch a tab, or a single element, to the Sketch finish for wobbly double-stroked outlines, pencil-shaded fills and handwriting, or to Marker for bold felt-tip strokes; ready-made looks such as Doodle and Flipchart set it up in one click. Draw mode adds a freehand whiteboard with pressure-sensitive markers. Excalidraw's own style, with its Excalifont lettering, stays distinct: if that exact aesthetic is what you want, Excalidraw is the better pick.",
      },
      {
        q: 'Can I import my Excalidraw files?',
        a: 'Yes. Paste an Excalidraw copy onto a tab, or import a .excalidraw file (the format excalidraw.com’s "Save to disk" produces), or a PNG or SVG exported with the scene embedded. Shapes, arrows, text, images and connections come across; groups are not kept, since liveplanner has no groups, and the import report says so. You can also export a tab back to a .excalidraw file; since Excalidraw has fewer element types, richer liveplanner elements simplify on the way out.',
      },
      {
        q: 'Can I present from liveplanner, like Excalidraw+?',
        a: 'Yes, for free. Build a slide deck from elements on any tab, or design slides from 61 layouts in Pages, then present full screen with presenter notes, per-slide time budgets, transitions, auto-advance, a laser pointer and a spotlight. Slides made from the canvas point at the real elements, so the deck changes when the diagram does.',
      },
      {
        q: 'When should I pick Excalidraw instead?',
        a: "When you want one fast, freeform board in Excalidraw's own hand-drawn style and nothing else around it. liveplanner earns its keep when the work has structure: multiple tabs, folders, templates, themes, a deck to present, and a team sharing it.",
      },
    ],
  },
  {
    slug: 'drawio',
    name: 'draw.io',
    title: 'draw.io alternative · liveplanner',
    description:
      'A modern, real-time draw.io (diagrams.net) alternative: live multiplayer diagrams with no setup, templates, themes, and a direct .drawio import.',
    h1: 'The real-time draw.io alternative',
    lede: 'draw.io (diagrams.net) is a free, capable diagram editor with enormous shape libraries. liveplanner trades that breadth for a modern, multiplayer canvas you can open in one click, with templates and themes that make good-looking diagrams fast.',
    rows: [
      { label: 'Price', us: 'Free', them: 'Free' },
      {
        label: 'Real-time multiplayer',
        us: 'Yes, on every document, live cursors + presence',
        them: 'Yes, when the file lives in Google Drive, OneDrive, Confluence or Nextcloud',
      },
      { label: 'Start without an account', us: 'Yes', them: 'Yes' },
      {
        label: 'Shape libraries',
        us: 'Core shapes, device frames and technology icons',
        them: 'Vast (AWS, UML, network…)',
      },
      {
        label: 'Diagram-as-code',
        us: 'Mermaid import + export',
        them: 'Mermaid insert supported',
      },
      {
        label: 'Embed in docs and wikis',
        us: 'A live-updating iframe for any share link, editable from an editor link',
        them: 'Native Confluence / Jira apps',
      },
      {
        label: 'Best for',
        us: 'Collaborative diagrams, whiteboards + workshops',
        them: 'Formal / technical diagrams',
      },
    ],
    themBest: [
      'Specialist libraries: AWS/Azure, UML, network, BPMN, and more.',
      'Deep native integration with Confluence and Jira (liveplanner embeds are a generic iframe).',
      'Highly precise, formal technical diagrams.',
      'Files you keep in your own storage, with desktop apps for working entirely offline.',
    ],
    usBest: [
      'Real-time co-editing with live cursors and presence on every document, wherever it is stored.',
      'A modern, fast canvas with nothing to set up: open a link and go.',
      '147 templates and 24 themes for good-looking diagrams in minutes, not blank-canvas fiddling.',
      'Diagrams stay tidy on their own: arrows re-route as shapes move, with collision avoidance, alignment guides and snapping.',
      'Full-colour technology icons (AWS, Azure, Kubernetes, databases…) for architecture diagrams.',
      'Tidy Up lays out a tangle of shapes and arrows as a flowchart, tree or mind map, and the UML theme colours each shape by its meaning.',
      'Four finishes per tab: Professional for crisp, print-ready diagrams with square corners and thin lines, Sketch or Marker for a hand-drawn review, switched without touching the diagram.',
      'Database schemas with keys and field-to-field relationships, sequence diagrams, Sankey flows, and an Isometric view that tilts an architecture diagram into 3D blocks for a deck.',
      'Bring your diagrams with you: .drawio files import page by page, whole folders import as documents, and draw.io libraries become shape libraries.',
      'Charts, icons, freehand sketching, comments and a slide-deck Presentation mode, all built in.',
      'Free, MIT-licensed, and self-hostable on your own Cloudflare account.',
    ],
    sections: [
      {
        heading: 'Real-time by default',
        paragraphs: [
          'draw.io is built around a diagram file. It does support real-time co-editing, with shared cursors, when that file lives in Google Drive, OneDrive, Confluence Cloud or Nextcloud; otherwise working together means passing the file around. liveplanner is multiplayer on every document from the ground up: share a link and everyone is on the same canvas at once, with live cursors, presence, and a selection lock that shows when someone is already editing an element.',
          'The collaboration layer goes further than co-editing: comments attach to elements, action items can be assigned to a teammate (tracked in the Collaborate panel, with optional email notification), and a facilitator can run a shared timer, dot-voting and live polls when a diagram review turns into a workshop.',
        ],
      },
      {
        heading: 'From blank page to presentable, fast',
        paragraphs: [
          'draw.io gives you enormous power and expects you to wield it: picking stencils, styling shapes, routing lines. liveplanner optimises the first ten minutes instead. Templates give you a real starting structure (flowchart, kanban, org chart, timeline, ER and sequence diagrams and more), one-click themes style the whole canvas at once, and the diagram maintains itself as you work: arrows re-route around shapes and avoid colliding with each other, and alignment guides snap things into place.',
          'For architecture diagrams specifically, a Technology palette ships full-colour brand icons for the services people actually draw: AWS, Azure, Kubernetes, databases and more, no library hunting required. The Professional finish draws the whole tab crisp and print-ready (square corners, thin lines, no default shadows), and the Isometric view tilts it into raised 3D blocks for a slide or a screenshot.',
        ],
      },
      {
        heading: 'Sharing that fits the web',
        paragraphs: [
          'A liveplanner document is a URL, not a file. Share links open instantly for anyone, need no account, and can be protected with a password or an expiry date. Any share link also embeds as an iframe that live-updates in your wiki or docs as the diagram changes, so embedded copies never go stale: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'When you do need a file, any tab exports as PNG, SVG, PDF or a portable JSON file, the explorer shows thumbnail previews so you can find the right document at a glance, and signed-in users can mirror their documents to their own Google Drive.',
        ],
      },
      {
        heading: 'Diagram-as-code, both directions',
        paragraphs: [
          'If you keep diagrams next to code, liveplanner round-trips Mermaid flowcharts: paste the text (from a README, an issue, or an AI assistant) and it becomes a real, editable, themed diagram; export turns the diagram back into Mermaid. State and ER diagrams and Markdown outlines import too. And for automation there is a free REST API with personal tokens and an MCP server for AI tools.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner free like draw.io?',
        a: 'Yes. Both are free, and both are open source. liveplanner is MIT-licensed with a free hosted version at liveplanner.app, no paid tier, and the option to self-host on your own Cloudflare account.',
      },
      {
        q: 'Can I import my .drawio files?',
        a: 'Yes. Import a .drawio or .xml file, a Google Drive save without an extension, or a PNG or SVG exported from draw.io with the diagram included, and each page becomes a tab: shapes, text, colours, connections, swimlanes, class boxes, tables and layers come across. From the Explorer you can import many files or a whole folder as new documents, and draw.io libraries become shape libraries you place from the palette. Vendor stencils map to matching technology icons where there is a clear match; anything without a match comes in as a labelled box, and the import tells you exactly what changed on the way in.',
      },
      {
        q: 'Does liveplanner have AWS, UML, or network shape libraries?',
        a: "It ships full-colour technology icons (AWS, Azure, Kubernetes, databases and more) that cover most architecture diagrams, plus core shapes, device frames, and class, sequence and state machine templates. It does not have draw.io's formal notation libraries (full UML, BPMN, network stencils); for strict formal notation, draw.io is the better pick.",
      },
      {
        q: 'Can I self-host liveplanner the way I can run draw.io myself?',
        a: 'Yes. The entire codebase is MIT-licensed and deploys to a Cloudflare account you control, including the realtime collaboration. No license checks, no required calls to our servers.',
      },
    ],
  },
  {
    slug: 'google-slides',
    name: 'Google Slides',
    title: 'Google Slides alternative · liveplanner',
    description:
      'A free, open-source Google Slides alternative: slide pages from ready-made layouts, decks built from your canvas, notes, timing and transitions.',
    h1: 'A free, open-source Google Slides alternative',
    lede: 'Google Slides is the presentation tool most people already have open. liveplanner makes decks differently: start a slide page from a ready-made layout, or build slides straight from the work on your canvas, so the deck, the write-up and the plan behind it live in one document that your team edits together.',
    rows: [
      { label: 'Price', us: 'Free, every feature', them: 'Free with a Google account' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'A Google account to create decks',
      },
      { label: 'Real-time multiplayer', us: 'Yes, live cursors and comments', them: 'Yes' },
      {
        label: 'Designed slides',
        us: '16:9 or 4:3 slide pages from 61 layouts',
        them: 'Themes, layouts and a large template gallery',
      },
      {
        label: 'Slides from your work',
        us: 'Pick elements or a Plan board on any tab and it becomes a slide that stays in step',
        them: 'Paste or link charts and images in',
      },
      {
        label: 'Presenting',
        us: 'Presenter notes, per-slide time budgets, transitions, auto-advance and loop, laser and spotlight',
        them: 'Speaker notes, presenter view, audience Q&A, animations and transitions',
      },
      {
        label: 'Export',
        us: 'PDF, PNG, SVG and an animated GIF of the deck',
        them: 'PowerPoint, PDF and images',
      },
      {
        label: 'Beyond the deck',
        us: 'Diagrams, whiteboards, written pages, Plan boards and spreadsheets in the same document',
        them: 'One of several Google Workspace apps',
      },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
    ],
    themBest: [
      'Everyone in your organisation already lives in Google Workspace, with Drive, Meet and Docs around the deck.',
      'A full presentation suite: click-by-click builds within a slide, a presenter view, audience Q&A and a large template gallery.',
      'PowerPoint import and export, for decks that travel between organisations.',
      'Gemini in Slides drafts a whole, editable deck from a prompt, styled from your files, on eligible Workspace and Google AI plans.',
    ],
    usBest: [
      'Slides straight from the work: select elements or a Plan board on any tab and present it, and editing a shape updates every slide it is on.',
      'Slide pages when you want a designed deck: 16:9 or 4:3, started from 61 layouts (title, agenda, big numbers, roadmap and more).',
      'One document for the whole story: the write-up as pages, the diagram, the plan and the spreadsheet beside the deck that presents them.',
      'Present with presenter notes, a time budget per slide, Slide or Fade transitions, a laser pointer and a spotlight; your screen moves, nobody else’s.',
      'Leave a deck running on a screen: auto-advance every 5 to 60 seconds and loop back to the start.',
      'Animate any element: a title that types itself in, words that cascade, a drawing that draws itself, or a reveal that plays once and stays, over an animated page background if you like.',
      'Put another tab on a slide, live: a Tab Window shows the diagram or board as it is now, so the slide follows every change.',
      'Export the deck as an animated GIF, transitions and motion included, for a chat, an email or a README.',
      'Real-time editing with live cursors, comments and assigned actions, for anyone with the link, no account needed.',
      'An AI assistant connected over MCP can build the deck for you from slide layouts.',
      'Free, MIT-licensed and self-hostable.',
    ],
    sections: [
      {
        heading: 'Two ways to make a deck',
        paragraphs: [
          'In Google Slides a deck is its own file, built slide by slide. liveplanner gives you two ways in. Switch a tab to Pages and add slide pages, 16:9 or 4:3, each started from one of 61 layouts (a title, an agenda, two columns, image and text, a timeline and more) and painted from your theme. Or build slides from what is already on your canvas: select a cluster of elements, or a Plan board, and make it a slide.',
          'Slides made from the canvas point at the real elements rather than copying them, so the deck can never drift from the work: change a shape, a card or a label and every slide it is on changes with it. A Tab Window does the same for a whole tab: put one on a slide page and it shows that tab live, fitted to the frame. Both kinds of slide sit in one deck, ordered in the Slide Deck panel, saved with the document.',
        ],
      },
      {
        heading: 'Presenting, built for the room',
        paragraphs: [
          'Presenting runs full screen on your screen alone: nobody is dragged into your slide, and collaborators with the document open carry on working. Each slide carries its own presenter notes behind a button, and an optional time budget the HUD tracks as you talk. Transitions are Slide, Fade or None, at the speed you pick, and a laser pointer and spotlight guide the room.',
          'Nothing on a slide can be changed by a stray click, but everything can be read: click an element mid-talk to show its note, comments and assigned action, for the question you did not plan for.',
        ],
      },
      {
        heading: 'The deck and everything behind it',
        paragraphs: [
          'A deck is usually the last step of something: a write-up, a plan, an architecture, a retro. In Workspace those live in Docs, Sheets and Slides as separate files. In liveplanner they are tabs of one document: write the doc as pages, keep the plan on a Plan board with a Sheet beside it, sketch on a whiteboard, and present from all of it. Everyone edits live, with comments and assigned actions on the elements themselves.',
        ],
      },
      {
        heading: 'Free, open and no account needed',
        paragraphs: [
          'Slides is free with a Google account. liveplanner needs no account at all: open the editor and start, and a guest’s document stays in their browser until they press Share, which syncs it in one step. The whole product is MIT-licensed with no paid tier, and you can run your own copy on your own Cloudflare account. Export any page as a PNG, SVG or a print-ready PDF when a deck has to travel, or the whole deck as an animated GIF.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can liveplanner replace Google Slides?',
        a: 'For many decks, yes: slide pages from ready-made layouts, slides built from your canvas, presenter notes, time budgets, transitions, a laser pointer and a spotlight, all edited live with your team. If you need click-by-click builds within a slide, PowerPoint files or audience Q&A, Google Slides is still the deeper presentation suite.',
      },
      {
        q: 'Can I import or export PowerPoint files?',
        a: 'No. liveplanner does not read or write .pptx. You can export each page as a PNG or SVG, every page as one PDF, or the deck as an animated GIF, and drop those into another deck.',
      },
      {
        q: 'Do my audience or co-editors need an account?',
        a: 'No account of any kind. Share a link and anyone who opens it can view or edit in real time. Signing in (email code or Google) is optional and mainly adds cross-device sync and teams.',
      },
      {
        q: 'Can I keep my slides in step with a diagram or a plan?',
        a: 'Yes. A slide made from the canvas references the elements, or the Plan board, it shows, so editing them updates every slide they appear on. The deck can never drift from the work it presents.',
      },
      {
        q: 'Is liveplanner free?',
        a: 'Yes. It is MIT-licensed open source with a free hosted version, every feature included, and no paid tier. You can even use it without creating an account at all.',
      },
    ],
  },
  {
    slug: 'figjam',
    name: 'FigJam',
    title: 'FigJam alternative · liveplanner',
    description:
      'A free, open-source FigJam alternative: a real-time whiteboard with workshop tools, no account needed, 147 templates, Mermaid, an API and an MCP server.',
    h1: 'The free, open-source FigJam alternative',
    lede: 'FigJam is a polished, playful whiteboard that lives inside Figma. liveplanner covers the same ground, brainstorms, workshops and diagrams with your team in real time, as free, open-source software that anyone can open from a link, no account or Figma seat needed.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Free Starter plan with limits, then paid Figma seats',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create files',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Focus',
        us: 'Whiteboards and workshops, plus diagrams, designed pages, Plan boards and Sheets',
        them: 'Whiteboarding for teams that design in Figma',
      },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out, plus an animated GIF of a Pages tab',
        them: 'Its own files; image and PDF export',
      },
      {
        label: 'Programmatic access',
        us: 'REST API and an MCP server for AI tools, both free',
        them: 'A plugin and widget platform, and the Figma API',
      },
    ],
    themBest: [
      'Your team designs in Figma, and you want boards that sit beside your design files and copy across into them.',
      'A playful, polished feel: stamps, stickers, emotes, cursor chat and widgets.',
      'A large community of plugins, widgets and templates.',
      'FigJam AI, for generating boards, sorting and summarising sticky notes.',
    ],
    usBest: [
      'Free with no file limits and no seats: every feature, for everyone.',
      'Open a link and start, no account needed, even to create a document.',
      'Structured diagrams that stay tidy: shapes and arrows that stay attached, alignment guides, 24 one-click themes and 147 templates.',
      'Five ways to work one tab: Diagram for structure, Draw for freehand whiteboarding, Workshop for running a session with your team, Pages for slides, articles, posters and logos, and Plan for boards of cards, Sheets and forms.',
      'Diagrams with a whiteboard feel: the Sketch and Marker finishes draw any tab by hand, and ready-made looks set theme, finish, font and pattern in one click.',
      'Meet on the board: everyone walks an avatar round a virtual office or team space, with speech bubbles and a status.',
      'Workshop tools built in: Workshop mode, a facilitator role, a shared timer, dot-voting, live polls, planning-poker estimate cards, temperature checks, quizzes, an anonymous idea box and a Q&A board.',
      'Participant links: the room adds stickies, writes and votes, and nobody can reshape the board by accident.',
      'Run the meeting on the board: an agenda that starts the timer for each segment, a roll call, a random picker and decision records, plus around 190 emoji stickers and 32 word badges.',
      'Diagrams as code: Mermaid flowcharts import as editable diagrams and export back out.',
      'A free REST API and an MCP server, so scripts and AI assistants can read and edit your documents.',
      'MIT-licensed and self-hostable, so your boards never depend on one vendor.',
    ],
    sections: [
      {
        heading: 'A whiteboard without the seat',
        paragraphs: [
          'FigJam is part of Figma, and that is its great strength for design teams: boards and design files share one home. For everyone else, it means accounts, a free plan with limits on shared files, and paid seats as the team grows. liveplanner has none of that. Anyone can open the editor and create a document without signing up, share a link, and work together in real time; a guest’s document stays in their browser until they press Share, which syncs it in one step. There is no paid tier and no plan to introduce one.',
        ],
      },
      {
        heading: 'A whiteboard that keeps going',
        paragraphs: [
          'FigJam is excellent for loose, freeform boards. liveplanner’s Draw mode is a plain whiteboard too, with pressure-sensitive markers, sticky notes, text and shapes, but the same document carries on after the brainstorm. Switch a tab to Diagram when a sketch needs structure, with arrows that stay attached, themes that restyle the whole canvas in one click and a Marker or Sketch finish that keeps it looking hand-drawn; to Plan when the ideas become cards on a board, with a Sheet beside it and a form to gather more; or to Pages for the write-up and the slides.',
          'Start from one of 147 templates, from retrospectives and story maps to flowcharts and system architecture, and split larger work across tabs, folders and layers.',
        ],
      },
      {
        heading: 'Workshops built in',
        paragraphs: [
          'Running a session needs more than sticky notes. liveplanner gives sessions a mode of their own, Workshop, and one person the facilitator role, and with it a shared timer, dot-voting, live polls, a Q&A board and responses kept hidden until the reveal. Estimate cards run planning poker, a temperature check shows how the room feels, a quiz asks what it knows, and an idea box collects anonymous ideas until the reveal. There are templates for retrospectives in five formats, Lean Coffee, town hall Q&A and event storming, and comments and assigned actions keep the follow-ups with the board.',
        ],
      },
      {
        heading: 'Open at the edges',
        paragraphs: [
          'liveplanner imports Mermaid, Markdown, Excalidraw, draw.io and Microsoft Whiteboard boards, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or portable JSON. Any share link embeds as a live-updating iframe in a wiki or doc: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'For automation there is a free REST API with personal tokens and an MCP server that lets AI assistants read and edit your documents directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner really free compared with FigJam?',
        a: 'Yes. Every feature is free for everyone, with no file limits, no seats and no paid tier. The code is MIT-licensed, so you can also run your own copy.',
      },
      {
        q: 'Can I import my FigJam boards?',
        a: 'Not directly: there is no FigJam importer. You can bring a board across as a picture by exporting it from FigJam as a PNG and adding it to a tab as an image. For new work, start from one of the 147 templates.',
      },
      {
        q: 'Does liveplanner work with Figma?',
        a: 'Partly. A Figma file, prototype or board link sits on the canvas as a live embed, but nothing syncs or imports between the two. If your boards need to live beside your Figma design files, FigJam is the better pick. liveplanner exports SVG and PNG if you want to bring a diagram into a design.',
      },
      {
        q: 'Can my team join without accounts?',
        a: 'Yes. Share an editor link and anyone who opens it is on the canvas with you, live cursors and all, without signing up. A Participant link lets people add stickies, write and vote without reshaping the board, and a view-only link just watches. You can add a password or an expiry date to a link, and revoke it at any time.',
      },
    ],
  },
  {
    slug: 'lucidchart',
    name: 'Lucidchart',
    title: 'Lucidchart alternative · liveplanner',
    description:
      'A free, open-source Lucidchart alternative: real-time diagrams with no document or shape limits, no account needed, Mermaid, an API and MCP.',
    h1: 'The free Lucidchart alternative, with no plan limits',
    lede: 'Lucidchart is a mature, professional diagramming tool, with a free plan that limits how many documents and shapes you can make. liveplanner is free and open source with no such limits: real-time flowcharts, org charts and architecture diagrams that anyone can open from a link, no account needed.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Free plan with document and shape limits, then paid plans',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create documents',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Shape libraries',
        us: 'Core shapes, technology and line-art icons, UML, wireframes and charts',
        them: 'Very broad professional libraries (UML, BPMN, network, cloud, and more)',
      },
      {
        label: 'Import + export',
        us: 'draw.io, Excalidraw, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out',
        them: 'Visio, draw.io, Gliffy and Mermaid in; image, PDF and Visio out',
      },
      {
        label: 'Programmatic access',
        us: 'REST API and an MCP server for AI tools, both free',
        them: 'Developer platform and integrations',
      },
    ],
    themBest: [
      'Formal diagramming at scale: very broad shape libraries for UML, BPMN, network and cloud architecture.',
      'Data linking, which builds or updates diagrams from spreadsheets and other sources.',
      'Visio import and export, and deep integrations with enterprise suites.',
      'Enterprise admin, security and compliance controls.',
    ],
    usBest: [
      'Free with no plan limits on documents or shapes, and no paid tier.',
      'Open a link and start, no account needed, even to create a document.',
      '147 templates, from flowcharts, org charts and swimlanes to system and cloud architecture, database schemas and sequence, class and state diagrams.',
      'Real-time multiplayer with live cursors, comments, assigned actions and a laser pointer for presenting.',
      '24 one-click themes restyle the whole canvas, shapes and arrows, and the Professional finish draws it crisp and print-ready: square corners, thin lines, Inter lettering, no default shadows.',
      'Mermaid in and out: flowcharts import as editable diagrams and export back to text.',
      'Diagrams that tidy themselves: a new arrow curves around shapes in its way, Tidy Up lays a graph out as a flowchart or tree, and the UML theme colours each shape by its meaning.',
      'Database schemas with keys and field-to-field relationships, Sankey flows, and an Isometric view that tilts an architecture diagram into 3D blocks.',
      'A free REST API and an MCP server, so scripts and AI assistants can read and edit your documents.',
      'MIT-licensed and self-hostable, so your diagrams never depend on one vendor.',
    ],
    sections: [
      {
        heading: 'Free without the limits',
        paragraphs: [
          'Lucidchart’s free plan is a real way to try it, but it caps how many documents you can edit and how many shapes each one holds, so a growing diagram soon meets a paywall. liveplanner has no plan caps and no paid tier: there is no document or shape count to ration, and every feature is free for everyone. You do not even need an account to start.',
        ],
      },
      {
        heading: 'The diagrams you need, ready to go',
        paragraphs: [
          'liveplanner ships 147 templates, including flowcharts in four styles, swimlanes, org charts, mind maps, data-flow diagrams, system and cloud architecture, database schemas, Sankey flows, and sequence, class and state diagrams. Shapes and arrows stay attached and re-route as you move things, alignment guides and snapping keep layouts tidy, and themes restyle the whole canvas in one click. A finish sets how it is drawn: Professional for crisp, print-ready work, or Sketch and Marker when a review should feel like a whiteboard.',
          'Bigger work splits across tabs inside one document, grouped into folders, with Photoshop-style layers on each tab. Presentation mode turns elements from any tab into a slide deck, so you can walk a room through a diagram without exporting it, and a Pages tab adds designed slides with a live window onto the diagram.',
        ],
      },
      {
        heading: 'Where Lucidchart goes further',
        paragraphs: [
          'Lucidchart has spent years on formal notation, and it shows: its libraries for BPMN, network diagrams and cloud providers are far broader than ours, it can generate diagrams from data, it reads and writes Visio files, and it imports draw.io, Gliffy and Mermaid too. If your work depends on those, Lucidchart is the better tool. liveplanner aims at the everyday diagrams most teams draw, and makes them free, fast and collaborative.',
        ],
      },
      {
        heading: 'Open at the edges',
        paragraphs: [
          'liveplanner imports draw.io, Excalidraw, Microsoft Whiteboard, Mermaid and Markdown, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or portable JSON. Any share link embeds as a live-updating iframe in Confluence, Notion or any page that allows iframes: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'For automation there is a free REST API with personal tokens and an MCP server that lets AI assistants read and edit your documents directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is liveplanner a free alternative to Lucidchart?',
        a: 'Yes. Every feature is free for everyone, with no plan limits on documents or shapes, no seats and no paid tier. The code is MIT-licensed, so you can also run your own copy.',
      },
      {
        q: 'Can I import my Lucidchart diagrams?',
        a: 'Not directly: there is no Lucidchart importer. draw.io can bring in a Lucidchart diagram (pasted from the Lucidchart editor) and open Visio files, though, and liveplanner imports draw.io files with shapes, connections and labels intact, so you can bring a diagram across through draw.io. The import report says what changed on the way.',
      },
      {
        q: 'Does liveplanner support UML and architecture diagrams?',
        a: 'Yes, for the common cases: there are templates for class, sequence and state diagrams, database schemas, data flow, and system and cloud architecture, plus a technology icon library. Full BPMN, network and cloud-provider shape libraries remain Lucidchart’s strength.',
      },
      {
        q: 'Can my team collaborate without accounts?',
        a: 'Yes. Share an editor link and anyone who opens it is on the canvas with you, live cursors and all, without signing up. Signing in is optional and adds teams with shared document libraries.',
      },
    ],
  },
];

export const ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
