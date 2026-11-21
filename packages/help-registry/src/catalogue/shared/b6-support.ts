// The merged articles of the support batch (liveworkspace/docs/specs/017-help/help-centre.md): one entry per path, `apps`
// the apps whose help had the article, in registry order. Keywords are the union of the copies'.

import type { Article } from '../../types';

export const articles: Article[] = [
  {
    slug: 'what-is-open-source',
    title: 'What is Open Source?',
    description:
      'The code is public, free to read, and free to run. Here is what open source means and what being MIT-licensed gives you.',
    keywords: 'mit license free code github oss public repository',
    category: 'About',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle', 'liveknowledge'],
    byApp: {
      livediagram: { category: 'About livediagram' },
      livedocuments: { category: 'About livedocuments' },
      livedesign: { category: 'About livedesign' },
      livehuddle: { category: 'About livehuddle' },
    },
  },
  {
    slug: 'who-is-it-for',
    title: 'Who Is It For?',
    description:
      'Teams who work together, from sprints and workshops to reports, logos and stand-ups.',
    keywords:
      'audience use cases teams developers designers educators students software product project managers retros hiring planning plan writers presenters speakers talks flashcards marketing infographics remote hybrid stand-up all-hands community events hosts',
    category: 'About',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
    byApp: {
      livediagram: { title: 'Who Is livediagram For?', category: 'About livediagram' },
      liveplanner: { title: 'Who Is liveplanner For?', category: 'About liveplanner' },
      livedocuments: { title: 'Who Is livedocuments For?', category: 'About livedocuments' },
      livedesign: { title: 'Who Is livedesign For?', category: 'About livedesign' },
      livehuddle: { title: 'Who Is livehuddle For?', category: 'About livehuddle' },
    },
  },
  {
    slug: 'accessibility',
    title: 'Accessibility and Keyboard Navigation',
    description:
      'Reach your work, move through it, and edit with the keyboard, with changes announced to screen readers.',
    keywords:
      'a11y screen reader focus tab navigation aria assistive accessible f6 regions reduce motion ui scale',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'adding-shapes-and-arrows',
    title: 'Adding Shapes and Arrows',
    description: 'Dropping shapes from the Palette and connecting them with arrows.',
    keywords: 'add box connector line draw create insert place flowchart process flow how-to',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livediagram', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'guest-vs-account',
    title: 'Guest vs Account',
    description:
      'The editor always works without signing in. Here is what a guest gets, and what an account adds on top.',
    keywords: 'sign in up anonymous login register benefits sync account',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'keyboard-essentials',
    title: 'Keyboard Essentials',
    description: 'The small set of shortcuts worth learning first to work quickly.',
    keywords:
      'shortcuts hotkeys keys copy paste undo delete essential redo search zen board cards sheet cells',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'sharing-your-document',
    title: 'Sharing Your Work',
    description: 'Hand over a link and work together, live, even with people who never sign in.',
    keywords:
      'share link collaborate invite send url realtime together diagram document meet space',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livediagram', 'livedocuments', 'livehuddle', 'liveknowledge'],
    byApp: {
      liveknowledge: { title: 'Sharing Your Knowledgebase' },
      livediagram: { title: 'Sharing Your Canvas' },
      livedocuments: { title: 'Sharing Your Document' },
      livehuddle: { title: 'Sharing Your Space' },
    },
  },
  {
    slug: 'the-canvas-basics',
    title: 'Canvas Basics',
    description:
      'Panning, zooming, and finding your way around the surface where you build everything.',
    keywords: 'pan zoom navigate move around scroll basics orientation',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'exporting-pages',
    title: 'Exporting Pages',
    description: 'Every page or one page as a PDF or images.',
    keywords:
      'export download pdf png svg gif animated animation moving image loop zip all pages one page import json print printable infographic slides slide deck present presentation add as from powerpoint pptx keynote google word docx docs editable speaker notes logo kit photo jpeg webp psd',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
    apps: ['livedocuments', 'livedesign'],
    byApp: {
      livedocuments: { title: 'Exporting and Presenting Pages' },
    },
  },
  {
    slug: 'pages-tour',
    title: 'The Pages Tour',
    description:
      'A short, optional walkthrough for each kind of page, started from Get Started at the bottom of the editor, or from Show Me on any page.',
    keywords:
      'pages tour walkthrough onboarding intro introduction getting started guide tutorial first time learn page name cog settings layout background add slides slide deck to present presentation infographic article show me replay rerun accessibility flashcards get logo wireframe photo photos',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
    apps: ['livedocuments', 'livedesign'],
  },
  {
    slug: 'working-with-pages',
    title: 'Working with Pages',
    description:
      'Work on a tab as pages: add them, paint them, reorder and lock them, then export them.',
    keywords:
      'pages page infographic infographics poster one pager one-pager flyer handout report sheet a4 a3 letter us square social post instagram linkedin story stories slide portrait landscape orientation size background article articles document kind first choice navigator next previous backgrounds colour color gradient pattern dots grid lines theme dark name rename duplicate move reorder drag delete add snap margins margin fit resize scale split into contents sidebar find a lock locked unlock padlock protect freeze read only custom photo image picture overlay wash tint fade blur blurred soft softened frosted upload title bar layout button tidy up align straighten even spacing widescreen carry over blank logo wireframe design',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Basics',
    apps: ['livedocuments', 'livedesign'],
  },
  {
    slug: 'report-a-vulnerability',
    title: 'Reporting a Vulnerability',
    description: 'How to report a security issue privately, and what to expect when you do.',
    keywords:
      'security vulnerability disclosure bug exploit cve advisory responsible safe harbour harbor pentest researcher hacker report',
    category: 'Policies',
    categorySlug: 'policies',
    parentSlug: 'policies',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'data-privacy',
    title: 'Data Privacy',
    description:
      'Where your work lives, what gets stored, and how you stay in control of your own data.',
    keywords:
      'storage stored cloudflare security where data location safe document images uploads media google drive community project',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'offline-mode',
    title: 'Offline Mode',
    description:
      "Work saved only in this browser, where a guest's new work starts, and how to move it to and from your account.",
    keywords:
      'local only pill this browser storage private no sync device localstorage disconnect save location clear site data lost guest default start move to account after sign in share upload folders new folder document take offline plan server switch project',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'open-source-trust',
    title: 'Open Source and Trust',
    description:
      'The whole codebase is public and MIT-licensed, so you do not have to take any privacy claim on faith.',
    keywords: 'github mit audit code public license transparent inspect',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle', 'liveknowledge'],
  },
  {
    slug: 'share-link-security',
    title: 'Share Link Security',
    description:
      'Two self-serve controls, a share password and link expiry, that bound who can open a shared work and for how long.',
    keywords:
      'password protect expire lock secure links safety access pass expiry extend revoke viewer editor participant link preview previews unfurl slack teams discord imessage whatsapp card thumbnail',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'what-we-collect',
    title: 'What We Collect',
    description:
      'Anonymous, first-party product events, published on a public dashboard, with a one-click opt-out.',
    keywords:
      'privacy telemetry analytics tracking data collect opt out anonymous page views pageviews visits',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'telemetry-dashboard',
    title: 'The Public Telemetry Dashboard',
    description:
      'Everything the app measures, published as anonymous counts on a public dashboard anyone can read.',
    keywords:
      'telemetry dashboard analytics stats metrics public transparency charts trends timings percentiles p75 median core web vitals lcp inp cls exceptions search anonymous features pages help health detail',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security/what-we-collect',
    parentSlug: 'what-we-collect',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'desktop',
    title: 'Desktop',
    description: 'On a computer you get the complete editor, with nothing held back.',
    keywords: 'computer pc mac windows laptop mouse full editor',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'mobile',
    title: 'Mobile',
    description:
      'On a phone the editor is built for touch, with finger gestures and a layout fitted to the screen.',
    keywords:
      'phone iphone android touch gestures small screen toolbar dock mobile layout landscape sideways rotate header tabs hide fullscreen',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'tablet',
    title: 'Tablet',
    description: 'A tablet has room for the full layout, with touch for direct editing.',
    keywords: 'ipad touch stylus pen android surface tablet keyboard',
    category: 'Supported Devices',
    categorySlug: 'supported-devices',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'dark-mode',
    title: 'Appearance: Light, Dark, System',
    description:
      "Light, Dark, or follow your device: the look of the app itself, apart from each tab's theme.",
    keywords:
      'night theme appearance dark light system os device switch toggle cycle eyes mode website help header',
    category: 'Tools',
    categorySlug: 'tools',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
    byApp: {},
  },
  {
    slug: 'layout-cleanup',
    title: 'Layout Cleanup',
    description:
      'Tidiers for nudging things into alignment and for laying connected shapes out from scratch.',
    keywords: 'tidy align arrange auto grid organise organize straighten up neat layout',
    category: 'Tools',
    categorySlug: 'tools',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'auto-align',
    title: 'Auto-Align',
    description: 'A quick grid snap for when elements are nearly lined up but a few pixels off.',
    keywords: 'grid tidy straighten arrange snap organise organize',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'auto-layout',
    title: 'Auto Layout',
    description: 'Let the app lay out connected shapes for you from the arrows between them.',
    keywords:
      'arrange flowchart tree mindmap tidy up automatic graph preview hover try before greyed out disabled already lanes swimlane route arrows layered radial',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
    apps: ['livediagram', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'markdown-import',
    title: 'Markdown Import',
    description: 'Bring Markdown into the app as a tidy, themed tree diagram, or as an article.',
    keywords:
      'outline text to diagram tree convert bullet list paste markdown md file article headings lists formatting import',
    category: 'Tools',
    categorySlug: 'tools',
    apps: ['livediagram', 'livedocuments'],
    byApp: {},
  },
  {
    slug: 'zen-mode',
    title: 'Zen Mode',
    description: 'Hide the toolbars and panels to leave just your work.',
    keywords: 'distraction free fullscreen hide ui focus clean minimal presentation screen share',
    category: 'Tools',
    categorySlug: 'tools',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'],
  },
  {
    slug: 'automations',
    title: 'Automations',
    description:
      'Rules your work runs on its own: when something happens, if conditions hold, then do the steps.',
    keywords:
      'automation automations automate rule rules trigger condition step workflow schedule scheduled recurring nightly reset revert snapshot slack microsoft teams connection connections webhook incoming signed hmac email notify audit trail template templates ai summarise describe zapier',
    category: 'Tools',
    categorySlug: 'tools',
    apps: ['livediagram', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'browser-compatibility',
    title: 'Browser Compatibility',
    description: 'Which browsers work best, and a checklist for fixing browser-related glitches.',
    keywords: 'chrome safari firefox edge supported rendering glitch display broken',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'cannot-sign-in',
    title: "Can't Sign In",
    description:
      'A checklist for sign-in problems, and how to keep working while you sort them out.',
    keywords: 'login failed locked out access problem cant sign in error code',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'collaboration-issues',
    title: 'Real-Time Collaboration Problems',
    description: 'What to check when you cannot see collaborators, or edits are slow to arrive.',
    keywords: 'sync realtime not working lag disconnect websocket updates stale',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
  {
    slug: 'document-not-loading',
    title: 'A File Will Not Load',
    description:
      'What to check when something will not open, from quick checks to share-link problems.',
    keywords:
      'blank stuck loading error broken empty spinner wont open 404 diagram opening taking longer than usual colleague works for others document',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: ['livediagram', 'livedocuments', 'livehuddle'],
    byApp: {
      livediagram: { title: 'A Canvas Will Not Load' },
      livedocuments: { title: 'A Document Will Not Load' },
      livehuddle: { title: 'A Space Will Not Load' },
    },
  },
  {
    slug: 'missing-changes',
    title: 'My Changes Are Missing',
    description:
      'What to check when work seems to have vanished, and how to recover it with autosave and undo.',
    keywords:
      'lost work autosave recover restore disappeared gone save history new version reload update no longer supported chart checklist embed placeholder',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'],
  },
  {
    slug: 'repair-this-browser',
    title: 'Repair This Browser',
    description: 'Clear stuck settings and caches in this browser, keeping your work and identity.',
    keywords:
      'reset clear cache cookies local storage stuck loading fix diagnostics support repair browser data document project',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: [
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
      'liveknowledge',
    ],
  },
];
