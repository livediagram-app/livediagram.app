// Illustrations for the Canvas articles on Following someone, Notes, Links and Link Cards
// (docs/specs/018-help/help-app.md). Each draws the real surface with its real labels: the Following
// pill at the top of the canvas (chrome/TopCenterChrome.tsx), the note popover (notes/NotePopover.tsx)
// and the Link element dialog (dialogs/LinkPickerDialog.tsx).

import { Scene, Label, Shape, Avatar, Cursor, TextBar, Dialog, Tabs, Button } from './primitives';
import { Glyph } from './element-indicators';

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

/** The note popover centred below its element: the toolbar (Bold, Italic, Underline, the block type,
 *  Link) over the writing, then the save hint and Delete note. */
export function NotePopoverScene() {
  const pw = 236;
  const px = 210 - pw / 2;
  // Content origin: the popover's top edge sits 16 above it, room for the NOTE heading.
  const py = 98;
  return (
    <Scene w={420} h={302}>
      {/* The element, with its note indicator along the top */}
      <Shape x={158} y={14} w={104} h={60} kind="rect" label="Payments API" />
      <Glyph kind="note" cx={248} cy={26} />
      {/* The popover, centred below the element */}
      <rect
        x={px}
        y={py - 16}
        width={pw}
        height={196}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={px + 12} y={py - 4} size={9} weight={700} tone="muted">
        NOTE
      </Label>
      {/* The toolbar strip, with dividers after B I U and after the block picker */}
      <rect
        x={px + 8}
        y={py + 4}
        width={pw - 16}
        height={28}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <line
        x1={px + 60}
        y1={py + 9}
        x2={px + 60}
        y2={py + 27}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <line
        x1={px + 162}
        y1={py + 9}
        x2={px + 162}
        y2={py + 27}
        className="stroke-slate-200"
        strokeWidth={1}
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
      <Label x={px + pw - 12} y={py + 160} anchor="end" size={10} weight={600} tone="muted">
        Delete note
      </Label>
    </Scene>
  );
}

// --- Links -------------------------------------------------------------------------------------

/** The Link element dialog: External URL, Tab or Design, the web address, and Save link. */
export function LinkElementDialogScene() {
  return (
    <Scene w={420} h={226}>
      <Shape x={20} y={30} w={84} h={46} kind="rect" label="Spec" />
      <Dialog x={96} y={52} w={306} h={162} title="Link element" sceneW={420} sceneH={226}>
        <Tabs
          x={112}
          y={98}
          items={['External URL', 'Tab', 'Design']}
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
