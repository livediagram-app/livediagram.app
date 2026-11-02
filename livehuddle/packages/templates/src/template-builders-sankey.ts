// Sankey diagram template (docs/specs/009-elements/sankey.md): where a website's visitors come from and where they
// go, as one Sankey element under a title and a caption. Its own file because it is one self-drawing element rather
// than a board or a tree.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[]. See
// docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createShape, createText, type Element, type SankeyFlow } from '@livehuddle/document';

// A month of visits, from the channels they arrive by, through the pages they read, to a trial and a paid plan.
// Every middle node sends on less than it receives, and the diagram draws the rest to one end node named Bounced
// (its leftovers, docs/specs/009-elements/sankey.md "Leftovers"), so the drop-off at each step reads as a band
// without anyone writing it as a flow.
const FLOWS: readonly SankeyFlow[] = [
  { from: 'Search', to: 'Landing Page', value: 4200 },
  { from: 'Social', to: 'Landing Page', value: 1800 },
  { from: 'Email', to: 'Landing Page', value: 900 },
  { from: 'Direct', to: 'Pricing', value: 1100 },
  { from: 'Landing Page', to: 'Pricing', value: 3200 },
  { from: 'Landing Page', to: 'Blog', value: 2200 },
  { from: 'Pricing', to: 'Free Trial', value: 2100 },
  { from: 'Pricing', to: 'Talk to Sales', value: 500 },
  { from: 'Blog', to: 'Free Trial', value: 900 },
  { from: 'Free Trial', to: 'Paid Plan', value: 1100 },
];

const MUTED = '#64748b';

export function buildSankey(cx: number, cy: number): Element[] {
  const width = 960;
  const sankeyH = 480;
  const titleH = 48;
  const captionH = 28;
  const headGap = 20;
  const totalH = titleH + captionH + headGap + sankeyH;
  const x0 = cx - width / 2;
  const y0 = cy - totalH / 2;

  return [
    {
      ...createText(x0, y0),
      width,
      height: titleH,
      label: 'Where our visitors go · September',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x0, y0 + titleH),
      width,
      height: captionH,
      label:
        'Bands are as wide as the visits they carry. Grey runs to Bounced: everyone who left at that step.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
    {
      ...createShape('sankey', x0, y0 + titleH + captionH + headGap),
      width,
      height: sankeyH,
      sankeyFlows: FLOWS.map((f) => ({ ...f })),
      sankeyLeftoverName: 'Bounced',
      sankeyLinkColor: 'source',
    },
  ];
}
