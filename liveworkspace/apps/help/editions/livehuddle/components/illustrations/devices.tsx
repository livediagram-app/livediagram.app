// livehuddle on each kind of device (the Supported Devices articles, liveworkspace/docs/specs/017-help/help-centre.md):
// the full editor on a computer's monitor and on a tablet held landscape, and the phone layout with its one strip
// across the top. The screens are the real chrome (./editor-chrome) over a small office (./space-furniture), drawn
// once at full size and scaled into each frame.

import { Scene } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, BottomBar, Card, CornerCluster, Icon, ICONS, TopRow } from './editor-chrome';
import { AvatarPad, Desk, OfficeFloor, Plant, Room, Rug, Sofa } from './space-furniture';

/** The whole editor, 520 by 300, scaled into the box at (x, y) `w` wide. */
export function EditorScreen({ x, y, w }: { x: number; y: number; w: number }) {
  const h = (w * 300) / 520;
  return (
    <svg x={x} y={y} width={w} height={h} viewBox="0 0 520 300">
      <rect width={520} height={300} className="fill-slate-100" />
      <OfficeFloor x={110} y={56} />
      <TopRow w={520} />
      <CornerCluster x={350} y={240} />
      <BottomBar y={300 - BAR_H} w={520} tabs={['Virtual Office']} />
    </svg>
  );
}

/** On a computer: the full editor on a monitor, every card and bar in its place. */
export function DesktopEditor() {
  return (
    <Scene w={420} h={240} bg="plain">
      <rect x={24} y={12} width={372} height={198} rx={8} className="fill-slate-800" />
      <EditorScreen x={30} y={18} w={360} />
      <rect x={196} y={210} width={28} height={14} className="fill-slate-300" />
      <rect x={166} y={224} width={88} height={6} rx={3} className="fill-slate-300" />
    </Scene>
  );
}

/** A tablet held landscape: the same layout as a computer. */
export function TabletLandscape() {
  return (
    <Scene w={420} h={210} bg="plain">
      <rect x={30} y={14} width={360} height={190} rx={14} className="fill-slate-800" />
      <EditorScreen x={46} y={26} w={328} />
    </Scene>
  );
}

/** On a phone: the menu button and one strip across the top (Edit | Walk as icons, the categories, Search at its
 *  end), the floor opened zoomed out, zoom in the corner and the bottom bar under it all. */
export function MobileEditor() {
  return (
    <Scene w={420} h={250} bg="plain">
      <rect x={150} y={8} width={120} height={234} rx={18} className="fill-slate-800" />
      <svg x={156} y={14} width={108} height={222} viewBox="0 0 216 444">
        <rect width={216} height={444} rx={22} className="fill-slate-100" />
        {/* The floor, zoomed out to fit. */}
        <g transform="translate(18 110) scale(0.6)">
          <Room x={0} y={0} w={140} h={90} name="Desks" />
          <Desk x={14} y={30} />
          <Desk x={70} y={30} />
          <Plant cx={124} cy={76} />
          <Room x={150} y={0} w={150} h={90} name="Lounge" />
          <Rug cx={225} cy={50} />
          <Sofa x={205} y={34} />
          <Room x={0} y={104} w={300} h={110} name="Meeting Room" door="top" />
          <AvatarPad cx={150} cy={170} />
        </g>
        {/* The top row: the menu card, then the strip with Edit | Walk as icons, the categories and Search. */}
        <Card x={8} y={34} w={30} h={30}>
          <Icon prims={ICONS.menu} x={23} y={49} size={12} />
        </Card>
        <Card x={44} y={34} w={164} h={30}>
          <rect x={48} y={38} width={44} height={22} rx={5} className="fill-slate-100" />
          <rect x={49.5} y={39.5} width={21} height={19} rx={4} className="fill-brand-700" />
          <g className="help-art-as-drawn">
            <Icon prims={ICONS.edit} x={60} y={49} size={11} className="stroke-white" />
          </g>
          <Icon prims={ICONS.walk} x={81} y={49} size={11} className="stroke-slate-500" />
          {(['write', 'rooms', 'seats', 'perks'] as const).map((k, i) => (
            <Icon key={k} prims={ICONS[k]} x={106 + i * 20} y={49} size={11} />
          ))}
          <rect x={184} y={38} width={20} height={22} rx={5} className="fill-brand-50" />
          <Icon prims={ICONS.search} x={194} y={49} size={11} className="stroke-brand-700" />
        </Card>
        <Card x={166} y={364} w={42} h={30}>
          <Icon prims={[{ t: 'path', d: 'M5 12h14M12 5v14' }]} x={187} y={379} size={11} />
        </Card>
        <BottomBar y={404} w={216} tabs={['Office']} compact />
      </svg>
      {/* A finger tapping the floor. */}
      <circle
        cx={196}
        cy={150}
        r={10}
        className="fill-brand-500/15 stroke-brand-500"
        strokeWidth={1.25}
      />
      <circle cx={196} cy={150} r={3.5} className="fill-brand-500" />
    </Scene>
  );
}
