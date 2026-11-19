// Illustrations for the Clickable Prototypes article under Wireframe Pages (docs/specs/007-editor/wireframe-pages.md
// "Clickable prototypes"). Each draws the real surface with its real labels: the link handle dragged onto a screen
// (ScreenLinkHandle.tsx), Prototype mode's bar over a screen with its hotspots flashing (PrototypeBar.tsx,
// PrototypePlayer.tsx), and the Flow view's arrows, Back tag and broken stub (FlowViewLayer.tsx). Composed from the
// shared primitives.

import type { ReactNode } from 'react';
import { Scene, Label } from '@liveworkspace/help-site/art/primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** A phone wireframe: the body, its white screen and the island, with what is on the screen drawn inside it. */
function Phone({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
}) {
  return (
    <g className="help-art-as-drawn">
      <rect x={x} y={y} width={w} height={h} rx={w * 0.16} className="fill-slate-800" />
      <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} rx={w * 0.13} className="fill-white" />
      <rect
        x={x + w / 2 - 12}
        y={y + 8}
        width={24}
        height={5}
        rx={2.5}
        className="fill-slate-800"
      />
      {children}
    </g>
  );
}

/** A dark wireframe button with its word. */
function WireButton({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={14} rx={7} className="fill-slate-800" />
      <Label x={x + w / 2} y={y + 7.5} anchor="middle" size={10} weight={600} tone="onAccent">
        {label}
      </Label>
    </g>
  );
}

/** A linked element as the Flow view outlines it. */
function LinkBox({
  x,
  y,
  w,
  h,
  broken = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  broken?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={3}
      className={broken ? 'fill-rose-500/10 stroke-rose-500' : 'fill-brand-500/10 stroke-brand-500'}
      strokeWidth={1.5}
      // Dashed as well as red, as the editor draws it: the brand is a red too.
      strokeDasharray={broken ? '4 3' : undefined}
    />
  );
}

/** A Flow view arrow: the canvas-coloured edge under the brand line, a dot at its start and a head at its end. */
function FlowArrow({
  d,
  start,
  head,
}: {
  d: string;
  start: { x: number; y: number };
  head: string;
}) {
  return (
    <g>
      <path d={d} fill="none" className="stroke-white" strokeWidth={4} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={start.x} cy={start.y} r={2.5} className="fill-brand-500 stroke-white" />
      <polygon points={head} className="fill-brand-500" />
    </g>
  );
}

