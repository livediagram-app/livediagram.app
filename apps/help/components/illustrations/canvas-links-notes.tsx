// Illustrations for the Canvas articles on Following someone, Notes, Links and Link Cards, and
// Event Storming Boards (docs/specs/018-help/help-app.md). Each draws the real surface with its
// real labels: the Following pill at the top of the canvas (chrome/TopCenterChrome.tsx), the note
// popover (notes/NotePopover.tsx), the Link element dialog (dialogs/LinkPickerDialog.tsx), and an
// event storming board making room for a note dragged into a gap with Alt held.

import type { ReactNode } from 'react';
import { Scene, Label, Shape, Avatar, Cursor, TextBar, Dialog, Tabs, Button } from './primitives';

// --- Following someone -------------------------------------------------------------------------

/** The tab bar's presence stack with the followed person's avatar ringed, the Following pill at
 *  the top of the canvas with its Stop, and their cursor on the part of the canvas you now see. */
export function FollowingScene() {
  return (
    <Scene w={420} h={210}>
      {/* The tab bar, with the presence stack beside the tab name */}
      <rect x={0} y={0} width={420} height={34} className="fill-slate-50" />
      <line x1={0} y1={34} x2={420} y2={34} className="stroke-slate-200" strokeWidth={1.2} />
      <rect
        x={14}
        y={6}
        width={130}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={26} y={18.5} size={11} weight={600} tone="strong">
        Checkout
      </Label>
      <circle cx={110} cy={18} r={9.5} fill="none" className="stroke-brand-500" strokeWidth={2} />
      <Avatar cx={110} cy={18} r={7.5} initial="S" colour="emerald" />
      <Avatar cx={124} cy={18} r={7.5} initial="A" colour="violet" />
      {/* The Following pill */}
      <g>
        <rect x={130} y={46} width={166} height={24} rx={12} className="fill-brand-500" />
        <circle cx={144} cy={58} r={3} className="fill-white help-art-as-drawn" />
        <Label x={153} y={58.5} size={11} weight={600} tone="onAccent">
          Following Sam
        </Label>
        <rect
          x={255}
          y={51}
          width={30}
          height={14}
          rx={7}
          className="fill-white/25 help-art-as-drawn"
        />
        <Label x={270} y={58.5} anchor="middle" size={10} weight={700} tone="onAccent">
          Stop
        </Label>
      </g>
      {/* Sam's view, now yours */}
      <Shape x={92} y={112} w={90} h={48} kind="rect" label="Basket" />
      <Shape x={238} y={112} w={90} h={48} kind="rect" accent label="Payment" />
      <path d="M182 136 h52" className="stroke-brand-400" strokeWidth={2.4} />
      <path d="M227 130 l7 6 l-7 6" fill="none" className="stroke-brand-400" strokeWidth={2.4} />
      <Cursor x={300} y={160} name="Sam" colour="emerald" />
    </Scene>
  );
}

// --- Notes -------------------------------------------------------------------------------------

/** The note popover beside its element: the toolbar (Bold, Italic, Underline, the block type,
 *  Link) over the writing, then the save hint and Delete note. */
export function NotePopoverScene() {
  const px = 168;
  const py = 22;
  const pw = 236;
  return (
    <Scene w={420} h={222}>
      <Shape x={22} y={82} w={104} h={56} kind="rect" label="Payments API" />
      {/* The element's note badge */}
      <g transform="translate(126 82)">
        <circle r={10} className="fill-white stroke-slate-300" strokeWidth={1.3} />
        <path
          d="M-4 -5 h6 l3 3 v7 h-9 Z M-2 -1 h4 M-2 2 h4"
          fill="none"
          className="stroke-slate-500"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </g>
      <path
        d={`M138 96 L${px} 104`}
        className="stroke-slate-200"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <rect
        x={px}
        y={py}
        width={pw}
        height={180}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Toolbar */}
      <Label x={px + 14} y={py + 18} size={12} weight={800} tone="strong">
        B
      </Label>
      <Label x={px + 32} y={py + 18} size={12} tone="strong" className="fill-slate-800 italic">
        I
      </Label>
      <Label x={px + 46} y={py + 18} size={12} tone="strong">
        U
      </Label>
      <line
        x1={px + 46}
        y1={py + 25}
        x2={px + 54}
        y2={py + 25}
        className="stroke-slate-800"
        strokeWidth={1.1}
      />
      <rect
        x={px + 66}
        y={py + 8}
        width={92}
        height={20}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1.1}
      />
      <Label x={px + 74} y={py + 18.5} size={10.5} tone="body">
        Paragraph
      </Label>
      <path
        d={`M${px + 144} ${py + 16} l3 3 l3 -3`}
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.3}
      />
      <path
        d={`M${px + 172} ${py + 20} a3 3 0 0 1 0 -4 l2 -2 a3 3 0 0 1 4 4 l-1 1 M${px + 178} ${py + 16} a3 3 0 0 1 0 4 l-2 2 a3 3 0 0 1 -4 -4 l1 -1`}
        fill="none"
        className="stroke-slate-600"
        strokeWidth={1.3}
      />
      {/* Writing area */}
      <rect
        x={px + 10}
        y={py + 36}
        width={pw - 20}
        height={104}
        rx={6}
        className="fill-white stroke-brand-300"
        strokeWidth={1.3}
      />
      <Label x={px + 20} y={py + 52} size={11.5} weight={700} tone="strong">
        Why a queue?
      </Label>
      <TextBar x={px + 20} y={py + 64} w={180} />
      <TextBar x={px + 20} y={py + 76} w={160} />
      <circle cx={px + 24} cy={py + 96} r={1.8} className="fill-slate-500" />
      <TextBar x={px + 30} y={py + 93} w={130} />
      <circle cx={px + 24} cy={py + 108} r={1.8} className="fill-slate-500" />
      <TextBar x={px + 30} y={py + 105} w={104} tone="accent" />
      {/* Footer */}
      <Label x={px + 12} y={py + 160} size={10} tone="muted">
        Cmd-Enter saves, Esc cancels.
      </Label>
      <Label
        x={px + pw - 12}
        y={py + 160}
        anchor="end"
        size={10}
        weight={600}
        className="fill-rose-600"
      >
        Delete note
      </Label>
    </Scene>
  );
}

