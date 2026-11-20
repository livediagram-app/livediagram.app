// What a shared Space looks like to the people it reaches (the Sharing articles,
// liveworkspace/docs/specs/017-help/help-centre.md): a Space embedded in another page beside the iframe snippet that
// places it, and a visitor on a one-tab link, the shared tab open and the rest shown as Not shared. Drawn on
// livehuddle's own floor and bottom bar.

import { Label, Scene, TextBar } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, BarTab } from './editor-chrome';
import { Desk, MeetingTable, Plant, Room, Rug, Sofa, Sticky } from './space-furniture';

/** A Space embedded in a host page: the floor with the embed's only chrome (Open in livehuddle and the tab switcher
 *  bottom-left, the zoom dock bottom-right), beside the iframe snippet the Share dialog copies. */
export function EmbeddedSpace() {
  return (
    <Scene w={420} h={240} bg="plain">
      <rect
        x={14}
        y={12}
        width={392}
        height={216}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <TextBar x={30} y={26} w={120} h={8} />
      <TextBar x={30} y={42} w={360} tone="faint" />
      <svg x={30} y={58} width={250} height={124} viewBox="0 0 250 124">
        <rect width={250} height={124} className="fill-slate-100" />
        <Room x={14} y={10} w={120} h={78} name="Desks" />
        <Desk x={28} y={36} />
        <Desk x={80} y={36} />
        <Room x={142} y={10} w={96} h={78} name="Lounge" door="left" />
        <Rug cx={190} cy={52} rx={28} ry={14} />
        <Sofa x={170} y={40} />
        <Plant cx={226} cy={74} />
      </svg>
      <rect
        x={30}
        y={58}
        width={250}
        height={124}
        rx={6}
        className="fill-none stroke-slate-300"
        strokeWidth={0.75}
      />
      <rect
        x={38}
        y={154}
        width={110}
        height={20}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={48} y={164.5} size={9.5} weight={600} tone="body">
        Open in livehuddle
      </Label>
      <rect
        x={154}
        y={154}
        width={66}
        height={20}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={164} y={164.5} size={9.5} weight={600} tone="body">
        Our Office
      </Label>
      <rect
        x={244}
        y={150}
        width={28}
        height={26}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={258} y={164} anchor="middle" size={12} weight={700} tone="body">
        +
      </Label>
      <g className="help-art-as-drawn">
        <rect x={290} y={58} width={100} height={124} rx={8} className="fill-slate-800" />
        <Label x={300} y={76} size={10} weight={600} className="fill-emerald-400">
          &lt;iframe
        </Label>
        <Label x={306} y={94} size={10} className="fill-slate-300">
          src=&quot;…/embed&quot;
        </Label>
        <Label x={306} y={112} size={10} className="fill-slate-300">
          width=&quot;800&quot;
        </Label>
        <Label x={306} y={130} size={10} className="fill-slate-300">
          height=&quot;500&quot;
        </Label>
        <Label x={300} y={148} size={10} weight={600} className="fill-emerald-400">
          &gt;&lt;/iframe&gt;
        </Label>
      </g>
      <TextBar x={30} y={196} w={360} tone="faint" />
      <TextBar x={30} y={212} w={240} tone="faint" />
    </Scene>
  );
}

/** A visitor on a one-tab link: the shared Meeting Room tab open, its neighbours in the bottom bar as Not shared. */
export function OneTabShare() {
  const y = 200 - BAR_H;
  return (
    <Scene w={420} h={200}>
      <Room x={60} y={18} w={300} h={146} name="Meeting Room" />
      <MeetingTable x={110} y={70} w={110} />
      <Sticky x={270} y={56} w={56} h={50} tone="sky" label="Agenda" lines={2} />
      <Plant cx={340} cy={146} />
      <rect x={0} y={y} width={420} height={BAR_H} className="fill-slate-100" />
      <line x1={0} y1={y} x2={420} y2={y} className="stroke-slate-200" strokeWidth={0.75} />
      <Label x={60} y={y + 15.5} size={9} tone="muted" anchor="middle">
        Not shared
      </Label>
      <BarTab x={150} y={y} w={104} label="Meeting Room" active />
      <Label x={330} y={y + 15.5} size={9} tone="muted" anchor="middle">
        Not shared
      </Label>
    </Scene>
  );
}