/** A small tag beside a linked element: Back in the brand colour, Broken in the warning red. */
function FlowTag({ x, y, kind }: { x: number; y: number; kind: 'back' | 'broken' }) {
  const w = kind === 'back' ? 36 : 46;
  return (
    <g>
      <rect
        x={x}
        y={y - 7}
        width={w}
        height={14}
        rx={7}
        className={kind === 'back' ? 'fill-white stroke-brand-300' : 'fill-white stroke-rose-300'}
        strokeWidth={1}
      />
      <Label
        x={x + w / 2}
        y={y + 0.5}
        anchor="middle"
        size={10}
        weight={600}
        className={kind === 'back' ? 'fill-brand-700' : 'fill-rose-700 dark:fill-rose-300'}
      >
        {kind === 'back' ? 'Back' : 'Broken'}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------------------------

/** The link handle on a selected button, dragged onto the Cart screen, which is outlined with its name. */
export function LinkHandleScene() {
  const handle = { x: 156, y: 216 };
  const pointer = { x: 312, y: 128 };
  return (
    <Scene w={420} h={240}>
      {/* The Product screen, its Add to Cart button selected. */}
      <Phone x={50} y={34} w={110} h={190}>
        <rect x={62} y={56} width={86} height={54} rx={4} className="fill-slate-200" />
        <rect x={62} y={118} width={60} height={7} rx={2} className="fill-slate-300" />
        <rect x={62} y={131} width={30} height={6} rx={2} className="fill-slate-200" />
        <WireButton x={62} y={192} w={86} label="Add to Cart" />
      </Phone>
      <rect
        x={60}
        y={190}
        width={90}
        height={18}
        rx={9}
        className="fill-none stroke-brand-600"
        strokeWidth={1.5}
      />

      {/* The Cart screen under the pointer, outlined, its name in a pill above its corner. */}
      <Phone x={262} y={34} w={110} h={190}>
        <rect x={274} y={58} width={50} height={8} rx={2} className="fill-slate-300" />
        <rect x={274} y={76} width={86} height={22} rx={4} className="fill-slate-100" />
        <rect x={274} y={104} width={86} height={22} rx={4} className="fill-slate-100" />
        <rect x={274} y={140} width={40} height={6} rx={2} className="fill-slate-200" />
        <WireButton x={274} y={192} w={86} label="Checkout" />
      </Phone>
      <rect
        x={260}
        y={32}
        width={114}
        height={194}
        rx={20}
        className="fill-brand-500/5 stroke-brand-500"
        strokeWidth={2}
      />
      <rect
        x={260}
        y={10}
        width={74}
        height={17}
        rx={4}
        className="fill-brand-700 dark:fill-brand-800"
      />
      <Label x={297} y={19} anchor="middle" size={10} weight={600} tone="onAccent">
        Link to Cart
      </Label>

      {/* The line from the handle to the pointer. */}
      <path
        d={`M ${handle.x} ${handle.y} C ${handle.x + 80} ${handle.y}, ${pointer.x - 80} ${pointer.y}, ${pointer.x} ${pointer.y}`}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={pointer.x} cy={pointer.y} r={3.5} className="fill-brand-500" />

      {/* The handle: a brand disc with the screen-link glyph, ringed in white. */}
      <circle
        cx={handle.x}
        cy={handle.y}
        r={8}
        className="fill-brand-700 stroke-white dark:fill-brand-800"
        strokeWidth={2}
      />
      <g className="help-art-as-drawn stroke-white" fill="none" strokeWidth={1.2}>
        <rect x={handle.x - 4.5} y={handle.y - 4} width={4} height={8} rx={1} />
        <path
          d={`M ${handle.x - 0.5} ${handle.y} h 5 M ${handle.x + 2.5} ${handle.y - 2} l 2 2 -2 2`}
        />
      </g>
    </Scene>
  );
}

/** Prototype mode: its bar over the Cart screen in its frame, the hotspots lit by a press off them. */
export function PrototypeModeScene() {
  const icon = (x: number, children: ReactNode) => (
    <g>
      <rect x={x} y={8} width={20} height={20} rx={5} className="fill-white" />
      <g className="stroke-slate-600" fill="none" strokeWidth={1.5} strokeLinecap="round">
        {children}
      </g>
    </g>
  );
  return (
    <Scene w={420} h={250} bg="plain">
      <rect x={0} y={36} width={420} height={214} className="fill-slate-100" />
      {/* The bar. */}
      <rect x={0} y={0} width={420} height={36} className="fill-white" />
      <line x1={0} y1={36} x2={420} y2={36} className="stroke-slate-200" />
      <circle cx={20} cy={18} r={9} className="fill-brand-700 dark:fill-brand-800" />
      <path d="M17.5 13.5 L23.5 18 L17.5 22.5 Z" className="help-art-as-drawn fill-white" />
      <Label x={34} y={18.5} size={11} weight={700} tone="strong">
        Prototype
      </Label>
      <line x1={94} y1={11} x2={94} y2={25} className="stroke-slate-200" />
      <Label x={104} y={18.5} size={11} weight={600} tone="strong">
        Cart
      </Label>
      <Label x={132} y={18.5} size={10} tone="body">
        2 of 3
      </Label>
      {icon(222, <path d="M234.5 13 L229.5 18 L234.5 23" />)}
      {icon(246, <path d="M253.5 13 L258.5 18 L253.5 23" />)}
      <rect
        x={274}
        y={8}
        width={112}
        height={20}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={330} y={18.5} size={10} weight={600} tone="body" anchor="middle">
        Copy Prototype Link
      </Label>
      {icon(394, <path d="M399.5 13.5 L408.5 22.5 M408.5 13.5 L399.5 22.5" />)}

      {/* The Cart screen, centred in its frame. */}
      <Phone x={156} y={46} w={108} h={196}>
        <path
          d="M171 64 L167 68 L171 72"
          fill="none"
          className="stroke-slate-700"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <rect x={178} y={64} width={40} height={8} rx={2} className="fill-slate-300" />
        <rect x={166} y={84} width={88} height={24} rx={4} className="fill-slate-100" />
        <rect x={166} y={114} width={88} height={24} rx={4} className="fill-slate-100" />
        <rect x={166} y={150} width={44} height={6} rx={2} className="fill-slate-200" />
        <rect x={226} y={150} width={28} height={6} rx={2} className="fill-slate-300" />
        <WireButton x={166} y={212} w={88} label="Checkout" />
      </Phone>
      {/* The hotspots, lit: Back and Checkout. */}
      <rect
        x={163}
        y={60}
        width={12}
        height={16}
        rx={3}
        className="fill-brand-500/20 stroke-brand-500"
        strokeWidth={2}
      />
      <rect
        x={164}
        y={210}
        width={92}
        height={18}
        rx={9}
        className="fill-brand-500/20 stroke-brand-500"
        strokeWidth={2}
      />
    </Scene>
  );
}

/** The Flow view: Home's card curving to Product beside it, its Shop button arcing over the row and down the gap into
 *  Cart's side (clear of its label), Product's
 *  button to Cart, a broken link's dashed stub and tag, and Cart's back button tagged Back. */
export function FlowViewScene() {
  const top = 54;
  const h = 152;
  return (
    <Scene w={420} h={220}>
      {/* The screens' labels, as the canvas names each page above it. */}
      <Label x={84} y={top - 8} anchor="middle" size={10} tone="muted">
        Home
      </Label>
      <Label x={210} y={top - 8} anchor="middle" size={10} tone="muted">
        Product
      </Label>
      <Label x={336} y={top - 8} anchor="middle" size={10} tone="muted">
        Cart
      </Label>

      <Phone x={40} y={top} w={88} h={h}>
        <rect x={48} y={70} width={40} height={6} rx={2} className="fill-slate-300" />
        <rect x={48} y={84} width={72} height={36} rx={4} className="fill-slate-200" />
        <rect x={48} y={128} width={72} height={20} rx={4} className="fill-slate-100" />
        <WireButton x={48} y={178} w={72} label="Shop" />
      </Phone>
      <Phone x={166} y={top} w={88} h={h}>
        <rect x={174} y={70} width={72} height={40} rx={4} className="fill-slate-200" />
        <rect x={174} y={116} width={50} height={6} rx={2} className="fill-slate-300" />
        <rect x={174} y={130} width={40} height={5} rx={2} className="fill-slate-200" />
        <WireButton x={174} y={178} w={72} label="Add to Cart" />
      </Phone>
      <Phone x={292} y={top} w={88} h={h}>
        <path
          d="M305 76 L301 80 L305 84"
          fill="none"
          className="stroke-slate-700"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <rect x={300} y={94} width={72} height={20} rx={4} className="fill-slate-100" />
        <rect x={300} y={120} width={72} height={20} rx={4} className="fill-slate-100" />
        <WireButton x={300} y={178} w={72} label="Pay" />
      </Phone>

      {/* Home: the card to Product beside it, the Shop button over the row to Cart. */}
      <LinkBox x={48} y={84} w={72} h={36} />
      <FlowArrow
        d="M120 102 C 143 102, 143 112, 166 112"
        start={{ x: 120, y: 102 }}
        head="159,108 166,112 159,116"
      />
      <LinkBox x={48} y={178} w={72} h={14} />
      <FlowArrow
        d="M120 185 L 141 185 Q 147 185 147 179 L 147 28 Q 147 22 153 22 L 280 22 Q 286 22 286 28 L 286 64 Q 286 68 290 68 L 292 68"
        start={{ x: 120, y: 185 }}
        head="285,64 292,68 285,72"
      />

      {/* Product: Add to Cart to Cart beside it; a link whose screen was deleted. */}
      <LinkBox x={174} y={178} w={72} h={14} />
      <FlowArrow
        d="M246 185 C 269 185, 269 160, 292 160"
        start={{ x: 246, y: 185 }}
        head="285,156 292,160 285,164"
      />
      <LinkBox x={172} y={127} w={44} h={11} broken />
      <line
        x1={216}
        y1={132.5}
        x2={236}
        y2={132.5}
        className="stroke-rose-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <FlowTag x={238} y={132.5} kind="broken" />

      {/* Cart: its back button, tagged Back. */}
      <LinkBox x={299} y={72} w={10} h={16} />
      <FlowTag x={313} y={80} kind="back" />
    </Scene>
  );
}