// --- Links -------------------------------------------------------------------------------------

/** The Link element dialog: External URL, Tab or Document, the web address, and Save link. */
export function LinkElementDialogScene() {
  return (
    <Scene w={420} h={226}>
      <Shape x={20} y={30} w={84} h={46} kind="rect" label="Spec" />
      <Dialog x={96} y={52} w={306} h={162} title="Link element" sceneW={420} sceneH={226}>
        <Tabs
          x={112}
          y={98}
          items={['External URL', 'Tab', 'Document']}
          active={0}
          tabW={90}
          h={24}
        />
        <Label x={112} y={138} size={10.5} weight={600} tone="body">
          Web address
        </Label>
        <rect
          x={112}
          y={148}
          width={274}
          height={24}
          rx={6}
          className="fill-white stroke-brand-400"
          strokeWidth={1.4}
        />
        <Label x={120} y={160.5} size={10.5} tone="strong">
          example.com/spec
        </Label>
        <Button x={112} y={182} w={74} h={22} label="Save link" variant="primary" />
      </Dialog>
    </Scene>
  );
}

// --- Event storming: making room ---------------------------------------------------------------

/** A sticky of the notation, drawn as paper in both appearances. */
function EsNote({
  x,
  y,
  cls,
  text,
  tilt = 0,
  ghost = false,
}: {
  x: number;
  y: number;
  cls: string;
  text: string;
  tilt?: number;
  ghost?: boolean;
}) {
  return (
    <g transform={`rotate(${tilt} ${x + 28} ${y + 28})`} opacity={ghost ? 0.9 : 1}>
      <rect x={x + 1.5} y={y + 2.5} width={56} height={56} rx={2} className="fill-slate-900/10" />
      <rect x={x} y={y} width={56} height={56} rx={2} className={cls} />
      <Label
        x={x + 28}
        y={y + 29}
        anchor="middle"
        size={10}
        weight={700}
        className="fill-slate-800"
      >
        {text}
      </Label>
    </g>
  );
}

/** A key cap. */
function Key({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={30}
        height={20}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={1.3}
      />
      <rect x={x} y={y + 16} width={30} height={4} rx={2} className="fill-slate-200" />
      <Label x={x + 15} y={y + 9.5} anchor="middle" size={10} weight={700} tone="body">
        {children}
      </Label>
    </g>
  );
}

/** An event storming row making room: Alt held over the gap between two events slides the rest
 *  of the wall right, command and all, and the dragged note sits in the slot that opens. */
export function EsMakeRoomScene() {
  const lane = 104;
  return (
    <Scene w={440} h={214}>
      {/* The lane the note will land on, lit while dragging */}
      <rect x={0} y={lane - 6} width={440} height={68} className="fill-brand-50" />
      <g className="help-art-as-drawn">
        <EsNote x={16} y={lane} cls="fill-amber-400" text="CART" tilt={-1.5} />
        <EsNote x={86} y={lane} cls="fill-amber-400" text="PAID" tilt={1} />
        {/* The command above the event moves with it */}
        <EsNote x={300} y={lane - 70} cls="fill-brand-300" text="SHIP" tilt={-1} />
        <EsNote x={300} y={lane} cls="fill-amber-400" text="SHIPPED" tilt={1.5} />
        <EsNote x={370} y={lane} cls="fill-amber-400" text="DONE" tilt={-1} />
      </g>
      {/* The slot that opens, and the note being dragged into it */}
      <rect
        x={160}
        y={lane}
        width={56}
        height={56}
        rx={3}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.6}
        strokeDasharray="5 4"
      />
      <g className="help-art-as-drawn">
        <EsNote x={172} y={lane - 30} cls="fill-amber-300" text="PACKED" tilt={4} ghost />
      </g>
      <Cursor x={214} y={lane - 4} />
      {/* Everything after the gap slides right */}
      <path d="M232 186 h52" className="stroke-brand-400" strokeWidth={2.2} strokeLinecap="round" />
      <path
        d="M278 180 l6 6 l-6 6"
        fill="none"
        className="stroke-brand-400"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Key x={150} y={176}>
        Alt
      </Key>
      <Label x={188} y={186.5} size={10.5} tone="body">
        held
      </Label>
    </Scene>
  );
}
