// Canvas scenes for livedesign (liveworkspace/docs/specs/017-help/help-centre.md): the editor at a glance, placing
// an element from a category, panning and zooming, a marquee selection, the format painter, snapping guides and a
// linked element, all on livedesign's own pages (phone screens and web pages) rather than a flowchart.

import {
  Arrow,
  Cursor,
  Label,
  Panel,
  Scene,
  SelectionBox,
  Tile,
} from '@liveworkspace/help-site/art/primitives';
import { CornerControls, DesignPage, EditorFrame, Strip, stripCategory } from './editor-chrome';
import { PhoneScreen } from './design-content';
import { APP_PAGES, AppScreens } from './user-interface';

/** The editor at a glance, with your cursor on the first screen. */
export function CanvasOverview() {
  return (
    <Scene w={640} h={400}>
      <EditorFrame w={640} h={400} pages={APP_PAGES} level="60%" tabs={['App Screens', 'Brand']}>
        <AppScreens x={168} y={84} />
        <Cursor x={250} y={220} name="You" />
      </EditorFrame>
    </Scene>
  );
}

/** A grabbing hand, centred near (x, y). */
export function GrabHand({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M0 6 v-8 a3 3 0 0 1 6 0 v6 m0 -2 a3 3 0 0 1 6 0 v3 m0 -1 a3 3 0 0 1 6 0 v5 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -9 -7 l-3 -7 a3 3 0 0 1 5 -3 l1 2"
      className="fill-white stroke-slate-600"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Dropping an element from a category's flyout: Shapes open, a drag trail from its Square tile, and the square
 *  landing on the page selected. */
export function AddingElements() {
  const sx = 8;
  const shapes = stripCategory(sx, 'Shapes');
  const px = shapes.left - 4;
  return (
    <Scene w={420} h={230}>
      <DesignPage x={236} y={66} w={150} h={150} size="A4 · Portrait" bare>
        <rect x={250} y={80} width={70} height={6} rx={3} className="fill-slate-300" />
        <rect x={250} y={92} width={110} height={4} rx={2} className="fill-slate-200" />
      </DesignPage>
      <Strip x={sx} y={8} open="Shapes" />
      <Panel x={px} y={40} w={120} h={52}>
        {(['square', 'circle', 'diamond'] as const).map((k, i) => (
          <Tile key={k} x={px + 10 + i * 35} y={50} size={30}>
            {k === 'square' && (
              <rect
                x={-6}
                y={-6}
                width={12}
                height={12}
                rx={1.5}
                className="stroke-brand-600"
                strokeWidth={1.2}
                fill="none"
              />
            )}
            {k === 'circle' && (
              <circle r={6.5} className="stroke-slate-600" strokeWidth={1} fill="none" />
            )}
            {k === 'diamond' && (
              <path
                d="M0 -7 L7 0 L0 7 L-7 0 Z"
                className="stroke-slate-600"
                strokeWidth={1}
                fill="none"
              />
            )}
          </Tile>
        ))}
      </Panel>
      <Arrow from={[px + 25, 84]} to={[262, 128]} kind="curved" tone="muted" dashed />
      <rect
        x={266}
        y={116}
        width={90}
        height={64}
        rx={4}
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={1.5}
      />
      <SelectionBox x={266} y={116} w={90} h={64} />
      <Cursor x={312} y={150} />
    </Scene>
  );
}

/** Panning and zooming: the grabbing hand dragging the canvas, and the zoom card in the corner. */
export function PanAndZoom() {
  return (
    <Scene w={420} h={230}>
      <DesignPage x={60} y={40} w={84} h={160} size="iPhone · Wireframe" bare>
        <PhoneScreen x={66} y={46} w={72} h={148} variant="home" cta="Shop" frame={false} />
      </DesignPage>
      <DesignPage x={170} y={40} w={84} h={160} size="" bare>
        <PhoneScreen x={176} y={46} w={72} h={148} variant="product" cta="Add" frame={false} />
      </DesignPage>
      <path d="M236 132 h44" className="stroke-slate-300" strokeWidth={1} strokeDasharray="3 3" />
      <GrabHand x={290} y={122} />
      <CornerControls right={412} y={198} level="75%" />
    </Scene>
  );
}

/** A marquee drag on a page gathering the heading, the picture and the button into one selection. */
export function MultiSelect() {
  return (
    <Scene w={420} h={230}>
      <DesignPage x={110} y={30} w={200} h={186} size="A4 · Portrait" bare>
        <rect x={130} y={50} width={90} height={8} rx={4} className="fill-slate-300" />
        <rect x={130} y={68} width={160} height={60} rx={4} className="fill-brand-100" />
        <rect x={130} y={140} width={70} height={16} rx={4} className="fill-brand-500" />
        <rect x={130} y={172} width={160} height={4} rx={2} className="fill-slate-200" />
        <rect x={130} y={182} width={120} height={4} rx={2} className="fill-slate-200" />
      </DesignPage>
      <rect
        x={122}
        y={42}
        width={182}
        height={120}
        className="fill-brand-500/10 stroke-brand-500"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <Cursor x={302} y={160} />
    </Scene>
  );
}

/** A wireframe button on a page: solid or outlined. */
function WireButton({
  x,
  y,
  w,
  label,
  solid,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  solid: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={22}
        rx={11}
        className={solid ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-400'}
        strokeWidth={solid ? 1 : 1}
      />
      <Label
        x={x + w / 2}
        y={y + 11.5}
        size={9.5}
        weight={600}
        anchor="middle"
        className={solid ? 'fill-white help-art-as-drawn' : 'fill-slate-600'}
      >
        {label}
      </Label>
    </g>
  );
}

/** The format painter's brush, drawn at (x, y). */
function Painter({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-6} y={-8} width={12} height={6} rx={1} className="fill-brand-500" />
      <path
        d="M0 -2 v4 M-1.5 2 h3 v6 h-3 Z"
        className="fill-slate-500 stroke-slate-600"
        strokeWidth={1}
      />
    </g>
  );
}

/** The format painter: the styled button's look lifted and brushed onto the plain one. */
export function FormatPainter() {
  return (
    <Scene w={420} h={200}>
      <DesignPage x={60} y={40} w={300} h={130} size="Desktop · Wireframe" bare>
        <rect x={80} y={60} width={140} height={8} rx={4} className="fill-slate-300" />
        <rect x={80} y={76} width={200} height={4} rx={2} className="fill-slate-200" />
        <WireButton x={80} y={104} w={84} label="Get Started" solid />
        <WireButton x={240} y={104} w={84} label="Learn More" solid />
        <WireButton x={240} y={104} w={84} label="Learn More" solid={false} />
      </DesignPage>
      <Arrow from={[166, 112]} to={[236, 112]} kind="curved" tone="muted" dashed />
      <Painter x={282} y={140} />
    </Scene>
  );
}

/** Snapping: dragging the card next to the picture lines their top edges up, with the guide drawn between them. */
export function SnappingGuides() {
  return (
    <Scene w={420} h={200}>
      <DesignPage x={50} y={36} w={320} h={140} size="Desktop · Wireframe" bare>
        <rect x={74} y={66} width={110} height={80} rx={4} className="fill-brand-100" />
        <rect
          x={228}
          y={66}
          width={110}
          height={60}
          rx={4}
          className="fill-slate-50 stroke-brand-500"
          strokeWidth={1.5}
        />
        <rect x={238} y={76} width={60} height={6} rx={3} className="fill-slate-300" />
        <rect x={238} y={88} width={84} height={4} rx={2} className="fill-slate-200" />
      </DesignPage>
      <path d="M60 66 H360" className="stroke-rose-500" strokeWidth={1} strokeDasharray="3 2" />
      <Cursor x={300} y={110} />
    </Scene>
  );
}

/** A linked element: the button wears a link badge, and following it jumps to the Checkout page. */
export function ElementLink() {
  return (
    <Scene w={420} h={220}>
      <DesignPage x={60} y={34} w={96} h={170} size="iPhone · Wireframe" bare>
        <PhoneScreen
          x={66}
          y={40}
          w={84}
          h={158}
          variant="product"
          cta="Add to Cart"
          frame={false}
        />
      </DesignPage>
      <circle cx={146} cy={176} r={7} className="fill-brand-500" />
      <path
        d="M143 179 l6 -6 M144.5 173 h4.5 v4.5"
        className="stroke-white help-art-as-drawn"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
      />
      <Arrow from={[156, 170]} to={[262, 120]} kind="curved" />
      <DesignPage x={268} y={34} w={96} h={170} size="Checkout" bare>
        <PhoneScreen x={274} y={40} w={84} h={158} variant="checkout" cta="Pay" frame={false} />
      </DesignPage>
      <rect
        x={268}
        y={34}
        width={96}
        height={170}
        fill="none"
        className="stroke-brand-400"
        strokeWidth={1.5}
      />
    </Scene>
  );
}

/** Shift-drag to duplicate: the screen stays put while a ghost of its copy follows the pointer. */
export function ShiftDragDuplicate() {
  return (
    <Scene w={420} h={230}>
      <DesignPage x={70} y={40} w={96} h={166} size="iPhone · Wireframe" bare>
        <PhoneScreen
          x={76}
          y={46}
          w={84}
          h={154}
          variant="product"
          cta="Add to Cart"
          frame={false}
        />
      </DesignPage>
      <g opacity={0.55}>
        <DesignPage x={240} y={40} w={96} h={166} size="" bare>
          <PhoneScreen
            x={246}
            y={46}
            w={84}
            h={154}
            variant="product"
            cta="Add to Cart"
            frame={false}
          />
        </DesignPage>
      </g>
      <SelectionBox x={240} y={40} w={96} h={166} />
      <path d="M166 120 H236" className="stroke-slate-300" strokeWidth={1} strokeDasharray="3 3" />
      <Cursor x={292} y={128} />
      <rect
        x={350}
        y={18}
        width={44}
        height={20}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <Label x={372} y={28.5} size={9.5} weight={600} anchor="middle" tone="strong">
        Shift
      </Label>
    </Scene>
  );
}

/** Arrows wiring screens into a user flow: home to product, product to checkout, and a dashed way back. */
export function ScreenFlow() {
  return (
    <Scene w={420} h={220}>
      <AppScreens x={52} y={36} h={160} gap={46} />
      <Arrow from={[131, 116]} to={[173, 116]} width={1.5} />
      <Arrow from={[254, 116]} to={[296, 116]} width={1.5} />
      <Arrow from={[336, 206]} to={[92, 206]} width={1.25} dashed tone="muted" />
    </Scene>
  );
}
