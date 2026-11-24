import type { Alternative } from '@liveworkspace/comparisons';

// livediagram's comparisons with the diagramming tools (draw.io, FigJam, Lucidchart), the end of
// ./alternatives' list, kept apart so neither file grows past the repo's size cap.
export const DIAGRAMMING_ALTERNATIVES: Alternative[] = [
  {
    slug: 'drawio',
    name: 'draw.io',
    highlights: ['Real-time by default', 'Imports .drawio', 'One-click themes'],
    title: 'draw.io alternative · livediagram',
    description:
      'A modern, real-time draw.io (diagrams.net) alternative: live multiplayer diagrams with no setup, templates, themes, and a direct .drawio import.',
    h1: 'The real-time draw.io alternative',
    lede: 'draw.io (diagrams.net) is a free, capable diagram editor with enormous shape libraries. livediagram trades that breadth for a modern, multiplayer canvas you can open in one click, with templates and themes that make good-looking diagrams fast.',
    rows: [
      { label: 'Price', us: 'Free', them: 'Free' },
      {
        label: 'Real-time multiplayer',
        us: 'Yes, on every canvas, live cursors + presence',
        them: 'Yes, when the file lives in Google Drive, OneDrive, Confluence or Nextcloud',
      },
      { label: 'Start without an account', us: 'Yes', them: 'Yes' },
      {
        label: 'Shape libraries',
        us: 'Core shapes, BPMN, C4, device frames, technology icons + your own imported libraries',
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
      'Specialist libraries: AWS/Azure, full UML, network, and more.',
      'Deep native integration with Confluence and Jira (livediagram embeds are a generic iframe).',
      'Highly precise, formal technical diagrams.',
      'Files you keep in your own storage, with desktop apps for working entirely offline.',
    ],
    usBest: [
      'Real-time co-editing with live cursors and presence on every canvas, wherever it is stored.',
      'A modern, fast canvas with nothing to set up: open a link and go.',
      '91 templates and 25 themes for good-looking diagrams in minutes, not blank-canvas fiddling.',
      'Diagrams stay tidy on their own: arrows re-route as shapes move, with collision avoidance, alignment guides and snapping.',
      'Full-colour technology icons (AWS, Azure, Kubernetes, databases…) for architecture diagrams.',
      'BPMN for business processes: events, tasks, gateways, data and pools, and draw.io’s BPMN shapes import as editable BPMN.',
      'Tidy Up lays out a tangle of shapes and arrows as a flowchart, tree or mind map, and the UML theme colours each shape by its meaning.',
      'The C4 model at three levels: Context, Container and Component tabs link level to level, and C4 tiles keep their colours under every theme.',
      'Architecture diagrams that stay current: bind a shape to a public status URL and it shows the service as Up, Degraded or Down, or draw the diagram from your wrangler.toml, Docker Compose, Terraform and Kubernetes files and update it when they change.',
      'Diagrams kept in a repository get before and after pictures of each changed tab on a pull request, from one GitHub workflow.',
      'Four finishes per tab: Professional for crisp, print-ready diagrams with square corners and thin lines, Sketch or Marker for a hand-drawn review, switched without touching the diagram.',
      'Database schemas with keys and field-to-field relationships, sequence diagrams, Sankey flows, and an Isometric view that tilts an architecture diagram into 3D blocks for a deck.',
      'Bring your diagrams with you: .drawio files import page by page, whole folders import as canvases, and draw.io libraries become shape libraries.',
      'Charts, icons, freehand sketching, comments and a slide-deck Presentation mode, all built in.',
      'Free and MIT-licensed, with every feature on the free plan.',
    ],
    sections: [
      {
        heading: 'Real-time by default',
        paragraphs: [
          'draw.io is built around a diagram file. It does support real-time co-editing, with shared cursors, when that file lives in Google Drive, OneDrive, Confluence Cloud or Nextcloud; otherwise working together means passing the file around. livediagram is multiplayer on every canvas from the ground up: share a link and everyone is on the same canvas at once, with live cursors, presence, and a selection lock that shows when someone is already editing an element.',
          'The collaboration layer goes further than co-editing: comments attach to elements, action items can be assigned to a teammate (tracked in the Collaborate panel, with optional email notification), and a facilitator can run a shared timer, dot-voting and live polls when a diagram review turns into a workshop.',
        ],
      },
      {
        heading: 'From blank page to presentable, fast',
        paragraphs: [
          'draw.io gives you enormous power and expects you to wield it: picking stencils, styling shapes, routing lines. livediagram optimises the first ten minutes instead. Templates give you a real starting structure (flowchart, mind map, org chart, timeline, ER and sequence diagrams and more), one-click themes style the whole canvas at once, and the diagram maintains itself as you work: arrows re-route around shapes and avoid colliding with each other, and alignment guides snap things into place.',
          'For architecture diagrams specifically, a Technology palette ships full-colour brand icons for the services people actually draw: AWS, Azure, Kubernetes, databases and more, no library hunting required. The Professional finish draws the whole tab crisp and print-ready (square corners, thin lines, no default shadows), and the Isometric view tilts it into raised 3D blocks for a slide or a screenshot.',
        ],
      },
      {
        heading: 'Sharing that fits the web',
        paragraphs: [
          'A livediagram canvas is a URL, not a file. Share links open instantly for anyone, need no account, and can be protected with a password or an expiry date. Any share link also embeds as an iframe that live-updates in your wiki or docs as the diagram changes, so embedded copies never go stale: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'When you do need a file, any tab exports as PNG, SVG, PDF or a portable JSON file, the explorer shows thumbnail previews so you can find the right canvas at a glance, and signed-in users can mirror their canvases to their own Google Drive.',
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
        a: 'Yes. Both are free, and both are open source. livediagram is MIT-licensed with a free hosted version at livediagram.app where every feature works.',
      },
      {
        q: 'Can I import my .drawio files?',
        a: 'Yes. Import a .drawio or .xml file, a Google Drive save without an extension, or a PNG or SVG exported from draw.io with the diagram included, and each page becomes a tab: shapes, text, colours, connections, swimlanes, class boxes, tables and layers come across. From the Explorer you can import many files or a whole folder as new canvases, and draw.io libraries become shape libraries you place from the palette. Vendor stencils map to matching technology icons where there is a clear match; anything without a match comes in as a labelled box, and the import tells you exactly what changed on the way in.',
      },
      {
        q: 'Does livediagram have AWS, UML, or network shape libraries?',
        a: "It ships full-colour technology icons (AWS, Azure, Kubernetes, databases and more) that cover most architecture diagrams, plus core shapes, device frames, BPMN events, tasks, gateways and pools, and class, sequence and state machine templates. It does not have draw.io's full UML or network stencil libraries; for those, draw.io is the better pick.",
      },
    ],
  },
  {
    slug: 'figjam',
    name: 'FigJam',
    highlights: ['No seats needed', 'No sign-up', 'API and MCP'],
    title: 'FigJam alternative · livediagram',
    description:
      'A free, open-source FigJam alternative: a real-time whiteboard with workshop tools, no account needed, 91 templates, Mermaid, an API and an MCP server.',
    h1: 'The free, open-source FigJam alternative',
    lede: 'FigJam is a polished, playful whiteboard that lives inside Figma. livediagram covers the same ground, brainstorms, workshops and diagrams with your team in real time, as free, open-source software that anyone can open from a link, no account or Figma seat needed.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature (a few limits rise on paid plans)',
        them: 'Free Starter plan with limits, then paid Figma seats',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create files',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Focus',
        us: 'Whiteboards and workshops, plus diagrams and timelines',
        them: 'Whiteboarding for teams that design in Figma',
      },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Visio, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out',
        them: 'Its own files; image and PDF export',
      },
      {
        label: 'Programmatic access',
        us: 'REST API and an MCP server for AI tools, both free',
        them: 'A plugin and widget platform, the Figma API and an MCP server',
      },
    ],
    themBest: [
      'Your team designs in Figma, and you want boards that sit beside your design files and copy across into them.',
      'A playful, polished feel: stamps, stickers, emotes, cursor chat and widgets.',
      'A large community of plugins, widgets and templates.',
      'FigJam AI, for generating boards, sorting and summarising sticky notes.',
    ],
    usBest: [
      'Free with no file limits and no seats needed: every feature works on the free plan.',
      'Open a link and start, no account needed, even to create a canvas.',
      'Structured diagrams that stay tidy: shapes and arrows that stay attached, alignment guides, 25 one-click themes and 91 templates.',
      'Three ways to work one tab: Diagram for structure, Draw for freehand whiteboarding, and Workshop for running a session with your team.',
      'Diagrams with a whiteboard feel: the Sketch and Marker finishes draw any tab by hand, and ready-made looks set theme, finish, font and pattern in one click.',
      'Point the room at one thing: Bring Focus offers everyone a jump to it rather than dragging them there, and anyone can follow a teammate’s view, even on a view-only link.',
      'Workshop tools built in: Workshop mode, a facilitator role, a shared timer, dot-voting, live polls, planning-poker estimate cards, temperature checks, quizzes, an anonymous idea box and a Q&A board.',
      'Participant links: the room adds stickies, writes and votes, and nobody can reshape the board by accident.',
      'Run the meeting on the board: an agenda that starts the timer for each segment, a roll call, a random picker and decision records, plus around 190 emoji stickers and 32 word badges.',
      'Record a walkthrough, your voice, an optional camera bubble and every pan and zoom, and the team replays it over the live board when it suits them.',
      'Diagrams as code: Mermaid flowcharts import as editable diagrams and export back out.',
      'Ask AI answers questions about a board from its own words, with sources, on built-in AI (a daily allowance) or your own key.',
      'A free REST API and an MCP server, so scripts and AI assistants can read and edit your canvases.',
      'MIT-licensed, with portable exports, so your boards never depend on one vendor.',
    ],
    sections: [
      {
        heading: 'A whiteboard without the seat',
        paragraphs: [
          'FigJam is part of Figma, and that is its great strength for design teams: boards and design files share one home. For everyone else, it means accounts, a free plan with limits on shared files, and paid seats as the team grows. livediagram needs none of that. Anyone can open the editor and create a canvas without signing up, share a link, and work together in real time; a guest’s canvas stays in their browser until they press Share, which syncs it in one step. Every feature works on the free plan.',
        ],
      },
      {
        heading: 'A whiteboard that keeps going',
        paragraphs: [
          'FigJam is excellent for loose, freeform boards. livediagram’s Draw mode is a plain whiteboard too, with pressure-sensitive markers, sticky notes, text and shapes, but the same canvas carries on after the brainstorm. Switch a tab to Diagram when a sketch needs structure, with arrows that stay attached, themes that restyle the whole canvas in one click and a Marker or Sketch finish that keeps it looking hand-drawn; to Workshop when the room needs a timer, votes and polls to decide what happens next.',
          'Start from one of 91 templates, from retrospectives and story maps to flowcharts and system architecture, and split larger work across tabs, folders and layers.',
        ],
      },
      {
        heading: 'Workshops built in',
        paragraphs: [
          'Running a session needs more than sticky notes. livediagram gives sessions a mode of their own, Workshop, and one person the facilitator role, and with it a shared timer, dot-voting, live polls, a Q&A board and responses kept hidden until the reveal. Estimate cards run planning poker, a temperature check shows how the room feels, a quiz asks what it knows, and an idea box collects anonymous ideas until the reveal. There are templates for retrospectives in five formats, Lean Coffee, town hall Q&A and event storming, and comments and assigned actions keep the follow-ups with the board.',
        ],
      },
      {
        heading: 'Open at the edges',
        paragraphs: [
          'livediagram imports Mermaid, Markdown, Excalidraw, draw.io and Microsoft Whiteboard boards, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or portable JSON. Any share link embeds as a live-updating iframe in a wiki or doc: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'For automation there is a free REST API with personal tokens and an MCP server that lets AI assistants read and edit your canvases directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram really free compared with FigJam?',
        a: 'Yes. Every feature works on the free plan, with no file limits and no seats needed to edit. The code is MIT-licensed.',
      },
      {
        q: 'Can I import my FigJam boards?',
        a: 'Not directly: there is no FigJam importer. You can bring a board across as a picture by exporting it from FigJam as a PNG and adding it to a tab as an image. For new work, start from one of the 91 templates.',
      },
      {
        q: 'Does livediagram work with Figma?',
        a: 'Partly. A Figma file, prototype or board link sits on the canvas as a live embed, but nothing syncs or imports between the two. If your boards need to live beside your Figma design files, FigJam is the better pick. livediagram exports SVG and PNG if you want to bring a diagram into a design.',
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
    highlights: ['No document limits', 'No sign-up', 'Open source'],
    title: 'Lucidchart alternative · livediagram',
    description:
      'A free, open-source Lucidchart alternative: real-time diagrams with no document or shape limits, no account needed, Mermaid, an API and MCP.',
    h1: 'The free Lucidchart alternative, with no document limits',
    lede: 'Lucidchart is a mature, professional diagramming tool, with a free plan that limits how many documents and shapes you can make. livediagram is free and open source with no such limits: real-time flowcharts, org charts and architecture diagrams that anyone can open from a link, no account needed.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature (a few limits rise on paid plans)',
        them: 'Free plan with document and shape limits, then paid plans',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create documents',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Shape libraries',
        us: 'Core shapes, technology and line-art icons, UML, BPMN, C4 and charts',
        them: 'Very broad professional libraries (UML, network, cloud, and more)',
      },
      {
        label: 'Import + export',
        us: 'Visio (Lucidchart exports it too), draw.io, BPMN, Excalidraw, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out',
        them: 'Visio, draw.io, Gliffy and Mermaid in; image, PDF and Visio out',
      },
      {
        label: 'Programmatic access',
        us: 'REST API and an MCP server for AI tools, both free',
        them: 'Developer platform, integrations and an MCP server',
      },
    ],
    themBest: [
      'Formal diagramming at scale: very broad shape libraries for UML, network and cloud architecture.',
      'Data linking, which builds or updates diagrams from spreadsheets and other sources.',
      'Visio export, and deep integrations with enterprise suites.',
      'Enterprise admin, security and compliance controls.',
    ],
    usBest: [
      'Free with no plan limits on documents or shapes, and every feature on the free plan.',
      'Open a link and start, no account needed, even to create a canvas.',
      '91 templates, from flowcharts, org charts and swimlanes to system and cloud architecture, database schemas and sequence, class and state diagrams.',
      'Real-time multiplayer with live cursors, comments, assigned actions and a laser pointer for presenting.',
      '25 one-click themes restyle the whole canvas, shapes and arrows, and the Professional finish draws it crisp and print-ready: square corners, thin lines, Inter lettering, no default shadows.',
      'Mermaid in and out: flowcharts import as editable diagrams and export back to text.',
      'BPMN for business processes: events, tasks, gateways, data, pools and message flows, and .bpmn files from Camunda or bpmn.io import with their layout.',
      'Diagrams that tidy themselves: a new arrow curves around shapes in its way, Tidy Up lays a graph out as a flowchart or tree, and the UML theme colours each shape by its meaning.',
      'Database schemas with keys and field-to-field relationships, Sankey flows, and an Isometric view that tilts an architecture diagram into 3D blocks.',
      'The C4 model at three levels, Context, Container and Component, each tab linked to the next.',
      'Live service status on an architecture diagram: bind a shape to a public status URL and it shows Up, Degraded or Down, with no cloud account to connect.',
      'Draw an architecture diagram from wrangler.toml, Docker Compose, Terraform and Kubernetes files, update it when they change, and see before and after pictures of a changed diagram on each pull request.',
      'A free REST API and an MCP server, so scripts and AI assistants can read and edit your canvases.',
      'MIT-licensed, with portable exports, so your diagrams never depend on one vendor.',
    ],
    sections: [
      {
        heading: 'Free without the caps',
        paragraphs: [
          'Lucidchart’s free plan is a real way to try it, but it caps how many documents you can edit and how many shapes each one holds, so a growing diagram soon meets a paywall. livediagram caps documents and shapes on no plan: there is no document or shape count to ration, and every feature works on the free plan. You do not even need an account to start.',
        ],
      },
      {
        heading: 'The diagrams you need, ready to go',
        paragraphs: [
          'livediagram ships 91 templates, including flowcharts in four styles, swimlanes, org charts, mind maps, data-flow diagrams, system and cloud architecture, database schemas, Sankey flows, and sequence, class and state diagrams. Shapes and arrows stay attached and re-route as you move things, alignment guides and snapping keep layouts tidy, and themes restyle the whole canvas in one click. A finish sets how it is drawn: Professional for crisp, print-ready work, or Sketch and Marker when a review should feel like a whiteboard.',
          'Bigger work splits across tabs inside one canvas, grouped into folders, with Photoshop-style layers on each tab. Presentation mode turns elements from any tab into a slide deck, so you can walk a room through a diagram without exporting it.',
        ],
      },
      {
        heading: 'Where Lucidchart goes further',
        paragraphs: [
          'Lucidchart has spent years on formal notation, and it shows: its libraries for network diagrams and cloud providers are far broader than ours, it can generate diagrams from data, it reads and writes Visio files, and it imports draw.io, Gliffy and Mermaid too. If your work depends on those, Lucidchart is the better tool. livediagram aims at the everyday diagrams most teams draw, and makes them free, fast and collaborative.',
        ],
      },
      {
        heading: 'Open at the edges',
        paragraphs: [
          'livediagram imports Visio, draw.io, BPMN, Excalidraw, Microsoft Whiteboard, Mermaid and Markdown, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or portable JSON. Any share link embeds as a live-updating iframe in Confluence, Notion or any page that allows iframes: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'For automation there is a free REST API with personal tokens and an MCP server that lets AI assistants read and edit your canvases directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram a free alternative to Lucidchart?',
        a: 'Yes. Every feature works on the free plan, with no plan limits on documents or shapes and no seats needed to edit. The code is MIT-licensed.',
      },
      {
        q: 'Can I import my Lucidchart diagrams?',
        a: 'Yes, through Visio. In Lucidchart choose File, Export, Visio (VSDX), then import that file into a tab with the Visio format, or many files at once from the Explorer. Pages become tabs, connections stay attached, and common flowchart and basic shapes come in as livediagram shapes; shapes from other libraries come in as text boxes with their words, so nothing you wrote is lost. The import report says what changed on the way.',
      },
      {
        q: 'Does livediagram support UML and architecture diagrams?',
        a: 'Yes, for the common cases: there are templates for class, sequence and state diagrams, database schemas, data flow, and system and cloud architecture, plus BPMN elements with a .bpmn import and a technology icon library. Full network and cloud-provider shape libraries remain Lucidchart’s strength.',
      },
      {
        q: 'Can my team collaborate without accounts?',
        a: 'Yes. Share an editor link and anyone who opens it is on the canvas with you, live cursors and all, without signing up. Signing in is optional and adds teams with shared canvas libraries.',
      },
    ],
  },
];
