// Where a new tab's first page sits on the canvas, per starting template, so create_document's description lets a
// host that loaded that one tool place elements without a read (docs/specs/015-api/mcp-server.md, "Where a new tab's
// first page sits"). Typed, not built: building the templates when a Worker starts would cost its first request.
// first-page.test.ts builds each template and holds these numbers to its first page.

export interface FirstPage {
  template: string;
  what: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FIRST_PAGES: readonly FirstPage[] = [
  { template: 'blank-slide-deck', what: 'a slide', x: -960, y: -540, width: 1920, height: 1080 },
  {
    template: 'blank-infographic',
    what: 'an A4 page',
    x: -397,
    y: -561.5,
    width: 794,
    height: 1123,
  },
  { template: 'blank-article', what: 'an A4 page', x: -397, y: -561.5, width: 794, height: 1123 },
  { template: 'blank-flashcards', what: 'a card', x: -450, y: -270, width: 900, height: 540 },
];

/** 'A new tab's first page is centred on (0, 0): "blank-slide-deck" a slide 1920 x 1080 from (-960, -540), ...' */
export function firstPagesBrief(pages: readonly FirstPage[] = FIRST_PAGES): string {
  const each = pages.map(
    (p) => `"${p.template}" ${p.what} ${p.width} x ${p.height} from (${p.x}, ${p.y})`,
  );
  return `A new tab's first page is centred on (0, 0): ${each.join(', ')}; a page's elements go inside its rectangle.`;
}
