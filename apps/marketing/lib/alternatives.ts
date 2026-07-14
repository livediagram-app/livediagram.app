// Single source of truth for the comparison / "alternative" pages
// (see specs/21-comparison-pages.md). The dynamic route, its metadata,
// the index page, and the sitemap all derive from this list, so adding
// a competitor is a one-place change.
//
// Honesty rules (spec/21): every livediagram claim maps to a shipped
// feature; every competitor gets a real "where they're the better pick"
// section; competitor facts are qualitative (positioning, not volatile
// pricing/numbers); free + open-source competitors (Excalidraw, draw.io)
// are never implied to be paid or proprietary. The deep-dive `sections`
// and `faqs` follow the same rules: honest answers, including partial
// ones ("no direct importer, but...").

// Last-revised date for the comparison set, shared by `app/sitemap.ts`
// (drives `lastModified` for /alternatives + /alternatives/<slug>) and
// by the alternatives pages' `subpageMetadata({ modifiedTime })`
// (drives `article:modified_time` OG meta). Co-located with the
// ALTERNATIVES array so revising a competitor row + bumping the date
// lands in one diff. Bump this when adding a competitor or revising
// any row / claim / lede.
export const ALTERNATIVES_LAST_UPDATED = new Date('2026-07-14');

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
  // FAQPage JSON-LD (spec/21 "Metadata").
  faqs: Faq[];
};

