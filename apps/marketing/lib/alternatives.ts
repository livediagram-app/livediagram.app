// Single source of truth for the comparison / "alternative" pages
// (see specs/21-comparison-pages.md). The dynamic route, its metadata,
// the index page, and the sitemap all derive from this list, so adding
// a competitor is a one-place change.
//
// Honesty rules (spec/21): every livediagram claim maps to a shipped
// feature; every competitor gets a real "where they're the better pick"
// section; competitor facts are qualitative (positioning, not volatile
// pricing/numbers); free + open-source competitors (Excalidraw, draw.io)
// are never implied to be paid or proprietary.

export type ComparisonRow = {
  label: string;
  // Short, factual cell text. `us` = livediagram, `them` = competitor.
  us: string;
  them: string;
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
        label: 'Focus',
        us: 'Structured diagrams + templates',
        them: 'Freeform whiteboard + workshops',
      },
    ],
    themBest: [
      'Big facilitated workshops: sticky-note voting, timers, and meeting tooling.',
      'A deep template and integration marketplace (Jira, Slack, and more).',
      'Enterprise admin, SSO, and compliance at large scale.',
    ],
    usBest: [
      "It's free and MIT-licensed, so you can self-host it instead of paying per seat.",
      'Open a link and draw, with no sign-up wall in front of the canvas.',
      'Real-time multiplayer comes standard, not gated behind a plan.',
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
        label: 'Beyond mind maps',
        us: 'Flowcharts, kanban, timelines, wireframes…',
        them: 'Mind-map focused',
      },
    ],
    themBest: [
      'Deep, keyboard-fast mind-map outlining and dedicated brainstorming modes.',
      'A refined native desktop experience, including offline use.',
      'A built-in presentation mode for walking through a single map.',
    ],
    usBest: [
      'Brainstorm together in real time, not just on your own machine.',
      'More than mind maps: switch to a flowchart, kanban or timeline on the same canvas.',
      'Free, open source, and self-hostable.',
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
        us: 'Templates, tabs, folders, themes',
        them: 'Freeform single canvas',
      },
    ],
    themBest: [
      'The signature hand-drawn aesthetic that made it famous.',
      'A huge community, shape libraries, and ecosystem.',
      'Dead-simple, single-canvas freeform sketching.',
    ],
    usBest: [
      'Start from a real template (flowchart, kanban, retro, org chart…) instead of a blank page.',
      'Organise many diagrams in folders, synced to a free account.',
      'Themes that recolour the whole canvas, shapes and arrows in one click.',
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
        us: 'Core shapes + device frames',
        them: 'Vast (AWS, UML, network…)',
      },
      {
        label: 'Best for',
        us: 'Collaborative diagrams + mindmaps',
        them: 'Formal / technical diagrams',
      },
    ],
    themBest: [
      'Specialist libraries: AWS/Azure, UML, network, BPMN, and more.',
      'Deep embedding in Confluence and Jira.',
      'Highly precise, formal technical diagrams.',
    ],
    usBest: [
      'True real-time co-editing with live cursors and presence on every tab.',
      'A modern, fast canvas with nothing to set up.',
      'Templates and themes for good-looking diagrams in minutes.',
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
      { label: 'Price', us: 'Free, open source', them: 'Free with a Google account' },
    ],
    themBest: [
      "You're already building a slide deck and just need a quick diagram inside it.",
      'Everyone in your org already lives in Google Workspace.',
      'You want the diagram embedded in a presentation, not a standalone canvas.',
    ],
    usBest: [
      'Arrows that stay connected to shapes and re-route as you move them.',
      'Start from a diagram template instead of an empty slide.',
      'An infinite canvas instead of a fixed-size slide.',
    ],
  },
];

export const ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
