// Canvas-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md), on livedocuments' own canvas:
// pages laid out on the dot grid, each with its label and title bar cards, holding what a deck or an infographic
// holds. Placing, panning and zooming, selecting many, the format painter, a multicolour theme, a link to another
// page and snapping, drawn with the editor chrome kit (./editor-chrome) and the page kit (./doc-page).

import { lucideHand, lucideLink, lucidePaintbrush } from '@liveworkspace/icons/lucide';
import { Label, Scene, SelectionBox, Shape } from '@liveworkspace/help-site/art/primitives';
import { CLUSTER_W, CornerCluster, Icon, STRIP_W, Strip, stripSlot } from './editor-chrome';
import {
  BarChart,
  Heading,
  Lines,
  Page,
  Picture,
  Pointer,
  Rule,
  SlideContent,
  Stat,
} from './doc-page';
import { Flyout, FlyoutTile } from './palette-flyout';
import { ShapeOutline } from './toolbar-layout';

/** Dropping a shape from the Shapes flyout onto a slide: a dashed drag trail from the Rounded tile to the shape just
 *  placed, still selected. */
export function AddingElements() {
  const W = 420;
  const sx = (W - STRIP_W) / 2;
  const fx = Math.round(stripSlot(sx, 'shapes') - 40);
  return (
    <Scene w={W} h={236}>
      <Strip x={sx} y={8} open="shapes" />
      <Page x={222} y={150} w={184} h={78} name="Plan">
        <Heading x={236} y={166} size={11}>
          Next Steps
        </Heading>
        <Lines x={236} y={178} w={64} n={3} />
      </Page>
      <Flyout
        x={fx}
        y={40}
        w={140}
        h={104}
        item="shapes"
        blurb="Boxes and outlines"
        footer="Click, or drag it out."
      >
        {(['rectangle', 'rounded', 'ellipse'] as const).map((k, i) => (
          <FlyoutTile
            key={k}
            x={fx + 10 + i * 41}
            y={82}
            w={36}
            name={['Square', 'Rounded', 'Circle'][i]!}
            hover={i === 1}
          >
            <ShapeOutline kind={k} />
          </FlyoutTile>
        ))}
      </Flyout>
      <path
        d={`M${fx + 69} 112 C ${fx + 100} 150, 280 150, 316 184`}
        className="fill-none stroke-brand-400"
        strokeWidth={1.25}
        strokeDasharray="3 3"
      />
      <Shape x={314} y={170} w={74} h={40} label="Launch" />
      <SelectionBox x={314} y={170} w={74} h={40} />
      <Pointer x={350} y={192} />
    </Scene>
  );
}

/** Panning with the grabbing hand across two slides, and the zoom card in the corner scaling the view. */
export function PanAndZoom() {
  return (
    <Scene w={420} h={210}>
      <Page x={30} y={46} w={168} h={95} name="Cover">
        <SlideContent x={30} y={46} w={168} h={95} title="Annual Report" layout="title" />
      </Page>
      <Page x={222} y={46} w={168} h={95} name="Growth">
        <SlideContent x={222} y={46} w={168} h={95} title="Growth" />
      </Page>
      <path
        d="M186 166 h-30 M163 160 l-7 6 l7 6"
        className="fill-none stroke-slate-400"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Icon prims={lucideHand} x={200} y={166} size={15} className="stroke-slate-800" />
      <CornerCluster x={420 - 8 - CLUSTER_W} y={176} level="80%" highlight="zoom" />
    </Scene>
  );
}

/** A marquee drag across a slide: the heading, the text and the chart fall inside and are selected; the picture on
 *  the next slide, outside the box, is not. */
export function MultiSelect() {
  return (
    <Scene w={420} h={200}>
      <Page x={24} y={40} w={226} h={127} name="Results">
        <Heading x={40} y={60} size={12}>
          Q3 Results
        </Heading>
        <Lines x={40} y={76} w={78} n={4} />
        <BarChart x={140} y={60} w={92} h={86} />
      </Page>
      <Page x={270} y={40} w={128} h={127} name="Team" bar={{ look: false }}>
        <Picture x={282} y={52} w={104} h={70} />
        <Lines x={282} y={134} w={70} n={2} />
      </Page>
      <rect
        x={32}
        y={50}
        width={208}
        height={104}
        className="fill-brand-500/10 stroke-brand-500"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {[
        [37, 53, 76, 14],
        [37, 73, 84, 24],
        [137, 57, 98, 92],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={1.5}
          className="fill-none stroke-brand-500"
          strokeWidth={1}
        />
      ))}
      <Pointer x={240} y={154} />
    </Scene>
  );
}

