// Single source of truth for the comparison / "alternative" pages
// (see liveworkspace/docs/comparison-pages.md). The dynamic route, its metadata,
// the index page, and the sitemap all derive from this list, so adding
// a competitor is a one-place change.
//
// Honesty rules (liveworkspace/docs/comparison-pages.md): every livedocuments claim maps to a shipped
// feature; every competitor gets a real "where they're the better pick"
// section; competitor facts are qualitative (positioning, not volatile
// pricing/numbers); free + open-source competitors are never implied to
// be paid or proprietary. The deep-dive `sections`
// and `faqs` follow the same rules: honest answers, including partial
// ones ("no importer, but...").

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
  // Short, factual cell text. `us` = livedocuments, `them` = competitor.
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
  // Comparison table rows (livedocuments vs competitor).
  rows: ComparisonRow[];
  // Fairness section: genuine reasons to pick the competitor.
  themBest: string[];
  // Shipped livedocuments differentiators for this comparison.
  usBest: string[];
  // Deep-dive prose: competitor-specific sections expanding the key
  // value themes (collaboration model, open-source story, structure,
  // interop). This is where the page earns its depth.
  sections: DeepDiveSection[];
  // Competitor-specific questions, rendered on-page and emitted as
  // FAQPage JSON-LD (liveworkspace/docs/comparison-pages.md "Metadata").
  faqs: Faq[];
};

export const ALTERNATIVES: Alternative[] = [
  {
    slug: 'google-slides',
    name: 'Google Slides',
    title: 'Google Slides alternative · livedocuments',
    description:
      'A free, open-source Google Slides alternative: slide pages from 61 ready-made layouts, presenter notes and timing, and the write-up in the same document.',
    h1: 'A free, open-source Google Slides alternative',
    lede: 'Google Slides is the presentation tool most people already have open. livedocuments makes decks a little differently: start each slide from a ready-made layout, keep the article, the one-pager and the deck as tabs of one document, and present any page of them, with your team editing alongside you.',
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
        us: '16:9 or 4:3 slide pages from 61 layouts, painted from your theme',
        them: 'Themes, layouts and a large template gallery',
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
        us: 'Articles and infographics in the same document',
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
      'Slide pages for a designed deck: 16:9 or 4:3, started from 61 layouts (title, agenda, big numbers, roadmap and more).',
      'One document for the whole story: the write-up as an article, the one-pager as an infographic, and the deck that presents them, side by side as tabs.',
      'Any page can be a slide, from any tab, ordered in one deck that is saved with the document.',
      'Present with presenter notes, a time budget per slide, transitions, a laser pointer and a spotlight; your screen moves, nobody else’s.',
      'Leave a deck running on a screen: auto-advance every 5 to 60 seconds and loop back to the start.',
      'Put another tab on a slide, live: a tab window shows it as it is now, so the slide follows every change.',
      'Export the deck as an animated GIF for a chat, an email or a README.',
      'Real-time editing with live cursors, comments and assigned actions, for anyone with the link, no account needed.',
      'An AI assistant connected over MCP can build the deck for you from slide layouts.',
      '23 templates to start from, from a launch keynote to a quarterly review.',
      'Free, MIT-licensed and self-hostable.',
    ],
    sections: [
      {
        heading: 'Slides from ready-made layouts',
        paragraphs: [
          'In Google Slides a deck is its own file, built slide by slide. In livedocuments a slide is a page: add a 16:9 or 4:3 slide page and start it from one of 61 layouts (a title, an agenda, two columns, image and text, a timeline and more), painted from your theme. Change the theme and every slide follows.',
          'A slide sits in a deck you order in the Slide Deck panel: drag to rearrange, rename, duplicate, or hide a slide you might want next week. Any other page can join the deck too, so a poster or a page of an article can be presented as it is. A tab window puts another tab on a slide, live, fitted to its frame.',
        ],
      },
      {
        heading: 'Presenting, built for the room',
        paragraphs: [
          'Presenting runs full screen on your screen alone: nobody is dragged into your slide, and collaborators with the document open carry on working. Each slide carries its own presenter notes behind a button, and an optional time budget you can watch as you talk. A laser pointer and a spotlight guide the room.',
          'Nothing on a slide can be changed by a stray click, so a projector is safe, and a deck can advance on its own and loop for a screen in a lobby.',
        ],
      },
      {
        heading: 'The deck and everything behind it',
        paragraphs: [
          'A deck is usually the last step of something: a brief, a report, a launch. In Workspace those live in Docs and Slides as separate files. In livedocuments they are tabs of one document: write the brief as an article, lay out the one-pager, and present from all of it. Everyone edits live, with comments and assigned actions on the pages themselves.',
        ],
      },
      {
        heading: 'Free, open and no account needed',
        paragraphs: [
          'Slides is free with a Google account. livedocuments needs no account at all: open the editor and start, and a guest’s document stays in their browser until they press Share, which syncs it in one step. The whole product is MIT-licensed with no paid tier, and you can run your own copy on your own Cloudflare account. Export any page as a PNG, SVG or a print-ready PDF when a deck has to travel, or the whole deck as an animated GIF.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can livedocuments replace Google Slides?',
        a: 'For many decks, yes: slide pages from ready-made layouts, presenter notes, time budgets, transitions, a laser pointer and a spotlight, all edited live with your team. If you need click-by-click builds within a slide, PowerPoint files or audience Q&A, Google Slides is still the deeper presentation suite.',
      },
      {
        q: 'Can I import or export PowerPoint files?',
        a: 'No. livedocuments does not read or write .pptx. You can export each page as a PNG or SVG, every page as one PDF, or the deck as an animated GIF, and drop those into another deck.',
      },
      {
        q: 'Do my audience or co-editors need an account?',
        a: 'No account of any kind. Share a link and anyone who opens it can view or edit in real time. Signing in (email code or Google) is optional and mainly adds cross-device sync and teams.',
      },
      {
        q: 'Can I present a page that is not a slide?',
        a: 'Yes. Any page can join the deck, from any tab: an infographic, a poster or a page of an article presents full screen just as a slide page does.',
      },
      {
        q: 'Is livedocuments free?',
        a: 'Yes. It is MIT-licensed open source with a free hosted version, every feature included, and no paid tier. You can even use it without creating an account at all.',
      },
    ],
  },
];

export const ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
