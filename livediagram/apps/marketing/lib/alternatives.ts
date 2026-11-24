import type { Alternative, Comparisons } from '@liveworkspace/comparisons';
import { SITE_URL } from '@livediagram/ui';
import { DIAGRAMMING_ALTERNATIVES } from './alternatives-diagramming';

// livediagram's comparisons, drawn by @liveworkspace/comparisons (packages/comparisons/README.md
// "livediagram"). The hub, every page, their metadata and the sitemap read this list, so adding a
// competitor is a one-place change. Bump the date with any change to them.
const UPDATED = new Date('2026-11-24');

const LIST: Alternative[] = [
  {
    slug: 'microsoft-whiteboard',
    name: 'Microsoft Whiteboard',
    highlights: ['Imports your boards', 'No Microsoft account', 'Pressure-sensitive ink'],
    title: 'Microsoft Whiteboard alternative · livediagram',
    description:
      'A free, open-source Microsoft Whiteboard alternative: pressure-sensitive ink, no Microsoft account, and an import that keeps your boards editable.',
    h1: 'The open-source Microsoft Whiteboard alternative',
    lede: 'Microsoft has retired Whiteboard for personal accounts: boards became read-only in September 2026, and on 16 October 2026 the remaining legacy boards were deleted and the standalone apps retired. livediagram is a free, open-source home for that work: a real-time whiteboard with pressure-sensitive ink, no Microsoft account needed, and an import that brings your boards across with every stroke still editable.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature (a few limits rise on paid plans)',
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
        them: 'Pen inking in Teams and on the web; the Windows app retired',
      },
      {
        label: 'Beyond the whiteboard',
        us: 'Structured diagrams, templates, tabs and folders, Presentation mode',
        them: 'A freeform board inside the Microsoft 365 suite',
      },
    ],
    themBest: [
      'Your organisation already runs on Microsoft 365, and you want whiteboards inside Teams meetings.',
      'Admin control, compliance and data residency handled by your existing Microsoft tenant.',
      'Pen inking inside Teams meetings, which Whiteboard is built around.',
    ],
    usBest: [
      'Your boards outlive the retirement: import a board export and each board becomes a canvas of its own, named and dated as the board, with pen strokes, colours, sticky notes, text, shapes and images all editable.',
      'No Microsoft account, no sign-up, no install: open a link and start drawing.',
      'Draw mode is a plain whiteboard: three pressure-sensitive markers, text, an eraser and shapes on a plain, dotted or grid board, light or dark.',
      'Real-time multiplayer with live cursors, comments and a laser pointer, for anyone with the link.',
      'Three kinds of link: Editor, Participant (add stickies, write and vote without reshaping the board, handy for a class) or view-only.',
      'For a class: quizzes with a countdown and a reveal of who got it right, live polls, an anonymous idea box and a shared timer.',
      'Run the lesson on the board: an agenda that starts the timer for each segment, a roll call, and a picker that chooses someone at random so nobody has to volunteer.',
      'Around 190 emoji stickers and 32 word badges like APPROVED and WIP, for reacting to work and marking it.',
      'Record a walkthrough of the board, your voice and every pan and zoom, so a student who missed the lesson can replay it over the live board.',
      'Switch the same tab to Diagram mode when a sketch needs to become a tidy flowchart, org chart or plan, and draw it in the Marker finish so it still looks like it came off the whiteboard.',
      '91 templates, including retrospectives, Lean Coffee, town hall Q&A and event storming boards.',
      'Free and MIT-licensed, with every board exportable, so no future retirement can take your boards away.',
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
          'Whiteboard’s own exports are a flat picture: nothing in them stays editable. livediagram imports a board export instead, the folder of the board’s own edit history, and replays it, so every stroke comes back as data. Each board becomes its own canvas with one whiteboard tab, named after the board and dated as the board, so your library keeps its history.',
          'Pen strokes keep their pressure, so thick and thin stay as you drew them. Black ink on a light board, or white ink on a dark one, becomes the whiteboard’s own ink, so it reads in light and dark. Highlighter stays highlighter, and sticky notes, text, shapes and images keep their place. The board is read in your browser, and the import needs no Microsoft account. When it finishes, it says what changed on the way, such as rainbow ink drawn in pink.',
        ],
      },
      {
        heading: 'A whiteboard that grows into more',
        paragraphs: [
          'Draw mode is a plain whiteboard, close to what Whiteboard users are used to: pick a marker, draw, erase, add text and shapes. But the same tab can switch to Diagram mode when a sketch needs structure, with shapes and arrows that stay attached as you move things, and the Marker or Sketch finish keeps that structure looking hand-drawn. A canvas holds as many tabs as you need, grouped into folders, and Presentation mode turns elements from any tab into a slide deck.',
          'For sessions, switch a tab to Workshop, the mode for running a room: there are templates for retrospectives, Lean Coffee and town hall Q&A, and a facilitator can run a shared timer, votes, polls and quizzes for the room, with the right answer revealed when the time is up.',
        ],
      },
      {
        heading: 'Free, open, and yours to keep',
        paragraphs: [
          'A retirement like this is a reminder of what it means to rely on someone else’s product. livediagram is MIT-licensed and its whole codebase is public. Every feature works on its free plan, and your canvases export to portable formats, so you are never locked in.',
          'You can also keep a canvas entirely in your browser with Offline Mode, or, once signed in, mirror your canvases to your own Google Drive.',
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
        a: 'Yes, from a board export: the folder of a board’s edit history, as the Whiteboard web app syncs it. Import one board, a folder of many boards, or a .zip of either from the Explorer, and each board becomes its own canvas with editable ink, sticky notes, text, shapes and images. For a personal account, that means a board export saved before the 16 October 2026 deletion. Whiteboard’s own picture exports are not editable; you can still add one to a tab as an image.',
      },
      {
        q: 'Do I need a Microsoft account to use livediagram?',
        a: 'No. livediagram needs no account at all: open the editor and start drawing. Signing in, with email or Google, is optional and keeps your canvases with you across devices.',
      },
      {
        q: 'Does livediagram work with a pen or stylus?',
        a: 'Yes. Draw mode has three pressure-sensitive markers, so a pen on a tablet or touchscreen draws thick and thin lines as you press. It runs in the browser, so there is nothing to install on any device.',
      },
      {
        q: 'When should I stay with Microsoft Whiteboard?',
        a: 'If you have a work or school account and your team lives in Teams, Whiteboard stays available there and fits naturally into your meetings and your organisation’s admin controls. livediagram suits personal use, mixed teams without a shared Microsoft tenant, and anyone who wants their boards in free, open-source software.',
      },
    ],
  },
  {
    slug: 'miro',
    name: 'Miro',
    highlights: ['No feature gating', 'No sign-up', 'MIT-licensed'],
    title: 'Miro alternative · livediagram',
    description:
      'An open-source, free Miro alternative: real-time diagrams, whiteboards and workshop boards you can open without an account.',
    h1: 'The open-source Miro alternative',
    lede: 'Miro is a powerful, sprawling online workspace. livediagram is a lighter, open-source take on the same idea: real-time multiplayer diagrams, whiteboards and workshop boards you can start in one click, with no sign-up, and run on your own account if you want to.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature (a few limits rise on paid plans)',
        them: 'Free tier, then paid plans',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary SaaS' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create boards; guest editing on paid plans',
      },
      { label: 'Real-time multiplayer', us: 'Yes', them: 'Yes' },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Visio, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + Excalidraw out',
        them: 'Broad import + export options',
      },
      {
        label: 'Programmatic access',
        us: 'REST API and an MCP server for AI tools, both free',
        them: 'Developer platform, marketplace and an MCP server',
      },
      {
        label: 'Focus',
        us: 'One canvas, three modes: diagrams, whiteboards and Workshop sessions',
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
      "It's free for everyone and MIT-licensed, with no seats needed to edit.",
      'Open a link and draw, with no sign-up wall in front of the canvas, even to create a canvas.',
      'Real-time multiplayer, live cursors and comments come standard, not gated behind a plan.',
      'Three ways to work one tab: Diagram for structure, Draw for freehand whiteboarding, and Workshop for running a session with your team.',
      'Participant links let a workshop add stickies, write and vote without being able to reshape the board.',
      'Assign action items to teammates on the canvas itself, tracked beside comments in the Collaborate panel.',
      'Workshop tools built in and free: Workshop mode, a facilitator role, a shared timer, dot-voting, live polls, planning-poker estimate cards, temperature checks, quizzes, an anonymous idea box and a Q&A board.',
      'Run the meeting itself on the board: an agenda that starts the timer for each segment, a roll call, a random picker, reveal zones that cover work until the room is ready, and decision records that keep what was agreed.',
      '91 templates, 25 one-click whole-canvas themes and ready-made looks turn a blank canvas into a polished diagram fast, drawn clean, crisp and Professional, or by hand in Sketch or Marker.',
      'Guide the room without pulling anyone away: Bring Focus offers everyone a jump to what you mean, anyone can follow anyone’s view, even on a view-only link, and reaction pads throw confetti or applause.',
      'Present a canvas as a slide deck built from its own elements, with a laser pointer and spotlight, no export needed.',
      'Record a walkthrough, your voice, an optional camera bubble and every pan, zoom and tab change, and anyone who can open the canvas replays it over the live board, free for everyone.',
      'Save any selection to your Personal or team Library and drop it on any canvas, and embed a live view of a plan, document or design from the other liveworkspace apps.',
      'Ask AI answers questions about a canvas from its own words, with sources, on built-in AI (a daily allowance) or your own key, and Automations run the board on their own: snapshots, resets, Slack and Teams posts, and a session summarised into your team’s knowledgebase.',
      'Turn a roadmap into cards in liveplanner, livediagram’s sister app for planning: shapes become cards, arrows become dependencies and lanes become columns, and each shape shows its card’s progress.',
      'Bring boards across from Excalidraw, draw.io, Visio, Lucidchart and Microsoft Whiteboard; export PNG, SVG, PDF, Mermaid or Excalidraw.',
    ],
    sections: [
      {
        heading: 'One workspace, three ways to work',
        paragraphs: [
          'Miro grew into a broad workspace: boards, workshops, docs, tables, video walkthroughs and a marketplace of apps. livediagram covers the same ground in one canvas with tabs, and each tab works in one of three modes. Diagram for structure, with arrows that stay attached and re-route as you move things. Draw for freehand whiteboarding with pressure-sensitive markers. Workshop for running the session itself: timers, dot votes, polls and reveals.',
          'Every tab also has a finish, the way it is drawn: Flexible by default, Professional for crisp, print-ready work, Sketch for pencil on paper and Marker for felt-tip on a whiteboard. A look sets the theme, finish, font and canvas pattern in one click, and switching it never changes the content underneath.',
          'Workshops are built in rather than bolted on. A facilitator can run the room with a shared timer, dot-voting, live polls, planning-poker estimate cards, quizzes, a Q&A board and responses kept hidden until the reveal, and templates cover retrospectives, Lean Coffee, town hall Q&A and event storming, including turning a photo of a sticky-note wall into notes. When the session ends, the actions it produced are assigned to teammates on the board itself.',
        ],
      },
      {
        heading: 'Every feature on the free plan',
        paragraphs: [
          "Miro's free tier is real, but it's the top of a pricing funnel: board limits and gated features exist to move teams onto paid seats. livediagram gates no feature and caps no boards. The hosted version at livediagram.app is free to start, every feature works on the free plan, and paid plans only raise a few limits.",
          'That includes the meeting basics: Miro keeps its timer and voting for paid plans and caps Talktrack recordings on its free plan, while in livediagram the timer, dot votes and polls come with Workshop mode, and walkthroughs come with every canvas.',
          'The whole codebase is MIT-licensed and public, so anyone can read exactly how it works.',
        ],
      },
      {
        heading: 'Collaboration without the onboarding',
        paragraphs: [
          'In Miro, creating a board starts with an account, and anonymous guest editing depends on the plan you are on. In livediagram, collaborating is a URL. Anyone can create a canvas without signing up; a guest’s new canvas is kept in their browser until they press Share, which syncs it in one step. Whoever opens the link is on the canvas with you, live cursors and all. A link is an Editor, Participant or view-only link (a Participant adds stickies, writes and votes but cannot reshape the board), and it can carry a password or an expiry date when you need it locked down.',
          'The collaboration tools go beyond cursors: leave comments on elements and assign action items to teammates directly on the canvas, tracked together in the Collaborate panel, with optional email notifications. A selection lock shows when someone is editing an element, so two people rarely end up changing the same thing at once.',
        ],
      },
      {
        heading: 'Connected to the rest of your workflow',
        paragraphs: [
          'Diagrams rarely live alone. livediagram imports Mermaid (flowcharts, state and ER diagrams, the diagram-as-code format that lives in READMEs and AI output), Markdown outlines, Excalidraw scenes, draw.io files and Microsoft Whiteboard boards, and exports PNG, SVG, PDF, Mermaid, Markdown, Excalidraw or a portable JSON file. Any share link embeds as a live-updating iframe in a wiki or doc: an editor link embeds an editable canvas, and a participant or view-only link a read-only one.',
          'For programmatic use there is a free REST API with personal tokens and an MCP server at mcp.livediagram.app that lets AI assistants read and edit your canvases directly; their edits arrive live, outlined, and undoable as one unit. None of it sits behind a plan.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram really free?',
        a: 'Yes. Every feature works on the free plan at livediagram.app, with no trial and no card, and paid plans raise a few limits. The code is MIT-licensed and public.',
      },
      {
        q: 'Do my teammates need an account to edit with me?',
        a: 'No. Share a link and anyone who opens it can edit in real time, with live cursors and comments, without signing up. You do not need an account to create a canvas either: a guest’s canvas is kept in their browser until they press Share, which syncs it in one step. Accounts are optional and mainly useful for syncing your canvases across devices and using teams.',
      },
      {
        q: 'Can I import my existing Miro boards?',
        a: "There's no direct Miro importer today. If your board is structured content (a flowchart, an org chart, a plan), the fastest path is to start from a livediagram template, or to import a Mermaid or Markdown version of the structure and let livediagram lay it out as a themed diagram. Boards from Excalidraw, draw.io, Visio, Lucidchart (through its Visio export) and Microsoft Whiteboard do import directly.",
      },
      {
        q: 'Can livediagram run workshops the way Miro does?',
        a: 'Sessions like retros, brainstorms, estimation and planning work well: switch a tab to Workshop and a facilitator can run a shared timer, dot-voting, live polls, a Q&A board and hidden responses that are revealed together, estimate cards run planning poker on the board, everyone can follow the facilitator’s view, and the canvas keeps the comments and assigned actions that came out of it. What livediagram does not have is Miro’s large-scale facilitation ecosystem (breakout-style sessions, a meeting-app marketplace), so for big multi-team workshops Miro is still the deeper toolkit.',
      },
    ],
  },
  {
    slug: 'xmind',
    name: 'XMind',
    highlights: ['Mind maps and more', 'Nothing to install', 'Open source'],
    title: 'XMind alternative · livediagram',
    description:
      'A free, open-source, browser-based XMind alternative for mind maps, plus flowcharts, whiteboards, timelines and more, with no account needed.',
    h1: 'The open-source, browser-based XMind alternative',
    lede: 'XMind is a polished tool built around mind maps, across desktop, mobile and the web. livediagram is free and open source, needs no install and no account, and handles mind maps alongside flowcharts, whiteboards and timelines in the same canvas.',
    rows: [
      {
        label: 'Runs in',
        us: 'Any browser, nothing to install',
        them: 'Desktop, mobile + web apps',
      },
      {
        label: 'Real-time multiplayer',
        us: 'Yes, share a link, no account needed',
        them: 'Yes, on its Premium plan',
      },
      {
        label: 'Price',
        us: 'Free, every feature (a few limits rise on paid plans)',
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
        them: 'PNG on the free plan; SVG, PDF, Markdown and Office on paid plans',
      },
      {
        label: 'Beyond mind maps',
        us: 'Flowcharts, whiteboards, workshops, timelines…',
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
      'More than mind maps: flowcharts, freehand whiteboards, timelines and charts in the same canvas.',
      'Nothing to install: open a link in any browser and start.',
      'Bring existing maps across: export Markdown from XMind and import it as a themed diagram.',
      'Sketch with the Freehand pen, or the Shape Pen to have a rough shape tidied into a clean one.',
      '91 templates (three mind-map styles among them), 25 one-click themes and ready-made looks make a map look polished instantly, clean or hand-drawn in the Sketch and Marker finishes.',
      'Present the map as a slide deck, or record a narrated walkthrough that a teammate replays over the live map.',
      'Free and open source, with every feature on the free plan.',
    ],
    sections: [
      {
        heading: 'No install, no account, no subscription needed',
        paragraphs: [
          'XMind has grown well beyond the desktop: it now has a web version and real-time co-editing for maps kept in its cloud, on its Premium plan. Where livediagram still differs is the friction before the first idea. It opens on any machine with a browser, including locked-down work laptops where you cannot install anything, and you can start a map without creating an account at all.',
          'Collaboration works the same way: send the link to a teammate and you are both on the map at the same time, with live cursors showing who is where, whether or not they have signed up. Comments and assigned actions live on the elements themselves, so feedback lands where the idea is, not in a separate chat thread.',
        ],
      },
      {
        heading: 'Bring your existing maps with you',
        paragraphs: [
          "You don't have to start over. XMind exports maps as Markdown outlines, and livediagram imports Markdown directly: the outline becomes a real, themed node-and-link diagram, laid out for you, in place of the tab's contents (add a new tab first to keep what is there). Or paste the outline into a mind map's Edit Outline and every line becomes a mind node you can keep growing. Mermaid text imports too.",
          'Going the other direction is just as open: export a map as PNG, SVG, or PDF for documents, or as Mermaid or Markdown text to keep the structure portable. Where XMind’s free plan exports a watermarked PNG, nothing about export here sits behind a subscription.',
        ],
      },
      {
        heading: 'One canvas for everything after the brainstorm',
        paragraphs: [
          'A mind map is usually the start of something: the ideas become a plan, the plan becomes a flowchart or a board of tasks. In XMind that next step usually happens in a different tool. In livediagram it happens on the next tab: one canvas holds the mind map, the flowchart and the timeline side by side, with tabs grouped into folders and per-tab layers when things get big. When the follow-up becomes a list of tasks, liveplanner, livediagram’s sister app for planning work, keeps them as cards on a board.',
          'Templates cover the common shapes of that follow-up work (flowcharts, retros, roadmaps, org charts, timelines and more), and one-click themes restyle the whole canvas so everything stays visually consistent as the project grows. When it is time to walk people through it, Presentation mode turns elements from any tab into a slide deck.',
        ],
      },
      {
        heading: 'Free and open, with no feature gating',
        paragraphs: [
          'XMind is a subscription product: the free version is capable but the full feature set is paid. livediagram is MIT-licensed open source with a free hosted version and no feature behind a paywall. Every feature, including export, collaboration, and the API, works on the free plan.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I import my XMind files?',
        a: "Not the .xmind file directly, but there is a clean path: export the map from XMind as Markdown, then use livediagram's Markdown import. The outline becomes a themed, laid-out node-and-link diagram on the current tab, replacing what is there, so add a new tab first. To keep growing it as a mind map, paste the outline into a mind map's Edit Outline instead.",
      },
      {
        q: 'Does livediagram work offline like the XMind desktop app?',
        a: "livediagram is a browser app, and its Offline Mode keeps a canvas stored only in your browser, never sent to a server. A guest’s new canvases start that way, and anyone can choose it when creating a canvas. But if fully offline desktop work is your main requirement, XMind's native apps are the stronger fit.",
      },
      {
        q: 'Is there a desktop or mobile app?',
        a: 'Not a native one. livediagram runs in a modern browser with nothing to install, and you can install it from the browser to a computer’s or phone’s home screen like an app. If you specifically want native desktop and mobile apps, XMind is the better pick there.',
      },
      {
        q: 'Is livediagram really free?',
        a: 'Yes. There is no trial and no feature gating: every feature works on the free hosted version, and the code is MIT-licensed.',
      },
    ],
  },
  {
    slug: 'excalidraw',
    name: 'Excalidraw',
    highlights: ['Hand-drawn finishes', 'Free presentations', '.excalidraw in and out'],
    title: 'Excalidraw alternative · livediagram',
    description:
      'A more structured Excalidraw alternative: the same free, open-source, no-sign-up spirit, a hand-drawn Sketch finish, templates, tabs and free presentations.',
    h1: 'A more structured Excalidraw alternative',
    lede: 'Excalidraw is a much-loved open-source whiteboard with a hand-drawn feel. livediagram shares the open-source, free, no-sign-up spirit, and can be drawn by hand too, in its Sketch and Marker finishes, but leans structured: start from a template, theme the whole canvas, split work across tabs, keep canvases in folders and present them as slides, with a freehand Draw mode when you just want to sketch.',
    rows: [
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'Yes, MIT-licensed' },
      {
        label: 'Price',
        us: 'Free, every feature (a few limits rise on paid plans)',
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
        us: 'Templates, tabs, folders, layers, themes, three editor modes',
        them: 'A freeform canvas (Excalidraw+ adds workspaces and presentations)',
      },
      {
        label: 'Presentations',
        us: 'Free: slides from your canvas, presenter notes, transitions',
        them: 'On the Excalidraw+ hosted plan: frames as slides, PDF and PPTX export',
      },
      {
        label: 'Import + export',
        us: 'Excalidraw, draw.io, Visio, Microsoft Whiteboard, Mermaid + Markdown in; PNG, SVG, PDF, JSON, Mermaid + .excalidraw out',
        them: '.excalidraw, PNG + SVG; Mermaid flowcharts in',
      },
    ],
    themBest: [
      'The signature hand-drawn aesthetic that made it famous, with its own Excalifont lettering: one look, tuned over years.',
      'A huge community, shared shape libraries, and integrations that embed it in other tools.',
      'Dead-simple, single-canvas freeform sketching.',
      'Excalidraw+ adds presentations built from frames, with a phone remote and PDF or PPTX export, and AI features that can run on your own model keys, on top of the free editor.',
    ],
    usBest: [
      'The hand-drawn look on any tab: the Sketch finish draws wobbly double strokes, pencil-shaded fills and handwriting, Marker draws one bold felt-tip stroke, and switching back to clean changes nothing about the diagram.',
      'Start from a real template (flowchart, retro, roadmap, org chart…) instead of a blank page: 91 of them.',
      'Keep a whole project together: several tabs in one canvas, organised in folders, with per-tab layers.',
      '25 themes recolour the whole canvas, shapes and arrows, in one click, and ready-made looks such as Doodle, Notebook and Flipchart set the theme, finish, font and canvas pattern together.',
      'Draw mode is a plain whiteboard: pressure-sensitive markers, an eraser and shapes on a plain, dotted or grid board, light or dark.',
      'Sketching tools beyond the marker: a Path tool for clean curves, optional shape recognition, an eraser that takes a whole stroke or just part of one, and Draw templates such as Sketchnote, Rich Picture and Comic Strip.',
      'Paste an Excalidraw copy straight onto a tab, or import .excalidraw files as canvases of their own.',
      'Presentations free for everyone: build a deck from elements on any tab, then present with notes, time budgets, transitions, a laser pointer and a spotlight.',
      'Animate a drawing so it draws itself on, or a title so it types itself in.',
      'Built-in charts, an icon library, comments and assigned actions, without add-ons.',
      'Smart alignment guides and snapping line everything up as you drag.',
      'Mermaid in and out: import flowchart, state and ER text, export flowcharts back to it.',
    ],
    sections: [
      {
        heading: 'The same spirit, more structure',
        paragraphs: [
          'livediagram and Excalidraw agree on the important things: MIT-licensed, free, and no sign-up wall in front of the canvas. Where they diverge is what happens after the first sketch. Excalidraw keeps to a freeform board, and that simplicity is a feature. livediagram assumes the sketch is going to grow: you start from a real template instead of a blank page, split the work across tabs inside one canvas, group tabs into folders, and separate annotation from content with per-tab layers.',
          'Themes carry that structure visually. Instead of styling shapes one by one, a single click restyles the entire canvas (shapes, arrows, text), and style presets plus a format painter keep new elements consistent with the rest.',
        ],
      },
      {
        heading: 'Hand-drawn when you want it',
        paragraphs: [
          'Every livediagram tab has a finish, the way its elements are drawn, and two of the four are by hand. Sketch draws wobbly double-stroked outlines, pencil-shaded fills, arrowheads as two loose strokes and lettering in a handwriting font, like a diagram drawn on paper. Marker draws one bold, slightly see-through stroke per edge, darker where strokes cross, like a flip chart. Professional is the opposite: square corners, thin lines and crisp lettering for print. A finish is set per tab, or on one element, and it is only a look: switching back restores exactly what was there.',
          "Excalidraw's own style is still its signature, with its own typeface and sloppiness controls, and if that exact aesthetic is the point, Excalidraw wins it. But sketching isn't exclusive to it. Any livediagram tab can also switch into Draw mode, a plain whiteboard with three pressure-sensitive markers, text, an eraser and shapes, on a plain, dotted or grid board in light or dark. In Diagram mode, the Freehand pen keeps a stroke exactly as drawn and the Shape Pen tidies a rough box into a clean element on release. Switching mode never changes the canvas: the same tab can hold a structured diagram and the freehand notes scribbled over it.",
        ],
      },
      {
        heading: 'Bring your Excalidraw boards along',
        paragraphs: [
          'An Excalidraw copy pasted onto a tab, or a file dropped on it, lands as whiteboard-native content in Draw mode. A .excalidraw file (or a PNG or SVG exported with the scene embedded) imports with shapes, arrows, text and connections intact, and the Explorer can import Excalidraw files as canvases of their own. Each import ends with a report of anything that changed on the way in.',
          'Excalidraw’s wobble and hatched fills are a matter of look, so an import draws its shapes in the tab’s own finish: switch the tab to Sketch to keep the hand-drawn feel. Export goes the other way too: any diagram or whiteboard tab saves back out as a .excalidraw file. Excalidraw has fewer element types, so richer livediagram elements simplify on the way out.',
        ],
      },
      {
        heading: 'Presentations, free',
        paragraphs: [
          'Presenting is one of the things Excalidraw+ adds on its paid plan. In livediagram it is part of the free product. Pick elements on any tab and make them a slide, so the deck points at the real diagram and changes when it does.',
          'Present full screen with presenter notes, a time budget per slide, Slide or Fade transitions, auto-advance and loop, a laser pointer and a spotlight. Animate an element so a drawing draws itself on or a title types itself in.',
        ],
      },
      {
        heading: 'A workspace, not just a canvas',
        paragraphs: [
          'The free Excalidraw editor deliberately stays a single board, and its paid Excalidraw+ plan adds the workspace around it. livediagram ships that workspace to everyone for free: an explorer with folders, thumbnail previews and a details list, teams whose shared canvases any member can work in, a Personal and team Library for reusable pieces, a 30-day Trash, and share links that can carry a password or an expiry date.',
          'Collaboration is more than co-drawing, too: comments attach to elements, action items can be assigned to teammates and tracked in the Collaborate panel.',
        ],
      },
      {
        heading: 'Diagrams as code, and AI',
        paragraphs: [
          'livediagram treats diagram text formats as first-class: Mermaid flowcharts import as real, editable diagrams and export back out, state and ER diagrams import too, and Markdown outlines import as laid-out node-and-link maps. There is also a free REST API with personal tokens and an MCP server that lets AI assistants read and edit canvases directly, with their changes shown live and undoable as one unit.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is livediagram open source like Excalidraw?',
        a: "Yes. Both projects are MIT-licensed. livediagram's whole monorepo is public, and every feature works on the free hosted version.",
      },
      {
        q: 'Can I get the hand-drawn look in livediagram?',
        a: "Yes. Switch a tab, or a single element, to the Sketch finish for wobbly double-stroked outlines, pencil-shaded fills and handwriting, or to Marker for bold felt-tip strokes; ready-made looks such as Doodle and Flipchart set it up in one click. Draw mode adds a freehand whiteboard with pressure-sensitive markers. Excalidraw's own style, with its Excalifont lettering, stays distinct: if that exact aesthetic is what you want, Excalidraw is the better pick.",
      },
      {
        q: 'Can I import my Excalidraw files?',
        a: 'Yes. Paste an Excalidraw copy onto a tab, or import a .excalidraw file (the format excalidraw.com’s "Save to disk" produces), or a PNG or SVG exported with the scene embedded. Shapes, arrows, text, images and connections come across; groups are not kept, since livediagram has no groups, and the import report says so. You can also export a tab back to a .excalidraw file; since Excalidraw has fewer element types, richer livediagram elements simplify on the way out.',
      },
      {
        q: 'Can I present from livediagram, like Excalidraw+?',
        a: 'Yes, for free. Build a slide deck from elements on any tab, then present full screen with presenter notes, per-slide time budgets, transitions, auto-advance, a laser pointer and a spotlight. Slides made from the canvas point at the real elements, so the deck changes when the diagram does.',
      },
      {
        q: 'When should I pick Excalidraw instead?',
        a: "When you want one fast, freeform board in Excalidraw's own hand-drawn style and nothing else around it. livediagram earns its keep when the work has structure: multiple tabs, folders, templates, themes, a deck to present, and a team sharing it.",
      },
    ],
  },
  ...DIAGRAMMING_ALTERNATIVES,
];

export const COMPARISONS: Comparisons = {
  app: 'livediagram',
  siteUrl: SITE_URL,
  updated: UPDATED,
  hub: {
    title: 'How livediagram compares · alternatives',
    description:
      'Honest, side-by-side comparisons of livediagram with Miro, FigJam, Lucidchart, draw.io, Excalidraw and more, including where each is the better pick.',
    heading: 'How livediagram compares',
    lede: 'Thinking about another tool? Here is an honest, side-by-side look at how livediagram compares, including where each one is the better pick.',
  },
  alternatives: LIST,
};
