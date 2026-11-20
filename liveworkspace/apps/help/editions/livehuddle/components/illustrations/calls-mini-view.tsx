// The Mini View figure (liveworkspace/docs/specs/017-help/help-centre.md): the small window Pop Out opens, drawn from the editor's own
// words and tones: apps/editor/components/calls/PopOutSegment.tsx (the dock's last button),
// calls/mini-view/MiniView.tsx (In the Space and its count, Back to Space, Near You, the rows) and MiniViewControls.tsx
// (the microphone at the foot), with MiniViewTiles.tsx's camera tiles over the list. Calls cannot run without the Realtime secrets, so it is drawn rather than shot.

import {
  lucideArrowUpRight,
  lucideHand,
  lucideMic,
  lucidePictureInPicture2,
  lucideVideo,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { DockRow, Icon, TalkingBars } from './calls-parts';

const WIN = { x: 70, y: 84, w: 280, h: 310 };
const ROW_H = 26;

type Person = {
  name: string;
  shirt: string;
  hue: 'emerald' | 'violet' | 'brand';
  status?: string;
  talking?: boolean;
  hand?: boolean;
};

/** A person's bust in the sprite's pixels: their face and hair, shoulders in their presence colour. */
function Bust({ cx, cy, shirt, ring }: { cx: number; cy: number; shirt: string; ring?: string }) {
  return (
    <g shapeRendering="crispEdges" className="help-art-as-drawn">
      {ring && <circle cx={cx} cy={cy} r={11} className={ring} fill="none" strokeWidth={1.5} />}
      <rect x={cx - 7} y={cy + 3} width={14} height={6} rx={2} className={shirt} />
      <rect x={cx - 4} y={cy - 7} width={8} height={9} className="fill-amber-200" />
      <rect x={cx - 5} y={cy - 8} width={10} height={4} className="fill-amber-900" />
    </g>
  );
}

function Row({ y, person, you }: { y: number; person: Person; you?: boolean }) {
  const cx = WIN.x + 22;
  const cy = y + ROW_H / 2;
  const end = WIN.x + WIN.w - 18;
  return (
    <g>
      <Bust
        cx={cx}
        cy={cy}
        shirt={person.shirt}
        ring={person.talking ? 'stroke-emerald-500' : undefined}
      />
      <Label x={cx + 18} y={cy + 1} size={10.5} weight={600} tone="strong">
        {you ? 'You' : person.name}
      </Label>
      {person.status && (
        <g>
          <circle
            cx={cx + 18 + (you ? 22 : person.name.length * 6) + 10}
            cy={cy}
            r={2.5}
            className="fill-amber-500"
          />
          <Label
            x={cx + 18 + (you ? 22 : person.name.length * 6) + 17}
            y={cy + 1}
            size={9.5}
            tone="muted"
          >
            {person.status}
          </Label>
        </g>
      )}
      {person.talking && <TalkingBars cx={end - 6} y={cy + 6} hue={person.hue} />}
      {person.hand && (
        <g>
          <circle cx={end - 6} cy={cy} r={9} className="fill-amber-100 stroke-amber-400" />
          <Icon prims={lucideHand} cx={end - 6} cy={cy} size={11} className="stroke-amber-600" />
        </g>
      )}
    </g>
  );
}

/** Pop Out ends the Call dock, and the Mini View it opens: a small window on top with the cameras of the people you
 *  hear, who is in the Space (the people you hear first), Back to Space, and your microphone at the foot. */
export function MiniView() {
  const you: Person = { name: 'You', shirt: 'fill-brand-500', hue: 'brand' };
  const near: Person[] = [
    { name: 'Sam', shirt: 'fill-emerald-500', hue: 'emerald', talking: true },
    { name: 'Jo', shirt: 'fill-teal-500', hue: 'brand' },
  ];
  const space: Person[] = [
    { name: 'Priya', shirt: 'fill-violet-500', hue: 'violet', hand: true },
    { name: 'Alex', shirt: 'fill-rose-500', hue: 'violet', status: 'Focusing' },
  ];
  const head = WIN.y + 22;
  // The camera tiles of the people you hear, two to a row, over the list (MiniViewTiles.tsx).
  const tilesTop = head + 32;
  const tileW = (WIN.w - 30) / 2;
  const nearTop = tilesTop + 54;
  const spaceTop = nearTop + 16 + ROW_H * (near.length + 1) + 4;
  const foot = WIN.y + WIN.h - 34;
  return (
    <Scene w={420} h={408} bg="plain">
      <Label x={16} y={20} size={10} weight={600} tone="muted">
        The Call dock ends with Pop Out
      </Label>
      <DockRow
        y={26}
        segs={[
          { name: 'Mic', icon: lucideMic, tone: 'live', ring: true },
          { name: 'Camera', icon: lucideVideo },
          { name: 'Pop Out', icon: lucidePictureInPicture2, divider: true },
        ]}
      />
      {/* The window: a title bar, then the view. */}
      <rect
        x={WIN.x}
        y={WIN.y}
        width={WIN.w}
        height={WIN.h}
        rx={9}
        className="fill-white stroke-slate-300"
        strokeWidth={1.4}
      />
      <path
        d={`M${WIN.x} ${WIN.y + 20} V${WIN.y + 9} a9 9 0 0 1 9 -9 H${WIN.x + WIN.w - 9} a9 9 0 0 1 9 9 V${WIN.y + 20} Z`}
        className="fill-slate-100"
      />
      <Label x={WIN.x + 12} y={WIN.y + 11} size={9.5} weight={600} tone="muted">
        Mini View
      </Label>
      <Icon
        prims={lucideX}
        cx={WIN.x + WIN.w - 14}
        cy={WIN.y + 10}
        size={10}
        className="stroke-slate-500"
      />
      <Label x={WIN.x + 12} y={head + 12} size={11} weight={700} tone="strong">
        In the Space
      </Label>
      <rect
        x={WIN.x + 82}
        y={head + 3}
        width={20}
        height={17}
        rx={8.5}
        className="fill-slate-100"
      />
      <Label x={WIN.x + 92} y={head + 12} anchor="middle" size={9.5} weight={600} tone="body">
        5
      </Label>
      <Icon
        prims={lucideArrowUpRight}
        cx={WIN.x + WIN.w - 82}
        cy={head + 12}
        size={11}
        className="stroke-brand-700"
      />
      <Label x={WIN.x + WIN.w - 74} y={head + 12} size={10} weight={600} className="fill-brand-700">
        Back to Space
      </Label>
      <line
        x1={WIN.x}
        y1={head + 26}
        x2={WIN.x + WIN.w}
        y2={head + 26}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      {near.map((p, i) => {
        const tx = WIN.x + 10 + i * (tileW + 10);
        return (
          <g key={`tile-${p.name}`}>
            <rect
              x={tx}
              y={tilesTop}
              width={tileW}
              height={44}
              rx={6}
              className={`fill-slate-700 ${p.talking ? 'stroke-emerald-500' : 'stroke-slate-300'}`}
              strokeWidth={p.talking ? 2 : 1}
            />
            <Bust cx={tx + tileW / 2} cy={tilesTop + 20} shirt={p.shirt} />
            <rect
              x={tx + 5}
              y={tilesTop + 31}
              width={p.name.length * 6 + 10}
              height={10}
              rx={5}
              className="fill-slate-900/60"
            />
            <Label
              x={tx + 10}
              y={tilesTop + 36.5}
              size={7.5}
              weight={600}
              className="fill-white help-art-as-drawn"
            >
              {p.name}
            </Label>
          </g>
        );
      })}
      <Label x={WIN.x + 12} y={nearTop + 6} size={8.5} weight={700} tone="muted">
        NEAR YOU
      </Label>
      <Row y={nearTop + 12} person={you} you />
      {near.map((p, i) => (
        <Row key={p.name} y={nearTop + 12 + ROW_H * (i + 1)} person={p} />
      ))}
      <Label x={WIN.x + 12} y={spaceTop + 6} size={8.5} weight={700} tone="muted">
        IN THE SPACE
      </Label>
      {space.map((p, i) => (
        <Row key={p.name} y={spaceTop + 12 + ROW_H * i} person={p} />
      ))}
      {/* The foot: the dock's own microphone and camera. */}
      <line
        x1={WIN.x}
        y1={foot}
        x2={WIN.x + WIN.w}
        y2={foot}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={WIN.x + 10} y={foot + 6} width={70} height={22} rx={5} className="fill-brand-600" />
      <Icon prims={lucideMic} cx={WIN.x + 24} cy={foot + 17} size={13} className="stroke-white" />
      <Label x={WIN.x + 34} y={foot + 18} size={10} weight={600} className="fill-white">
        Mic
      </Label>
      <rect x={WIN.x + 86} y={foot + 6} width={84} height={22} rx={5} className="fill-brand-50" />
      <Icon
        prims={lucideVideo}
        cx={WIN.x + 100}
        cy={foot + 17}
        size={13}
        className="stroke-slate-600"
      />
      <Label x={WIN.x + 110} y={foot + 18} size={10} weight={600} className="fill-slate-600">
        Camera
      </Label>
    </Scene>
  );
}
