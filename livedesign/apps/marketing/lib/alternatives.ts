// Single source of truth for the comparison / "alternative" pages
// (see docs/specs/019-marketing/comparison-pages.md). The dynamic route, its metadata,
// the index page, and the sitemap all derive from this list, so adding
// a competitor is a one-place change.
//
// Honesty rules (docs/specs/019-marketing/comparison-pages.md): every livedesign claim maps to a shipped
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
  // Short, factual cell text. `us` = livedesign, `them` = competitor.
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
  // Comparison table rows (livedesign vs competitor).
  rows: ComparisonRow[];
  // Fairness section: genuine reasons to pick the competitor.
  themBest: string[];
  // Shipped livedesign differentiators for this comparison.
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
    slug: 'google-slides',
    name: 'Google Slides',
    title: 'Google Slides alternative · livedesign',
    description:
      'A free, open-source Google Slides alternative for presenting designs: every page joins the deck, with presenter notes, timing, a laser and a spotlight.',
    h1: 'A free, open-source Google Slides alternative',
    lede: 'Google Slides is the presentation tool most people already have open. livedesign makes decks a little differently: every page of a design joins its deck, so the logo and the wireframes present as they are, from tabs of one design, with your team editing alongside you.',
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
        us: 'Present any design’s pages, in order',
        them: 'Themes, layouts and a large template gallery',
      },
      {
        label: 'Presenting',
        us: 'Presenter notes, per-slide time budgets, transitions, auto-advance and loop, laser and spotlight',
        them: 'Speaker notes, presenter view, audience Q&A, animations and transitions',
      },
      {
        label: 'Export',
        us: 'PDF, PNG and SVG',
        them: 'PowerPoint, PDF and images',
      },
      {
        label: 'Beyond the deck',
        us: 'Logos, wireframes and photos in the same design',
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
      'Every page of a design joins its deck: reorder them, hide the ones to skip, and present. The deck is saved with the design.',
      'One design for the whole story: the logo, the wireframes and the deck that presents them, side by side as tabs.',
      'Present with presenter notes, a time budget per slide, transitions, a laser pointer and a spotlight; your screen moves, nobody else’s.',
      'Leave a deck running on a screen: auto-advance every 5 to 60 seconds and loop back to the start.',
      'Put another tab on a slide, live: a tab window shows it as it is now, so the slide follows every change.',
      'Real-time editing with live cursors, comments and assigned actions, for anyone with the link, no account needed.',
      'An AI assistant connected over MCP can add logo and wireframe pages for you.',
      '15 templates to start from, from a logo design to app and website wireframes and a photo to edit.',
      'Free, MIT-licensed and self-hostable.',
    ],
    sections: [
      {
        heading: 'Every page is a slide',
        paragraphs: [
          'In Google Slides a deck is its own file, built slide by slide. In livedesign every page of a design joins its deck on its own, in order, so a logo, a wireframe or a blank page presents edge to edge, painted from your theme.',
          'The deck is ordered in the Slide Deck panel: drag to rearrange, rename, duplicate, or hide a slide you might want next week. A tab window puts another tab on a page, live, fitted to its frame.',
        ],
      },
      {
        heading: 'Presenting, built for the room',
        paragraphs: [
          'Presenting runs full screen on your screen alone: nobody is dragged into your slide, and collaborators with the design open carry on working. Each slide carries its own presenter notes behind a button, and an optional time budget you can watch as you talk. A laser pointer and a spotlight guide the room.',
          'Nothing on a slide can be changed by a stray click, so a projector is safe, and a deck can advance on its own and loop for a screen in a lobby.',
        ],
      },
      {
        heading: 'The deck and everything behind it',
        paragraphs: [
          'A deck is usually the last step of something: a brand, a product, a launch. In Workspace the pieces live in separate files. In livedesign they are tabs of one design: design the logo, sketch the screens, and present from all of it. Everyone edits live, with comments and assigned actions on the pages themselves.',
        ],
      },
      {
        heading: 'Free, open and no account needed',
        paragraphs: [
          'Slides is free with a Google account. livedesign needs no account at all: open the editor and start, and a guest’s design stays in their browser until they press Share, which syncs it in one step. The whole product is MIT-licensed with no paid tier, and you can run your own copy on your own Cloudflare account. Export any page as a PNG, SVG or a print-ready PDF when a deck has to travel.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can livedesign replace Google Slides?',
        a: 'For presenting a design, yes: every page as a slide, presenter notes, time budgets, transitions, a laser pointer and a spotlight, all edited live with your team. If you need click-by-click builds within a slide, PowerPoint files or audience Q&A, Google Slides is still the deeper presentation suite.',
      },
      {
        q: 'Can I import or export PowerPoint files?',
        a: 'No. livedesign does not read or write .pptx. You can export each page as a PNG or SVG, or every page as one PDF, and drop those into another deck.',
      },
      {
        q: 'Do my audience or co-editors need an account?',
        a: 'No account of any kind. Share a link and anyone who opens it can view or edit in real time. Signing in (email code or Google) is optional and mainly adds cross-device sync and teams.',
      },
      {
        q: 'Which pages can I present?',
        a: 'Every page, from any tab: a logo artboard, a wireframe screen or a blank page presents full screen, in page order. Hide the ones you want to skip.',
      },
      {
        q: 'Is livedesign free?',
        a: 'Yes. It is MIT-licensed open source with a free hosted version, every feature included, and no paid tier. You can even use it without creating an account at all.',
      },
    ],
  },
];

export const ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);

export function getAlternative(slug: string): Alternative | undefined {
  return ALTERNATIVES.find((a) => a.slug === slug);
}