export const ALTERNATIVES: Alternative[] = [
  {
    slug: 'miro',
    name: 'Miro',
    title: 'Miro alternative · livediagram',
    description:
      'An open-source, free Miro alternative: real-time multiplayer diagrams you can open without an account and host yourself.',
    h1: 'The open-source Miro alternative',
    lede: 'Miro is a powerful, sprawling online whiteboard. livediagram is a lighter, open-source take on the same idea: real-time multiplayer diagrams you can open in one click, with no sign-up, and run on your own account if you want to.',
    rows: [
      { label: 'Price', us: 'Free', them: 'Free tier, then paid plans' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary SaaS' },
      { label: 'Self-hostable', us: 'Yes, on your own Cloudflare account', them: 'No' },
      { label: 'Start without an account', us: 'Yes', them: 'Sign-up required' },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Import + export',
        us: 'Mermaid + Markdown in; PNG, SVG, PDF, Mermaid out',
        them: 'Broad import + export options',
      },
      {
        label: 'Programmatic access',
        us: 'REST API + MCP server for AI tools, free',
        them: 'Developer platform + marketplace',
      },
      {
        label: 'Focus',
        us: 'Structured diagrams + templates',
        them: 'Freeform whiteboard + workshops',
      },
    ],
    themBest: [
      'Facilitating very large workshops: breakout-scale sessions and a marketplace of meeting apps around the board.',
      'A deep template and integration marketplace (Jira, Slack, and more).',
      'Enterprise admin, SSO, and compliance at large scale.',
    ],
    usBest: [
      "It's free and MIT-licensed, so you can self-host it instead of paying per seat.",
      'Open a link and draw, with no sign-up wall in front of the canvas.',
      'Real-time multiplayer, live cursors and comments come standard, not gated behind a plan.',
      'Assign action items to teammates on the diagram itself, tracked in an Actions panel.',
      'Friction-free editing: tap once to add a shape, drag arrows that snap into place, and a format painter to copy a style across elements.',
      'Themed templates and one-click whole-canvas themes turn a blank board into a polished diagram fast.',
      'Walk a team through the board with the built-in present mode (laser pointer + spotlight), no export needed.',
      'Run a retro or planning session with the built-in per-tab timer and dot-voting, synced live to every participant.',
      'Import Mermaid or Markdown, export PNG, SVG, PDF, or Mermaid text.',
    ],
    sections: [
      {
        heading: 'Built for diagrams, not workshops',
        paragraphs: [
          'Miro grew into a workspace: boards, workshops, docs, video walkthroughs, and a marketplace of apps. That breadth is genuinely useful for facilitation-heavy teams, but if what you actually make is diagrams (architecture sketches, flowcharts, org charts, plans) most of it is surface area you scroll past. livediagram is deliberately narrower: a canvas where shapes, arrows, and structure are the whole product.',
          'That focus shows up in the details. Arrows stay attached to shapes and re-route themselves as you move things, with collision avoidance so lines stop overlapping. Alignment guides and snapping keep layouts tidy without manual nudging. A format painter copies a style across elements, and style presets keep a diagram consistent. Bigger work splits across tabs inside one diagram, tabs group into folders, and each tab has Photoshop-style layers for separating annotation from content.',
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
          'In Miro, collaborating starts with accounts: your teammates sign up, join a team, get assigned to boards. In livediagram, collaborating is a URL. Share a link and anyone who opens it is on the canvas with you, live cursors and all, without creating an account. Share links can carry a password or an expiry date when you need them locked down.',
          'The collaboration tools go beyond cursors: leave comments on elements, assign action items to teammates directly on the diagram (with an Actions panel to track them and optional email notifications), and review the change log to see who did what. Editing is protected by a selection lock, so two people never fight over the same element.',
        ],
      },
      {
        heading: 'Connected to the rest of your workflow',
        paragraphs: [
          'Diagrams rarely live alone. livediagram imports Mermaid flowcharts (the diagram-as-code format that lives in READMEs and AI output) and Markdown outlines, and exports PNG, SVG, PDF, Mermaid, or Markdown. Any share link can be embedded as a read-only, live-updating iframe in a wiki or doc.',
          'For programmatic use there is a free REST API with personal tokens, and an MCP server that lets AI assistants read and edit your diagrams directly. None of it sits behind a plan.',
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
        a: 'No. Share a link and anyone who opens it can edit in real time, with live cursors and comments, without signing up. Accounts are optional and mainly useful for syncing your diagrams across devices and using teams.',
      },
      {
        q: 'Can I import my existing Miro boards?',
        a: "There's no direct Miro importer. If your board is structured content (a flowchart, an org chart, a plan), the fastest path is to start from a livediagram template, or to import a Mermaid or Markdown version of the structure and let livediagram lay it out as a themed diagram.",
      },
      {
        q: 'Can livediagram run workshops the way Miro does?',
        a: 'Sessions like retros, brainstorms, and planning work well: every tab has a built-in facilitator-run timer and sticky-note dot-voting synced live to all participants, alongside comments, assigned actions, and the present mode. What livediagram does not have is Miro’s large-scale facilitation ecosystem (breakout-style sessions, estimation apps, a meeting-app marketplace), so for big multi-team workshops Miro is still the deeper toolkit.',
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
      'A free, browser-based, real-time XMind alternative for mind maps, plus flowcharts, kanban, timelines and more on one canvas.',
    h1: 'The collaborative, browser-based XMind alternative',
    lede: 'XMind is a polished app built around mind maps. livediagram runs in any browser, adds real-time collaboration, and handles mind maps alongside flowcharts, kanban boards, timelines and wireframes on the same canvas.',
    rows: [
      { label: 'Runs in', us: 'Any browser, nothing to install', them: 'Desktop + mobile apps' },
      { label: 'Real-time multiplayer', us: 'Yes, share a link', them: 'Limited' },
      { label: 'Price', us: 'Free', them: 'Free tier, subscription for full features' },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No' },
      {
        label: 'Import your maps',
        us: "Yes, via XMind's Markdown export",
        them: 'Native .xmind files',
      },
      {
        label: 'Export',
        us: 'PNG, SVG, PDF, Mermaid, Markdown, all free',
        them: 'Multiple formats',
      },
      {
        label: 'Beyond mind maps',
        us: 'Flowcharts, kanban, timelines, wireframes…',
        them: 'Mind-map focused',
      },
    ],
    themBest: [
      'Deep, keyboard-fast mind-map outlining and dedicated brainstorming modes.',
      'A refined native desktop experience with dedicated mobile apps.',
      "Pitch mode turns a map's branches into presentation slides.",
    ],
    usBest: [
      'Brainstorm together in real time, with live cursors and comments, not just on your own machine.',
      'More than mind maps: flowcharts, kanban, timelines, wireframes and charts on the same canvas.',
      'Nothing to install: open a link in any browser and start, no account needed.',
      'Bring existing maps across: export Markdown from XMind and import it as a themed diagram.',
      'Sketch freehand with the pencil and let shape-recognition tidy it into clean shapes.',
      'Themed templates and one-click canvas themes make a map look polished instantly.',
      'Free, open source, and self-hostable.',
    ],
    sections: [
      {
        heading: 'Mind maps that live in the browser',
        paragraphs: [
          "XMind's biggest constraint isn't the mapping, it's the install. Your map lives inside an app on one machine, and sharing it means exporting a file. livediagram is a URL: it opens on any machine with a browser, including locked-down work laptops where you can't install anything, and the map you make is instantly shareable as a link.",
          'That link is also how collaboration works. Send it to a teammate and you are both on the map at the same time, with live cursors showing who is where. Comments and assigned actions live on the elements themselves, so feedback lands where the idea is, not in a separate chat thread.',
        ],
      },
      {
        heading: 'Bring your existing maps with you',
        paragraphs: [
          "You don't have to start over. XMind exports maps as Markdown outlines, and livediagram imports Markdown directly: the outline becomes a real, themed node-and-link diagram on a new tab, laid out for you. Mermaid flowchart text imports the same way.",
          'Going the other direction is just as open: export any tab as PNG, SVG, or PDF for documents, or as Mermaid or Markdown text to keep the structure portable. Nothing about export sits behind a subscription.',
        ],
      },
      {
        heading: 'One canvas for everything after the brainstorm',
        paragraphs: [
          'A mind map is usually the start of something: the ideas become a plan, the plan becomes a flowchart or a kanban board. In XMind that next step happens in a different tool. In livediagram it happens on the next tab: one diagram holds the mind map, the flowchart, the timeline, and the wireframe side by side, with tabs grouped into folders and per-tab layers when things get big.',
          'Templates cover the common shapes of that follow-up work (flowcharts, kanban, retros, org charts, timelines and more), and one-click themes restyle the whole canvas so everything stays visually consistent as the project grows.',
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
        a: "livediagram is a browser app, and its opt-in Offline Mode can keep a diagram stored only in your browser, never sent to a server. But if fully offline desktop work is your main requirement, XMind's native apps are the stronger fit.",
      },
      {
        q: 'Is there a desktop or mobile app?',
        a: 'No. livediagram runs in any modern browser on desktop and works without an install. If you specifically want native desktop and mobile apps, XMind is the better pick there.',
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
      'A more structured Excalidraw alternative: the same free, open-source, no-sign-up spirit, with templates, themes, tabs and folders.',
    h1: 'A more structured Excalidraw alternative',
    lede: 'Excalidraw is a much-loved open-source whiteboard with a hand-drawn feel. livediagram shares the open-source, free, no-sign-up spirit, but leans structured: start from a template, theme the whole canvas, split work across tabs, and keep diagrams in folders.',
    rows: [
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'Yes, MIT-licensed' },
      { label: 'Price', us: 'Free', them: 'Free (paid hosted add-on available)' },
      { label: 'Start without an account', us: 'Yes', them: 'Yes' },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      { label: 'Visual style', us: 'Clean, themed shapes', them: 'Hand-drawn sketch look' },
      {
        label: 'Structure',
        us: 'Templates, tabs, folders, layers, themes',
        them: 'Freeform single canvas',
      },
      {
        label: 'Import + export',
        us: 'Mermaid + Markdown in; PNG, SVG, PDF, Mermaid out',
        them: 'PNG, SVG + .excalidraw files',
      },
    ],
    themBest: [
      'The signature hand-drawn aesthetic that made it famous.',
      'A huge community, shape libraries, and ecosystem.',
      'Dead-simple, single-canvas freeform sketching.',
    ],
    usBest: [
      'Start from a real template (flowchart, kanban, retro, org chart…) instead of a blank page.',
      'Keep a whole project together: several tabs in one diagram, organised in folders, with per-tab layers.',
      'Themes recolour the whole canvas, shapes and arrows, in one click.',
      'Prefer the sketchy look? A pencil tool with optional shape-recognition keeps that freehand feel.',
      'Built-in charts, an icon library, comments and a present mode, without add-ons.',
      'Smart alignment guides and snapping line everything up as you drag.',
      'Mermaid in and out: import flowchart text, export the diagram back to it.',
    ],
    sections: [
      {
        heading: 'The same spirit, more structure',
        paragraphs: [
          'livediagram and Excalidraw agree on the important things: MIT-licensed, free, and no sign-up wall in front of the canvas. Where they diverge is what happens after the first sketch. Excalidraw is one freeform board, and that simplicity is a feature. livediagram assumes the sketch is going to grow: you start from a real template instead of a blank page, split the work across tabs inside one diagram, group tabs into folders, and separate annotation from content with per-tab layers.',
          'Themes carry that structure visually. Instead of styling shapes one by one, a single click restyles the entire canvas (shapes, arrows, text), and style presets plus a format painter keep new elements consistent with the rest.',
        ],
      },
      {
        heading: 'Keep the sketch when you want it',
        paragraphs: [
          "The hand-drawn look is Excalidraw's signature, and if that aesthetic is the point, Excalidraw wins it outright. But sketching itself isn't exclusive to it: livediagram's pencil tool draws freehand, and its optional shape-recognition mode tidies a rough box or arrow into a clean element as you draw. You get the fast, thinking-with-your-hands feel while the result stays presentation-ready.",
        ],
      },
      {
        heading: 'A workspace, not just a canvas',
        paragraphs: [
          'Excalidraw deliberately stays a single board; anything around it (organising files, sharing workflows) is on you. livediagram ships the surrounding workspace: an explorer with folders and thumbnail previews, teams with shared libraries any member can manage, and share links that can carry a password or an expiry date.',
          'Collaboration is more than co-drawing, too: comments attach to elements, action items can be assigned to teammates and tracked in an Actions panel, and a change log records what happened while you were away.',
        ],
      },
      {
        heading: 'Diagrams as code, and AI',
        paragraphs: [
          'livediagram treats diagram text formats as first-class: Mermaid flowcharts import as real, editable diagrams and export back out, and Markdown outlines import as laid-out node-and-link maps. There is also a free REST API with personal tokens, and an MCP server that lets AI assistants read and edit diagrams directly.',
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
        a: "Partially. The pencil tool draws freehand, and shape-recognition can tidy sketches into clean shapes. But livediagram's shapes are clean and themed by design; if the signature sketchy aesthetic is what you want, Excalidraw is the better pick.",
      },
      {
        q: 'Can I import my Excalidraw files?',
        a: 'There is no .excalidraw importer. If the content is structured (a flowchart, a diagram with real connections), importing a Mermaid or Markdown version of it gets you a themed, laid-out livediagram version quickly.',
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
      'A modern, real-time draw.io (diagrams.net) alternative: live multiplayer diagrams with no setup, templates, and themes.',
    h1: 'The real-time draw.io alternative',
    lede: 'draw.io (diagrams.net) is a free, capable diagram editor with enormous shape libraries. livediagram trades that breadth for a modern, real-time multiplayer canvas you can open in one click, with templates and themes that make good-looking diagrams fast.',
    rows: [
      { label: 'Price', us: 'Free', them: 'Free' },
      { label: 'Real-time multiplayer', us: 'Yes, live cursors + presence', them: 'Limited' },
      { label: 'Start without an account', us: 'Yes', them: 'Yes' },
      {
        label: 'Shape libraries',
        us: 'Core shapes, device frames + technology icons',
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
        us: 'Collaborative diagrams + mindmaps',
        them: 'Formal / technical diagrams',
      },
    ],
    themBest: [
      'Specialist libraries: AWS/Azure, UML, network, BPMN, and more.',
      'Deep native integration with Confluence and Jira (livediagram embeds are a generic iframe).',
      'Highly precise, formal technical diagrams.',
    ],
    usBest: [
      'True real-time co-editing with live cursors and presence on every tab.',
      'A modern, fast canvas with nothing to set up: open a link and go.',
      'Templates and themes for good-looking diagrams in minutes, not blank-canvas fiddling.',
      'Diagrams stay tidy on their own: arrows re-route as shapes move, with collision avoidance, alignment guides and snapping.',
      'Full-colour technology icons (AWS, Azure, Kubernetes, databases…) for architecture diagrams.',
      'Charts, icons, freehand sketching, comments and a present mode, all built in.',
      'Free, MIT-licensed, and self-hostable on your own Cloudflare account.',
    ],
    sections: [
      {
        heading: 'Real-time by default',
        paragraphs: [
          'draw.io is at heart a single-player editor: powerful, but built around a file that one person edits and saves. Working together usually means passing the file through Google Drive or a Confluence page. livediagram is multiplayer from the ground up: share a link and everyone is on the same canvas at once, with live cursors, presence, and a selection lock so nobody overwrites anyone else mid-edit.',
          'The collaboration layer goes further than co-editing: comments attach to elements, action items can be assigned to a teammate (with an Actions panel and optional email notification), and a change log keeps the history of who changed what.',
        ],
      },
      {
        heading: 'From blank page to presentable, fast',
        paragraphs: [
          'draw.io gives you enormous power and expects you to wield it: picking stencils, styling shapes, routing lines. livediagram optimises the first ten minutes instead. Templates give you a real starting structure (flowchart, kanban, org chart, timeline and more), one-click themes style the whole canvas at once, and the diagram maintains itself as you work: arrows re-route around shapes and avoid colliding with each other, and alignment guides snap things into place.',
          'For architecture diagrams specifically, a Technology palette ships full-colour brand icons for the services people actually draw: AWS, Azure, Kubernetes, databases and more, no library hunting required.',
        ],
      },
      {
        heading: 'Sharing that fits the web',
        paragraphs: [
          'A livediagram diagram is a URL, not a file. Share links open instantly for anyone, need no account, and can be protected with a password or an expiry date. Any share link also embeds as a read-only iframe that live-updates in your wiki or docs as the diagram changes, so embedded copies never go stale.',
          'When you do need a file, any tab exports as PNG, SVG, or PDF, and the explorer shows thumbnail previews so you can find the right diagram at a glance.',
        ],
      },
      {
        heading: 'Diagram-as-code, both directions',
        paragraphs: [
          'If you keep diagrams next to code, livediagram round-trips Mermaid: paste flowchart text (from a README, an issue, or an AI assistant) and it becomes a real, editable, themed diagram; export turns the diagram back into Mermaid. Markdown outlines import too. And for automation there is a free REST API with personal tokens plus an MCP server for AI tools.',
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
        a: 'No, there is no .drawio/.xml importer. Mermaid flowcharts do round-trip: if you can express the diagram as Mermaid text (or have an AI assistant do it), livediagram imports it as a fully editable, themed diagram.',
      },
      {
        q: 'Does livediagram have AWS, UML, or network shape libraries?',
        a: "It ships full-colour technology icons (AWS, Azure, Kubernetes, databases and more) that cover most architecture diagrams, plus core shapes and device frames. It does not have draw.io's formal notation libraries (UML, BPMN, network stencils); for strict formal notation, draw.io is the better pick.",
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
      "Diagrams in Google Slides are fiddly: connectors don't route and there are no templates. livediagram is a canvas built for diagrams.",
    h1: 'A canvas built for diagrams, not slides',
    lede: "Plenty of people draw diagrams in Google Slides because it's already open. But Slides is a presentation tool: connectors don't route themselves, there are no diagram templates, and the canvas is a fixed slide. livediagram is purpose-built for diagrams.",
    rows: [
      { label: 'Built for diagrams', us: 'Yes', them: 'No, it is for presentations' },
      { label: 'Arrows track shapes', us: 'Yes, they re-route as you move', them: 'Manual lines' },
      { label: 'Diagram templates', us: 'Flowchart, mind map, kanban…', them: 'None' },
      { label: 'Canvas', us: 'Infinite and pannable', them: 'Fixed slide size' },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Get it into a deck',
        us: 'Export PNG, SVG or PDF',
        them: 'Already a slide',
      },
      { label: 'Price', us: 'Free, open source', them: 'Free with a Google account' },
    ],
    themBest: [
      "You're already building a slide deck and just need a quick diagram inside it.",
      'Everyone in your org already lives in Google Workspace.',
      'You want the diagram living on a slide inside the deck itself (livediagram embeds target wikis and docs, not slide decks).',
    ],
    usBest: [
      'Arrows that stay connected to shapes and re-route as you move them.',
      'Start from a diagram template (flowchart, mind map, kanban…) instead of an empty slide.',
      'An infinite, pannable canvas instead of a fixed slide, with a minimap to navigate big ones.',
      'Diagram-native tools: smart snapping, a format painter, quick-connect arrows, charts and icons.',
      'Real-time multiplayer with live cursors and comments, plus a present mode to walk through it.',
      'Free and open source, with no Google account required to start.',
    ],
    sections: [
      {
        heading: 'Connectors that actually connect',
        paragraphs: [
          "The moment a Slides diagram grows past a few boxes, the lines betray you: they don't follow shapes you move, they cross each other, and every layout tweak means redrawing arrows by hand. In livediagram, arrows are attached to the shapes they connect. Move a box and its arrows follow, re-routing around obstacles and avoiding collisions with other lines. Curved and elbowed arrows have draggable handles when you want manual control, and alignment guides plus snapping keep the whole layout square.",
        ],
      },
      {
        heading: 'Start from a diagram, not a blank slide',
        paragraphs: [
          'Slides has slide templates; it has no idea what a flowchart is. livediagram starts you from real diagram templates (flowcharts, mind maps, kanban boards, org charts, timelines and more) and themes the whole canvas in one click, so the result looks deliberate without manual styling.',
          'The palette is diagram-native too: an icon library, full-colour technology icons for architecture diagrams, charts, freehand pencil sketching with shape recognition, and device frames for wireframes. And the canvas is infinite and pannable, with a minimap for navigating big diagrams, instead of a fixed 16:9 rectangle.',
        ],
      },
      {
        heading: 'Sharing and presenting stay easy',
        paragraphs: [
          "The reason people reach for Slides is that sharing is effortless, and livediagram keeps that: share a link and anyone can view or edit in real time, no account needed, not even a Google one. Comments and live cursors work like you'd expect.",
          'When it is time to present, a built-in present mode walks a call through the diagram with a laser pointer and spotlight. And if the diagram ultimately belongs in a deck, export it as PNG, SVG, or PDF and drop it onto the slide; for wikis and docs, a share link embeds as a live-updating read-only iframe instead.',
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
        a: 'No, and it does not try to. It has a present mode for walking people through a diagram (with a laser pointer and spotlight), but it is not a slide-deck tool. If you are building a deck, build it in Slides and export your diagrams into it.',
      },
      {
        q: 'Is livediagram free?',
        a: 'Yes. It is MIT-licensed open source with a free hosted version, every feature included, and no paid tier. You can even use it without creating an account at all.',
      },
    ],
  },
];

export const ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
