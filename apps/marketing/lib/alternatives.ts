// Single source of truth for the comparison / "alternative" pages
// (see docs/specs/019-marketing/comparison-pages.md). The dynamic route, its metadata,
// the index page, and the sitemap all derive from this list, so adding
// a competitor is a one-place change.
//
// Honesty rules (docs/specs/019-marketing/comparison-pages.md): every livediagram claim maps to a shipped
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
export const ALTERNATIVES_LAST_UPDATED = new Date('2026-10-07');

type ComparisonRow = {
  label: string;
  // Short, factual cell text. `us` = livediagram, `them` = competitor.
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
  // Comparison table rows (livediagram vs competitor).
  rows: ComparisonRow[];
  // Fairness section: genuine reasons to pick the competitor.
  themBest: string[];
  // Shipped livediagram differentiators for this comparison.
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
    title: 'Microsoft Whiteboard alternative · livediagram',
    description:
      'A free, open-source Microsoft Whiteboard alternative: a real-time whiteboard with pressure-sensitive ink, no Microsoft account needed, and an import that brings your boards across with the ink still editable.',
    h1: 'The open-source Microsoft Whiteboard alternative',
    lede: 'Microsoft is retiring Whiteboard for personal accounts: boards became read-only in September 2026, and the standalone apps and remaining legacy boards go on 16 October 2026. livediagram is a free, open-source home for that work: a real-time whiteboard with pressure-sensitive ink, no Microsoft account needed, and an import that brings your boards across with every stroke still editable.',
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
        them: 'Retiring: read-only since September 2026',
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
      'Inking with a pen on a Windows device or a Surface Hub, which Whiteboard is built around.',
    ],
    usBest: [
      'Your boards outlive the retirement: import a board export and each board becomes a document of its own, named and dated as the board, with pen strokes, colours, sticky notes, text, shapes and images all editable.',
      'No Microsoft account, no sign-up, no install: open a link and start drawing.',
      'Draw mode is a plain whiteboard: three pressure-sensitive markers, text, an eraser and shapes on a plain, dotted or grid board, light or dark.',
      'Real-time multiplayer with live cursors, comments and a laser pointer, for anyone with the link.',
      'Switch the same tab to Diagram mode when a sketch needs to become a tidy flowchart, org chart or plan.',
      '91 templates, including retrospectives, Lean Coffee, town hall Q&A and event storming boards.',
      'Free and MIT-licensed, so no future retirement can take your boards away: you can always run your own copy.',
    ],
    sections: [
      {
        heading: 'What the retirement means',
        paragraphs: [
          'Microsoft Whiteboard is not going away for everyone. Work and school accounts keep it inside Teams and on the web. What is ending is Whiteboard for personal Microsoft accounts and the standalone apps: personal boards became read-only on 25 September 2026, and on 16 October 2026 the standalone Windows, iOS and Android apps retire and the remaining legacy boards are deleted for good.',
          'If you used Whiteboard on a personal account, for teaching, family planning, tutoring or your own thinking, you need a new home for those boards and for the next ones. Check Microsoft’s own retirement notice for the details that apply to your account.',
        ],
      },
      {
        heading: 'Bring your boards across, ink and all',
        paragraphs: [
          'Whiteboard’s own exports are a flat picture: nothing in them stays editable. livediagram imports a board export instead, the folder of the board’s own edit history, and replays it, so every stroke comes back as data. Each board becomes its own document with one whiteboard tab, named after the board and dated as the board, so your library keeps its history.',
          'Pen strokes keep their pressure, so thick and thin stay as you drew them. Black ink on a light board, or white ink on a dark one, becomes the whiteboard’s own ink, so it reads in light and dark. Highlighter stays highlighter, and sticky notes, text, shapes and images keep their place. The import runs entirely in your browser: nothing is sent to a server, and it needs no Microsoft account. When it finishes, it says what changed on the way, such as rainbow ink drawn in pink.',
        ],
      },
      {
        heading: 'A whiteboard that grows into more',
        paragraphs: [
          'Draw mode is a plain whiteboard, close to what Whiteboard users are used to: pick a marker, draw, erase, add text and shapes. But the same tab can switch to Diagram mode when a sketch needs structure, with shapes and arrows that stay attached as you move things. A document holds as many tabs as you need, grouped into folders, and Presentation mode turns elements from any tab into a slide deck.',
          'For sessions, there are templates for retrospectives, Lean Coffee and town hall Q&A, and a facilitator can run a shared timer, votes and polls for the room.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [
          'A retirement like this is a reminder of what it means to rely on someone else’s product. livediagram is MIT-licensed and its whole codebase is public. The hosted version is free with no paid tier, and if you would rather not depend on it, you can deploy the same code to your own Cloudflare account.',
          'You can also keep a document entirely in your browser with Offline Mode, or, once signed in, mirror your documents to your own Google Drive.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is Microsoft Whiteboard being discontinued?',
        a: 'For personal Microsoft accounts, yes: boards became read-only on 25 September 2026, and the standalone apps retire and remaining legacy boards are deleted on 16 October 2026. Work and school accounts keep Whiteboard in Teams and on the web. Microsoft’s retirement notice has the details for your account.',
      },
      {
        q: 'Can I import my Microsoft Whiteboard boards?',
        a: 'Yes, from a board export: the folder of a board’s edit history, as the Whiteboard web app syncs it. Import one board, a folder of many boards, or a .zip of either from the Explorer, and each board becomes its own document with editable ink, sticky notes, text, shapes and images. Whiteboard’s own picture exports are not editable; you can still add one to a tab as an image.',
      },
      {
        q: 'Do I need a Microsoft account to use livediagram?',
        a: 'No. livediagram needs no account at all: open the editor and start drawing. Signing in, with email or Google, is optional and keeps your documents with you across devices.',
      },
      {
        q: 'Does livediagram work with a pen or stylus?',
        a: 'Yes. Draw mode has three pressure-sensitive markers, so a pen on a tablet or touchscreen draws thick and thin lines as you press. It runs in the browser, so there is nothing to install on any device.',
      },
      {
        q: 'When should I stay with Microsoft Whiteboard?',
        a: 'If you have a work or school account and your team lives in Teams, Whiteboard stays available there and fits naturally into your meetings and your organisation’s admin controls. livediagram suits personal use, mixed teams without a shared Microsoft tenant, and anyone who wants their boards in open, self-hostable software.',
      },
    ],
  },
  {
    slug: 'miro',
    name: 'Miro',
    title: 'Miro alternative · livediagram',
    description:
      'An open-source, free Miro alternative: real-time diagrams, whiteboards and workshop boards you can open without an account and host yourself.',
    h1: 'The open-source Miro alternative',
    lede: 'Miro is a powerful, sprawling online workspace. livediagram is a lighter, open-source take on the same idea: real-time multiplayer diagrams, whiteboards and workshop boards you can start in one click, with no sign-up, and run on your own account if you want to.',
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
        us: 'Excalidraw, draw.io, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out',
        them: 'Broad import + export options',
      },
      {
        label: 'Programmatic access',
        us: 'REST API and an MCP server for AI tools, both free',
        them: 'Developer platform + marketplace',
      },
      {
        label: 'Focus',
        us: 'Structured diagrams first, plus whiteboards, Plan boards and workshop tools',
        them: 'All-in-one visual workspace',
      },
    ],
    themBest: [
      'Facilitating very large workshops: breakout-scale sessions and a marketplace of meeting apps around the board.',
      'A deep template and integration marketplace (Jira, Slack, and more).',
      'AI woven through the whole workspace, well beyond a single assistant panel.',
      'Enterprise admin, SSO, and compliance at large scale.',
    ],
    usBest: [
      "It's free and MIT-licensed, so you can self-host it instead of paying per seat.",
      'Open a link and draw, with no sign-up wall in front of the canvas, even to create a document.',
      'Real-time multiplayer, live cursors and comments come standard, not gated behind a plan.',
      'Four ways to work one tab: Diagram for structure, Draw for freehand whiteboarding, Illustrate for designed pages, and Plan for boards of cards.',
      'Assign action items to teammates on the canvas itself, tracked beside comments in the Collaborate panel.',
      'Workshop tools built in: a facilitator role, a shared timer, dot-voting, live polls, a Q&A board and hidden-then-revealed responses.',
      '91 templates and 26 one-click whole-canvas themes turn a blank canvas into a polished diagram fast.',
      'Present a document as a slide deck built from its own elements, with a laser pointer and spotlight, no export needed.',
      'Bring boards across from Excalidraw, draw.io and Microsoft Whiteboard; export PNG, SVG, PDF, Mermaid or Excalidraw.',
    ],
    sections: [
      {
        heading: 'Diagrams first, with the workshop built in',
        paragraphs: [
          'Miro grew into a workspace: boards, workshops, docs, video walkthroughs, and a marketplace of apps. That breadth is genuinely useful for facilitation-heavy teams, but if what you mostly make is diagrams (architecture sketches, flowcharts, org charts, plans) much of it is surface area you scroll past. livediagram starts from the diagram: shapes, arrows, and structure are the core of the product.',
          'That focus shows up in the details. Arrows stay attached to shapes and re-route themselves as you move things, with collision avoidance so lines stop overlapping. Alignment guides and snapping keep layouts tidy without manual nudging. A format painter copies a style across elements, and style presets keep a diagram consistent. Bigger work splits across tabs inside one document, tabs group into folders, and each tab has Photoshop-style layers for separating annotation from content.',
          'When the session needs more than a diagram, the same tab switches mode: Draw for freehand whiteboarding with pressure-sensitive markers, and Plan mode for boards of cards with WIP limits and quick add. A facilitator can run the room with a shared timer, dot-voting, live polls and a Q&A board, and event storming boards come with their own notation, including turning a photo of a sticky-note wall into notes.',
        ],
      },
      {
        heading: 'Free means free, not a free tier',
        paragraphs: [
          "Miro's free tier is real, but it's the top of a pricing funnel: board limits and gated features exist to move teams onto paid seats. livediagram has no paid tier and no plan to introduce one. The hosted version at livediagram.app is free, every user gets every feature, and there is nothing to upgrade to.",
          "That's sustainable because the whole codebase is MIT-licensed and public. If you'd rather not depend on the hosted service at all, you can deploy the same code to your own Cloudflare account: the editor, the API, and the realtime collaboration all self-host, with no license keys and no phone-home checks.",
        ],
      },
      {
        heading: 'Collaboration without the onboarding',
        paragraphs: [
          'In Miro, creating a board starts with an account, and anonymous guest editing depends on the plan you are on. In livediagram, collaborating is a URL. Anyone can create a document without signing up, share a link, and whoever opens it is on the canvas with you, live cursors and all. Share links can carry a password or an expiry date when you need them locked down.',
          'The collaboration tools go beyond cursors: leave comments on elements and assign action items to teammates directly on the canvas, tracked together in the Collaborate panel, with optional email notifications. A selection lock shows when someone is editing an element, so two people rarely end up changing the same thing at once.',
        ],
      },
      {
        heading: 'Connected to the rest of your workflow',
        paragraphs: [
          'Diagrams rarely live alone. livediagram imports Mermaid (flowcharts, state and ER diagrams, the diagram-as-code format that lives in READMEs and AI output), Markdown outlines, Excalidraw scenes, draw.io files and Microsoft Whiteboard boards, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or a portable JSON file. Any share link can be embedded as a read-only, live-updating iframe in a wiki or doc.',
          'For programmatic use there is a free REST API with personal tokens and an MCP server at mcp.livediagram.app that lets AI assistants read and edit your documents directly; their edits arrive live, outlined, and undoable as one unit. None of it sits behind a plan.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram really free?',
        a: 'Yes. The hosted version at livediagram.app is free with every feature included, and there is no paid tier or plan to add one. The code is MIT-licensed, so you can also self-host the whole product on your own Cloudflare account.',
      },
      {
        q: 'Do my teammates need an account to edit with me?',
        a: 'No. Share a link and anyone who opens it can edit in real time, with live cursors and comments, without signing up. You do not need an account to create a document either. Accounts are optional and mainly useful for syncing your documents across devices and using teams.',
      },
      {
        q: 'Can I import my existing Miro boards?',
        a: "There's no direct Miro importer today. If your board is structured content (a flowchart, an org chart, a plan), the fastest path is to start from a livediagram template, or to import a Mermaid or Markdown version of the structure and let livediagram lay it out as a themed diagram. Boards from Excalidraw, draw.io and Microsoft Whiteboard do import directly.",
      },
      {
        q: 'Can livediagram run workshops the way Miro does?',
        a: 'Sessions like retros, brainstorms, estimation and planning work well: a facilitator can run a shared timer, dot-voting, live polls, a Q&A board and hidden responses that are revealed together, everyone can follow the facilitator’s view, and the document keeps the comments and assigned actions that came out of it. What livediagram does not have is Miro’s large-scale facilitation ecosystem (breakout-style sessions, a meeting-app marketplace), so for big multi-team workshops Miro is still the deeper toolkit.',
      },
      {
        q: 'Can I self-host livediagram?',
        a: 'Yes. The whole monorepo (editor, API, realtime, marketing site) is MIT-licensed and deploys to a Cloudflare account you control. There are no license checks and no required calls to our servers.',
      },
    ],
  },
  {
    slug: 'xmind',
    name: 'XMind',
    title: 'XMind alternative · livediagram',
    description:
      'A free, open-source, browser-based XMind alternative for mind maps, plus flowcharts, whiteboards, Plan boards and more, with no account needed.',
    h1: 'The open-source, browser-based XMind alternative',
    lede: 'XMind is a polished tool built around mind maps, across desktop, mobile and the web. livediagram is free and open source, needs no install and no account, and handles mind maps alongside flowcharts, whiteboards, Plan boards, timelines and wireframes in the same document.',
    rows: [
      {
        label: 'Runs in',
        us: 'Any browser, nothing to install',
        them: 'Desktop, mobile + web apps',
      },
      {
        label: 'Real-time multiplayer',
        us: 'Yes, share a link, no account needed',
        them: 'Yes, for maps stored in its cloud',
      },
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'Free tier, subscription for full features',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No' },
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
        us: 'Flowcharts, whiteboards, Plan boards, timelines, wireframes…',
        them: 'Mind-map focused',
      },
    ],
    themBest: [
      'Deep, keyboard-fast mind-map outlining and dedicated brainstorming modes.',
      'A refined native desktop experience with dedicated mobile apps.',
      "Pitch mode turns a map's branches into presentation slides.",
    ],
    usBest: [
      'Brainstorm together in real time, with live cursors and comments, by sharing one link: nobody needs an account.',
      'More than mind maps: flowcharts, freehand whiteboards, Plan boards of cards, timelines, wireframes and charts in the same document.',
      'Nothing to install: open a link in any browser and start.',
      'Bring existing maps across: export Markdown from XMind and import it as a themed diagram.',
      'Sketch with the Freehand pen, or the Shape Pen to have a rough shape tidied into a clean one.',
      '91 templates (three mind-map styles among them) and 26 one-click themes make a map look polished instantly.',
      'Free, open source, and self-hostable.',
    ],
    sections: [
      {
        heading: 'No install, no account, no subscription',
        paragraphs: [
          'XMind has grown well beyond the desktop: it now has a web version and real-time co-editing for maps kept in its cloud. Where livediagram still differs is the friction before the first idea. It opens on any machine with a browser, including locked-down work laptops where you cannot install anything, and you can start a map without creating an account at all.',
          'Collaboration works the same way: send the link to a teammate and you are both on the map at the same time, with live cursors showing who is where, whether or not they have signed up. Comments and assigned actions live on the elements themselves, so feedback lands where the idea is, not in a separate chat thread.',
        ],
      },
      {
        heading: 'Bring your existing maps with you',
        paragraphs: [
          "You don't have to start over. XMind exports maps as Markdown outlines, and livediagram imports Markdown directly: the outline becomes a real, themed node-and-link diagram on a new tab, laid out for you. Mermaid text imports the same way.",
          'Going the other direction is just as open: export any tab as PNG, SVG, or PDF for documents, or as Mermaid or Markdown text to keep the structure portable. Nothing about export sits behind a subscription.',
        ],
      },
      {
        heading: 'One document for everything after the brainstorm',
        paragraphs: [
          'A mind map is usually the start of something: the ideas become a plan, the plan becomes a flowchart or a board of tasks. In XMind that next step usually happens in a different tool. In livediagram it happens on the next tab: one document holds the mind map, the flowchart, the timeline, and the wireframe side by side, with tabs grouped into folders and per-tab layers when things get big. Plan mode turns a tab into a board of cards with columns, WIP limits and quick add, so the follow-up work can live next to the map that produced it.',
          'Templates cover the common shapes of that follow-up work (flowcharts, kanban, retros, org charts, timelines and more), and one-click themes restyle the whole canvas so everything stays visually consistent as the project grows. When it is time to walk people through it, Presentation mode turns elements from any tab into a slide deck.',
        ],
      },
      {
        heading: 'Free and open, with no upgrade prompts',
        paragraphs: [
          'XMind is a subscription product: the free version is capable but the full feature set is paid. livediagram is MIT-licensed open source with a free hosted version and no paid tier at all. Every feature, including export, collaboration, and the API, is available to everyone, and you can self-host the whole thing on your own Cloudflare account if you prefer.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I import my XMind files?',
        a: "Not the .xmind file directly, but there is a clean path: export the map from XMind as Markdown, then use livediagram's Markdown import. The outline becomes a themed, laid-out node-and-link diagram on a new tab.",
      },
      {
        q: 'Does livediagram work offline like the XMind desktop app?',
        a: "livediagram is a browser app, and its opt-in Offline Mode can keep a document stored only in your browser, never sent to a server. But if fully offline desktop work is your main requirement, XMind's native apps are the stronger fit.",
      },
      {
        q: 'Is there a desktop or mobile app?',
        a: 'No. livediagram runs in a modern browser with nothing to install. If you specifically want native desktop and mobile apps, XMind is the better pick there.',
      },
      {
        q: 'Is livediagram really free?',
        a: 'Yes. There is no subscription and no feature gating: the hosted version is free with everything included, the code is MIT-licensed, and you can self-host it.',
      },
    ],
  },
  {
    slug: 'excalidraw',
    name: 'Excalidraw',
    title: 'Excalidraw alternative · livediagram',
    description:
      'A more structured Excalidraw alternative: the same free, open-source, no-sign-up spirit, with templates, themes, tabs, folders and a freehand Draw mode.',
    h1: 'A more structured Excalidraw alternative',
    lede: 'Excalidraw is a much-loved open-source whiteboard with a hand-drawn feel. livediagram shares the open-source, free, no-sign-up spirit, but leans structured: start from a template, theme the whole canvas, split work across tabs, and keep documents in folders, with a freehand Draw mode when you just want to sketch.',
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
        us: 'Clean, themed shapes, plus freehand pressure markers',
        them: 'Hand-drawn sketch look',
      },
      {
        label: 'Structure',
        us: 'Templates, tabs, folders, layers, themes, four editor modes',
        them: 'A freeform canvas (Excalidraw+ adds workspaces)',
      },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Mermaid + Markdown in; PNG, SVG, PDF, Mermaid + .excalidraw out',
        them: '.excalidraw, PNG + SVG; Mermaid in',
      },
    ],
    themBest: [
      'The signature hand-drawn aesthetic that made it famous.',
      'A huge community, shared shape libraries, and integrations that embed it in other tools.',
      'Dead-simple, single-canvas freeform sketching.',
    ],
    usBest: [
      'Start from a real template (flowchart, kanban, retro, org chart…) instead of a blank page: 91 of them.',
      'Keep a whole project together: several tabs in one document, organised in folders, with per-tab layers.',
      '26 themes recolour the whole canvas, shapes and arrows, in one click.',
      'Draw mode is a plain whiteboard: pressure-sensitive markers, an eraser and shapes on a plain, dotted or grid board, light or dark.',
      'Paste an Excalidraw copy straight onto a tab, or import .excalidraw files as documents of their own.',
      'Built-in charts, an icon library, comments, assigned actions and a slide-deck Presentation mode, without add-ons.',
      'Smart alignment guides and snapping line everything up as you drag.',
      'Mermaid in and out: import flowchart, state and ER text, export flowcharts back to it.',
    ],
    sections: [
      {
        heading: 'The same spirit, more structure',
        paragraphs: [
          'livediagram and Excalidraw agree on the important things: MIT-licensed, free, and no sign-up wall in front of the canvas. Where they diverge is what happens after the first sketch. Excalidraw keeps to a freeform board, and that simplicity is a feature. livediagram assumes the sketch is going to grow: you start from a real template instead of a blank page, split the work across tabs inside one document, group tabs into folders, and separate annotation from content with per-tab layers.',
          'Themes carry that structure visually. Instead of styling shapes one by one, a single click restyles the entire canvas (shapes, arrows, text), and style presets plus a format painter keep new elements consistent with the rest.',
        ],
      },
      {
        heading: 'Keep the sketch when you want it',
        paragraphs: [
          "The hand-drawn look is Excalidraw's signature, and if that aesthetic is the point, Excalidraw wins it outright. But sketching itself isn't exclusive to it. Any livediagram tab can switch into Draw mode, a plain whiteboard with three pressure-sensitive markers, text, an eraser and shapes, on a plain, dotted or grid board in light or dark. In Diagram mode, the Freehand pen keeps a stroke exactly as drawn and the Shape Pen tidies a rough box into a clean element on release.",
          'Switching mode never changes the document: the same tab can hold a structured diagram and the freehand notes scribbled over it.',
        ],
      },
      {
        heading: 'Bring your Excalidraw boards along',
        paragraphs: [
          'An Excalidraw copy pasted onto a tab, or a file dropped on it, lands as whiteboard-native content in Draw mode. A .excalidraw file (or a PNG or SVG exported with the scene embedded) imports with shapes, arrows, text and connections intact, and the Explorer can import Excalidraw files as documents of their own. Each import ends with a report of anything that changed on the way in.',
          'Export goes the other way too: any tab saves back out as a .excalidraw file. Excalidraw has fewer element types, so richer livediagram elements simplify on the way out.',
        ],
      },
      {
        heading: 'A workspace, not just a canvas',
        paragraphs: [
          'The free Excalidraw editor deliberately stays a single board, and its paid Excalidraw+ plan adds the workspace around it. livediagram ships that workspace to everyone for free: an explorer with folders and thumbnail previews, teams with shared libraries any member can manage, a 30-day Trash, and share links that can carry a password or an expiry date.',
          'Collaboration is more than co-drawing, too: comments attach to elements, action items can be assigned to teammates and tracked in the Collaborate panel, and the Timeline gathers what happened across your documents into one day-by-day feed.',
        ],
      },
      {
        heading: 'Diagrams as code, and AI',
        paragraphs: [
          'livediagram treats diagram text formats as first-class: Mermaid flowcharts import as real, editable diagrams and export back out, state and ER diagrams import too, and Markdown outlines import as laid-out node-and-link maps. There is also a free REST API with personal tokens and an MCP server that lets AI assistants read and edit documents directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram open source like Excalidraw?',
        a: "Yes. Both projects are MIT-licensed. livediagram's whole monorepo is public, the hosted version is free with no paid tier, and you can self-host it on your own Cloudflare account.",
      },
      {
        q: 'Can I get the hand-drawn look in livediagram?',
        a: "Partially. Draw mode is a freehand whiteboard with pressure-sensitive markers, and in Diagram mode the Shape Pen tidies a rough sketch into a clean shape. But livediagram's shapes are clean and themed by design; if the signature sketchy aesthetic is what you want, Excalidraw is the better pick.",
      },
      {
        q: 'Can I import my Excalidraw files?',
        a: 'Yes. Paste an Excalidraw copy onto a tab, or import a .excalidraw file (the format excalidraw.com’s "Save to disk" produces), or a PNG or SVG exported with the scene embedded. Shapes, arrows, text, images and connections come across; groups are not kept, since livediagram has no groups, and the import report says so. You can also export a tab back to a .excalidraw file; since Excalidraw has fewer element types, richer livediagram elements simplify on the way out.',
      },
      {
        q: 'When should I pick Excalidraw instead?',
        a: 'When you want one fast, freeform board with a hand-drawn feel and nothing else around it. livediagram earns its keep when the work has structure: multiple tabs, folders, templates, themes, and a team sharing it.',
      },
    ],
  },
  {
    slug: 'drawio',
    name: 'draw.io',
    title: 'draw.io alternative · livediagram',
    description:
      'A modern, real-time draw.io (diagrams.net) alternative: live multiplayer diagrams with no setup, templates, themes, and a direct .drawio import.',
    h1: 'The real-time draw.io alternative',
    lede: 'draw.io (diagrams.net) is a free, capable diagram editor with enormous shape libraries. livediagram trades that breadth for a modern, multiplayer canvas you can open in one click, with templates and themes that make good-looking diagrams fast.',
    rows: [
      { label: 'Price', us: 'Free', them: 'Free' },
      {
        label: 'Real-time multiplayer',
        us: 'Yes, on every document, live cursors + presence',
        them: 'Yes, when the file lives in Google Drive, OneDrive or Confluence',
      },
      { label: 'Start without an account', us: 'Yes', them: 'Yes' },
      {
        label: 'Shape libraries',
        us: 'Core shapes, device frames, technology icons + your own imported libraries',
        them: 'Vast (AWS, UML, network…)',
      },
      {
        label: 'Diagram-as-code',
        us: 'Mermaid import + export',
        them: 'Mermaid insert supported',
      },
      {
        label: 'Embed in docs and wikis',
        us: 'Read-only iframe embed for any share link, live-updating',
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
      'Deep native integration with Confluence and Jira (livediagram embeds are a generic iframe).',
      'Highly precise, formal technical diagrams.',
      'Files you keep in your own storage, with desktop apps for working entirely offline.',
    ],
    usBest: [
      'Real-time co-editing with live cursors and presence on every document, wherever it is stored.',
      'A modern, fast canvas with nothing to set up: open a link and go.',
      '91 templates and 26 themes for good-looking diagrams in minutes, not blank-canvas fiddling.',
      'Diagrams stay tidy on their own: arrows re-route as shapes move, with collision avoidance, alignment guides and snapping.',
      'Full-colour technology icons (AWS, Azure, Kubernetes, databases…) for architecture diagrams.',
      'Bring your diagrams with you: .drawio files import page by page, whole folders import as documents, and draw.io libraries become shape libraries.',
      'Charts, icons, freehand sketching, comments and a slide-deck Presentation mode, all built in.',
      'Free, MIT-licensed, and self-hostable on your own Cloudflare account.',
    ],
    sections: [
      {
        heading: 'Real-time by default',
        paragraphs: [
          'draw.io is built around a diagram file. It does support real-time co-editing, with shared cursors, when that file lives in Google Drive, OneDrive or Confluence Cloud; otherwise working together means passing the file around. livediagram is multiplayer on every document from the ground up: share a link and everyone is on the same canvas at once, with live cursors, presence, and a selection lock that shows when someone is already editing an element.',
          'The collaboration layer goes further than co-editing: comments attach to elements, action items can be assigned to a teammate (tracked in the Collaborate panel, with optional email notification), and a facilitator can run a shared timer, dot-voting and live polls when a diagram review turns into a workshop.',
        ],
      },
      {
        heading: 'From blank page to presentable, fast',
        paragraphs: [
          'draw.io gives you enormous power and expects you to wield it: picking stencils, styling shapes, routing lines. livediagram optimises the first ten minutes instead. Templates give you a real starting structure (flowchart, kanban, org chart, timeline, ER and sequence diagrams and more), one-click themes style the whole canvas at once, and the diagram maintains itself as you work: arrows re-route around shapes and avoid colliding with each other, and alignment guides snap things into place.',
          'For architecture diagrams specifically, a Technology palette ships full-colour brand icons for the services people actually draw: AWS, Azure, Kubernetes, databases and more, no library hunting required.',
        ],
      },
      {
        heading: 'Sharing that fits the web',
        paragraphs: [
          'A livediagram document is a URL, not a file. Share links open instantly for anyone, need no account, and can be protected with a password or an expiry date. Any share link also embeds as a read-only iframe that live-updates in your wiki or docs as the diagram changes, so embedded copies never go stale.',
          'When you do need a file, any tab exports as PNG, SVG, PDF or a portable JSON file, the explorer shows thumbnail previews so you can find the right document at a glance, and signed-in users can mirror their documents to their own Google Drive.',
        ],
      },
      {
        heading: 'Diagram-as-code, both directions',
        paragraphs: [
          'If you keep diagrams next to code, livediagram round-trips Mermaid flowcharts: paste the text (from a README, an issue, or an AI assistant) and it becomes a real, editable, themed diagram; export turns the diagram back into Mermaid. State and ER diagrams and Markdown outlines import too. And for automation there is a free REST API with personal tokens and an MCP server for AI tools.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram free like draw.io?',
        a: 'Yes. Both are free, and both are open source. livediagram is MIT-licensed with a free hosted version at livediagram.app, no paid tier, and the option to self-host on your own Cloudflare account.',
      },
      {
        q: 'Can I import my .drawio files?',
        a: 'Yes. Import a .drawio or .xml file, a Google Drive save without an extension, or a PNG or SVG exported from draw.io with the diagram included, and each page becomes a tab: shapes, text, colours, connections, swimlanes, class boxes, tables and layers come across. From the Explorer you can import many files or a whole folder as new documents, and draw.io libraries become shape libraries you place from the palette. Vendor stencils map to matching technology icons where there is a clear match; anything without a match comes in as a labelled box, and the import tells you exactly what changed on the way in.',
      },
      {
        q: 'Does livediagram have AWS, UML, or network shape libraries?',
        a: "It ships full-colour technology icons (AWS, Azure, Kubernetes, databases and more) that cover most architecture diagrams, plus core shapes, device frames, and class, sequence and state machine templates. It does not have draw.io's formal notation libraries (full UML, BPMN, network stencils); for strict formal notation, draw.io is the better pick.",
      },
      {
        q: 'Can I self-host livediagram the way I can run draw.io myself?',
        a: 'Yes. The entire codebase is MIT-licensed and deploys to a Cloudflare account you control, including the realtime collaboration. No license checks, no required calls to our servers.',
      },
    ],
  },
  {
    slug: 'google-slides',
    name: 'Google Slides',
    title: 'A Google Slides alternative for diagrams · livediagram',
    description:
      "Diagrams in Google Slides get fiddly fast: connectors don't route around anything and the canvas is a fixed slide. livediagram is a canvas built for diagrams.",
    h1: 'A canvas built for diagrams, not slides',
    lede: "Plenty of people draw diagrams in Google Slides because it's already open. But Slides is a presentation tool: its connectors stay attached but never route around anything, its diagram layouts are few and simple, and the canvas is a fixed slide. livediagram is purpose-built for diagrams.",
    rows: [
      { label: 'Built for diagrams', us: 'Yes', them: 'No, it is for presentations' },
      {
        label: 'Arrows track shapes',
        us: 'Yes, and they re-route around obstacles',
        them: 'Connectors attach, but do not route around shapes',
      },
      {
        label: 'Diagram templates',
        us: '91 templates: flowchart, mind map, kanban…',
        them: 'A few simple diagram layouts',
      },
      { label: 'Canvas', us: 'Infinite and pannable', them: 'Fixed slide size' },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Get it into a deck',
        us: 'Export PNG, SVG or PDF, or present it as a slide deck',
        them: 'Already a slide',
      },
      { label: 'Price', us: 'Free, open source', them: 'Free with a Google account' },
    ],
    themBest: [
      "You're already building a slide deck and just need a quick diagram inside it.",
      'Everyone in your org already lives in Google Workspace.',
      'You want the diagram living on a slide inside a polished, standalone deck (livediagram embeds target wikis and docs, not slide decks).',
    ],
    usBest: [
      'Arrows that stay connected to shapes and re-route around obstacles as you move them.',
      'Start from one of 91 templates (flowchart, mind map, kanban…) instead of an empty slide.',
      'An infinite, pannable canvas instead of a fixed slide, with a minimap to navigate big ones.',
      'Diagram-native tools: smart snapping, a format painter, quick-connect arrows, charts and icons.',
      'Real-time multiplayer with live cursors and comments, plus a Presentation mode that turns the diagram into a slide deck.',
      'Free and open source, with no Google account required to start.',
    ],
    sections: [
      {
        heading: 'Connectors that actually route',
        paragraphs: [
          "Slides does have connector lines that stick to a shape's connection points, but past a few boxes they betray you: they cut straight across other shapes, they cross each other, and every layout tweak means re-bending lines by hand. In livediagram, arrows are attached to the shapes they connect and route themselves. Move a box and its arrows follow, re-routing around obstacles and avoiding collisions with other lines. Curved and elbowed arrows have draggable handles when you want manual control, and alignment guides plus snapping keep the whole layout square.",
        ],
      },
      {
        heading: 'Start from a diagram, not a blank slide',
        paragraphs: [
          'Slides offers a handful of simple diagram layouts (grids, processes, timelines and the like) sized to a slide. livediagram starts you from 91 real diagram templates (flowcharts, mind maps, kanban boards, org charts, timelines, architecture diagrams and more) and themes the whole canvas in one click, so the result looks deliberate without manual styling.',
          'The palette is diagram-native too: an icon library, full-colour technology icons for architecture diagrams, charts, freehand sketching with a Shape Pen that tidies rough shapes, and device frames for wireframes. And the canvas is infinite and pannable, with a minimap for navigating big diagrams, instead of a fixed 16:9 rectangle.',
        ],
      },
      {
        heading: 'Sharing and presenting stay easy',
        paragraphs: [
          "The reason people reach for Slides is that sharing is effortless, and livediagram keeps that: share a link and anyone can view or edit in real time, no account needed, not even a Google one. Comments and live cursors work like you'd expect.",
          'When it is time to present, Presentation mode builds a slide deck out of the document itself: each slide is a set of elements you pick, from any tab, with presenter notes, and editing a shape updates every slide it is on. A laser pointer and spotlight work while you present. And if the diagram ultimately belongs in a Slides deck, export it as PNG, SVG, or PDF and drop it onto the slide; for wikis and docs, a share link embeds as a live-updating read-only iframe instead.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do collaborators need a Google account?',
        a: 'No account of any kind. Share a link and anyone who opens it can view or edit in real time. Signing in (email code or Google) is optional and mainly adds cross-device sync and teams.',
      },
      {
        q: 'Can I put a livediagram diagram into my slide deck?',
        a: 'Yes. Export the tab as a PNG, SVG, or PDF and place it on the slide. For living documents like wikis and docs, embedding the share link as an iframe is better: it updates automatically as the diagram changes.',
      },
      {
        q: 'Can livediagram replace Slides for presentations?',
        a: 'For presenting a diagram, often yes: Presentation mode turns elements from any tab into a full-screen slide deck, with presenter notes, a laser pointer and a spotlight, and the slides stay in step with the canvas. For a polished, text-heavy standalone deck with transitions and the rest of a presentation suite, build it in Slides and export your diagrams into it.',
      },
      {
        q: 'Is livediagram free?',
        a: 'Yes. It is MIT-licensed open source with a free hosted version, every feature included, and no paid tier. You can even use it without creating an account at all.',
      },
    ],
  },
  {
    slug: 'figjam',
    name: 'FigJam',
    title: 'FigJam alternative · livediagram',
    description:
      'A free, open-source FigJam alternative: a real-time whiteboard and diagram canvas with no account needed, 91 templates, Mermaid, an API and an MCP server for AI tools.',
    h1: 'The free, open-source FigJam alternative',
    lede: 'FigJam is a polished, playful whiteboard that lives inside Figma. livediagram covers the same ground, brainstorms, workshops and diagrams with your team in real time, as free, open-source software that anyone can open from a link, no account or Figma seat needed.',
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
        us: 'Diagrams first, plus whiteboards and workshop tools',
        them: 'Whiteboarding for teams that design in Figma',
      },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out',
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
      'AI features built into the board for generating and summarising content.',
    ],
    usBest: [
      'Free with no file limits and no seats: every feature, for everyone.',
      'Open a link and start, no account needed, even to create a document.',
      'Structured diagrams that stay tidy: shapes and arrows that stay attached, alignment guides, 26 one-click themes and 91 templates.',
      'Four ways to work one tab: Diagram for structure, Draw for freehand whiteboarding, Illustrate for designed pages, and Plan for boards of cards.',
      'Workshop tools built in: a facilitator role, a shared timer, dot-voting, live polls, a Q&A board and hidden-then-revealed responses.',
      'Diagrams as code: Mermaid flowcharts import as editable diagrams and export back out.',
      'A free REST API and an MCP server, so scripts and AI assistants can read and edit your documents.',
      'MIT-licensed and self-hostable, so your boards never depend on one vendor.',
    ],
    sections: [
      {
        heading: 'A whiteboard without the seat',
        paragraphs: [
          'FigJam is part of Figma, and that is its great strength for design teams: boards and design files share one home. For everyone else, it means accounts, a free plan with limits on shared files, and paid seats as the team grows. livediagram has none of that. Anyone can open the editor and create a document without signing up, share a link, and work together in real time. There is no paid tier and no plan to introduce one.',
        ],
      },
      {
        heading: 'Diagrams that stay tidy',
        paragraphs: [
          'FigJam is excellent for loose, freeform boards. livediagram starts from the diagram: shapes and arrows that stay attached and re-route as you move things, alignment guides and snapping, a format painter, and themes that restyle the whole canvas in one click. Start from one of 91 templates, from flowcharts and org charts to retrospectives and system architecture, and split larger work across tabs, folders and layers.',
          'When a session needs freehand, the same tab switches to Draw mode, a plain whiteboard with pressure-sensitive markers.',
        ],
      },
      {
        heading: 'Workshops built in',
        paragraphs: [
          'Running a session needs more than sticky notes. livediagram gives one person the facilitator role, and with it a shared timer, dot-voting, live polls, a Q&A board and responses kept hidden until the reveal. There are templates for retrospectives in five formats, Lean Coffee, town hall Q&A and event storming, and comments and assigned actions keep the follow-ups with the board.',
        ],
      },
      {
        heading: 'Open at the edges',
        paragraphs: [
          'livediagram imports Mermaid, Markdown, Excalidraw, draw.io and Microsoft Whiteboard boards, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or portable JSON. Any share link embeds as a read-only, live-updating iframe in a wiki or doc.',
          'For automation there is a free REST API with personal tokens and an MCP server that lets AI assistants read and edit your documents directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram really free compared with FigJam?',
        a: 'Yes. Every feature is free for everyone, with no file limits, no seats and no paid tier. The code is MIT-licensed, so you can also run your own copy.',
      },
      {
        q: 'Can I import my FigJam boards?',
        a: 'Not directly: there is no FigJam importer. You can bring a board across as a picture by exporting it from FigJam as a PNG and adding it to a tab as an image. For new work, start from one of the 91 templates.',
      },
      {
        q: 'Does livediagram work with Figma?',
        a: 'No, there is no Figma integration. If your boards need to live beside your Figma design files, FigJam is the better pick. livediagram exports SVG and PNG if you want to bring a diagram into a design.',
      },
      {
        q: 'Can my team join without accounts?',
        a: 'Yes. Share an editor link and anyone who opens it is on the canvas with you, live cursors and all, without signing up. You can add a password or an expiry date to a link, and revoke it at any time.',
      },
    ],
  },
  {
    slug: 'lucidchart',
    name: 'Lucidchart',
    title: 'Lucidchart alternative · livediagram',
    description:
      'A free, open-source Lucidchart alternative: real-time diagrams with no document or shape limits, no account needed, 91 templates, Mermaid, an API and an MCP server for AI tools.',
    h1: 'The free Lucidchart alternative, with no limits',
    lede: 'Lucidchart is a mature, professional diagramming tool, with a free plan that limits how many documents and shapes you can make. livediagram is free and open source with no such limits: real-time flowcharts, org charts and architecture diagrams that anyone can open from a link, no account needed.',
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
        them: 'Visio and other formats in; image, PDF and Visio out',
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
      'Free with no limits on documents or shapes, and no paid tier.',
      'Open a link and start, no account needed, even to create a document.',
      '91 templates, from flowcharts, org charts and swimlanes to system and cloud architecture, database schemas and sequence, class and state diagrams.',
      'Real-time multiplayer with live cursors, comments, assigned actions and a laser pointer for presenting.',
      '26 one-click themes restyle the whole canvas, shapes and arrows.',
      'Mermaid in and out: flowcharts import as editable diagrams and export back to text.',
      'A free REST API and an MCP server, so scripts and AI assistants can read and edit your documents.',
      'MIT-licensed and self-hostable, so your diagrams never depend on one vendor.',
    ],
    sections: [
      {
        heading: 'Free without the limits',
        paragraphs: [
          'Lucidchart’s free plan is a real way to try it, but it caps how many documents you can edit and how many shapes each one holds, so a growing diagram soon meets a paywall. livediagram has no caps and no paid tier: every document can be as large as it needs to be, and every feature is free for everyone. You do not even need an account to start.',
        ],
      },
      {
        heading: 'The diagrams you need, ready to go',
        paragraphs: [
          'livediagram ships 91 templates, including flowcharts in four styles, swimlanes, org charts, mind maps, data-flow diagrams, system and cloud architecture, database schemas, and sequence, class and state diagrams. Shapes and arrows stay attached and re-route as you move things, alignment guides and snapping keep layouts tidy, and themes restyle the whole canvas in one click.',
          'Bigger work splits across tabs inside one document, grouped into folders, with Photoshop-style layers on each tab. Presentation mode turns elements from any tab into a slide deck, so you can walk a room through a diagram without exporting it.',
        ],
      },
      {
        heading: 'Where Lucidchart goes further',
        paragraphs: [
          'Lucidchart has spent years on formal notation, and it shows: its libraries for BPMN, network diagrams and cloud providers are far broader than ours, it can generate diagrams from data, and it reads and writes Visio files. If your work depends on those, Lucidchart is the better tool. livediagram aims at the everyday diagrams most teams draw, and makes them free, fast and collaborative.',
        ],
      },
      {
        heading: 'Open at the edges',
        paragraphs: [
          'livediagram imports draw.io, Excalidraw, Microsoft Whiteboard, Mermaid and Markdown, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or portable JSON. Any share link embeds as a read-only, live-updating iframe in Confluence, Notion or any page that allows iframes.',
          'For automation there is a free REST API with personal tokens and an MCP server that lets AI assistants read and edit your documents directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram a free alternative to Lucidchart?',
        a: 'Yes. Every feature is free for everyone, with no limits on documents or shapes, no seats and no paid tier. The code is MIT-licensed, so you can also run your own copy.',
      },
      {
        q: 'Can I import my Lucidchart diagrams?',
        a: 'Not directly: there is no Lucidchart importer. draw.io can open Lucidchart and Visio files, though, and livediagram imports draw.io files with shapes, connections and labels intact, so you can bring a diagram across through draw.io. The import report says what changed on the way.',
      },
      {
        q: 'Does livediagram support UML and architecture diagrams?',
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