/** The format painter: the brush picks up the styled plan card's look and paints it onto the plain one beside it. */
export function FormatPainter() {
  return (
    <Scene w={420} h={200}>
      <Page x={44} y={40} w={332} h={140} name="Pricing">
        <Heading x={62} y={60} size={11}>
          Choose a Plan
        </Heading>
        <Shape x={62} y={78} w={120} h={76} accent />
        <Label x={76} y={96} size={10} weight={700} tone="onAccent">
          Team
        </Label>
        <Label x={76} y={112} size={9} tone="onAccent">
          Live editing for all
        </Label>
        <Shape x={238} y={78} w={120} h={76} />
        <Label x={252} y={96} size={10} weight={700} tone="strong">
          Personal
        </Label>
        <Label x={252} y={112} size={9} tone="body">
          One editor, any device
        </Label>
      </Page>
      <path
        d="M186 92 C 200 70, 220 70, 234 90"
        className="fill-none stroke-brand-400"
        strokeWidth={1.25}
        strokeDasharray="3 3"
      />
      <Icon prims={lucidePaintbrush} x={262} y={136} size={15} className="stroke-slate-800" />
    </Scene>
  );
}

/** A multicolour theme on an infographic: each card takes its own hue from the theme's set, the title stays in the
 *  page's ink. */
export function MulticolourTheme() {
  const hues = [
    ['fill-emerald-50 stroke-emerald-500', 'fill-emerald-600', '68%', 'Reach'],
    ['fill-violet-50 stroke-violet-500', 'fill-violet-600', '4.2k', 'Sign-ups'],
    ['fill-amber-50 stroke-amber-500', 'fill-amber-600', '12', 'Markets'],
    ['fill-rose-50 stroke-rose-500', 'fill-rose-600', '91%', 'Kept'],
  ] as const;
  return (
    <Scene w={420} h={220}>
      <Page x={88} y={34} w={244} h={172} name="Our Year" rest="A4">
        <Heading x={210} y={56} size={13} anchor="middle">
          Our Year in Numbers
        </Heading>
        <Rule x={201} y={66} />
        {hues.map(([box, ink, value, label], i) => {
          const x = 104 + (i % 2) * 108;
          const y = 82 + Math.floor(i / 2) * 58;
          return (
            <g key={label}>
              <rect x={x} y={y} width={100} height={50} rx={5} className={box} strokeWidth={1.25} />
              <Label x={x + 10} y={y + 20} size={14} weight={700} className={ink}>
                {value}
              </Label>
              <Label x={x + 10} y={y + 37} size={9} tone="body">
                {label}
              </Label>
            </g>
          );
        })}
      </Page>
    </Scene>
  );
}

/** An element linked to another page: the link badge on the button, and the jump to the slide it opens. */
export function ElementLink() {
  return (
    <Scene w={420} h={170}>
      <Page x={24} y={46} w={176} h={99} name="Cover">
        <Heading x={40} y={72} size={12}>
          Launch Plan
        </Heading>
        <Rule x={40} y={81} />
        <Shape x={40} y={100} w={76} h={24} accent />
        <Label x={78} y={112.5} size={9} weight={600} tone="onAccent" anchor="middle">
          See Detail
        </Label>
      </Page>
      <circle cx={116} cy={100} r={7} className="fill-brand-600 stroke-white" strokeWidth={1.5} />
      <Icon prims={lucideLink} x={116} y={100} size={7} className="stroke-white" />
      <path
        d="M124 96 C 160 66, 196 62, 226 80"
        className="fill-none stroke-brand-500"
        strokeWidth={1.25}
      />
      <path
        d="M219 78 l7 2 l-3 6"
        className="fill-none stroke-brand-500"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x={229}
        y={43}
        width={174}
        height={101}
        rx={3}
        className="fill-none stroke-brand-500"
        strokeWidth={1.25}
      />
      <Page x={232} y={46} w={168} h={95} name="Detail" bare>
        <SlideContent x={232} y={46} w={168} h={95} title="The Detail" layout="picture" />
      </Page>
    </Scene>
  );
}

/** Dragging the second stat card beside the first snaps their top edges together; the dashed guide shows the shared
 *  edge. */
export function SnappingGuides() {
  return (
    <Scene w={420} h={200}>
      <Page x={44} y={36} w={332} h={150} name="Highlights">
        <Heading x={62} y={56} size={11}>
          Highlights
        </Heading>
        <line
          x1={56}
          y1={78}
          x2={364}
          y2={78}
          className="stroke-rose-500"
          strokeWidth={0.75}
          strokeDasharray="3 2"
        />
        <rect
          x={62}
          y={78}
          width={116}
          height={78}
          rx={4}
          className="fill-brand-50 stroke-brand-500"
          strokeWidth={1.25}
        />
        <Stat x={74} y={100} value="2.4M" label="Readers" size={16} />
        <rect
          x={234}
          y={78}
          width={116}
          height={64}
          rx={4}
          className="fill-brand-50 stroke-brand-500"
          strokeWidth={1.25}
        />
        <Stat x={246} y={100} value="38%" label="Growth" size={16} />
        <SelectionBox x={234} y={78} w={116} h={64} />
      </Page>
      <Pointer x={292} y={118} />
    </Scene>
  );
}
