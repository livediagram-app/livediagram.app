// Where a new tab's first page sits on the canvas, per starting template, so create_design's description lets a
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
  { template: 'blank-logo', what: 'an artboard', x: -512, y: -512, width: 1024, height: 1024 },
  {
    template: 'blank-wireframe-phone',
    what: 'a phone screen',
    x: -211.5,
    y: -438,
    width: 423,
    height: 876,
  },
  {
    template: 'blank-wireframe-tablet',
    what: 'a tablet screen',
    x: -432,
    y: -612,
    width: 864,
    height: 1224,
  },
  {
    template: 'blank-wireframe-laptop',
    what: 'a laptop screen',
    x: -768,
    y: -487,
    width: 1536,
    height: 974,
  },
  {
    template: 'blank-wireframe-browser',
    what: 'a browser window',
    x: -721,
    y: -476.5,
    width: 1442,
    height: 953,
  },
  {
    template: 'blank-wireframe-watch',
    what: 'a watch face',
    x: -123,
    y: -181,
    width: 246,
    height: 362,
  },
];

/** 'A new tab's first page is centred on (0, 0): "blank-logo" an artboard 1024 x 1024 from (-512, -512), ...' */
export function firstPagesBrief(pages: readonly FirstPage[] = FIRST_PAGES): string {
  const each = pages.map(
    (p) => `"${p.template}" ${p.what} ${p.width} x ${p.height} from (${p.x}, ${p.y})`,
  );
  return `A new tab's first page is centred on (0, 0): ${each.join(', ')}; a page's elements go inside its rectangle.`;
}
