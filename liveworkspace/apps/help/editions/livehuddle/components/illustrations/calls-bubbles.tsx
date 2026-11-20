// The camera and screen bubbles (calls.tsx): a close group's row of bubbles with their tails
// (apps/editor/components/calls/CallBubbles.tsx, MediaBubble.tsx), one maximised (MaximisedBubble.tsx,
// Restore), and sharing with the video paused (ScreenShareStripGroup.tsx). Drawn rather than shot, since
// calls cannot run without the Realtime secrets.

import {
  lucideCircleDot,
  lucideMaximize2,
  lucideMic,
  lucideMinimize2,
  lucidePause,
  lucideScreenShare,
  lucideScreenShareOff,
  lucideVideo,
} from '@liveworkspace/icons/lucide';
import { Cursor, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { PixelCharacter } from './pixel-character';
import { Card, DockRow, Icon, RowLabel, TalkingBars } from './calls-parts';

// A bubble is 16:9, 180 canvas px wide in the editor; drawn 120 wide (the pictures below are laid out on 96 x 54 and
// scaled up by BUBBLE_K).
const BUBBLE_W = 120;
const BUBBLE_H = 68;
const BUBBLE_K = BUBBLE_W / 96;

/** A camera bubble's picture: a head and shoulders on the person's colour, the same in both appearances. */
function CameraPicture({ x, y, hue }: { x: number; y: number; hue: 'emerald' | 'violet' }) {
  const tint = { emerald: 'fill-emerald-500/35', violet: 'fill-violet-500/35' }[hue];
  return (
    <g className="help-art-as-drawn" transform={`translate(${x} ${y}) scale(${BUBBLE_K})`}>
      <rect x={0} y={0} width={96} height={54} rx={9} className="fill-slate-800" />
      <rect x={0} y={0} width={96} height={54} rx={9} className={tint} />
      <circle cx={48} cy={22} r={10} className="fill-amber-200" />
      <path d="M26 54 q0 -18 22 -18 q22 0 22 18 z" className="fill-slate-300" />
    </g>
  );
}

/** A screen bubble's picture: a shared window of slides, with the small screen badge in its corner. */
function ScreenPicture({ x, y }: { x: number; y: number }) {
  return (
    <g className="help-art-as-drawn" transform={`translate(${x} ${y}) scale(${BUBBLE_K})`}>
      <rect x={0} y={0} width={96} height={54} rx={9} className="fill-slate-800" />
      <rect x={8} y={6} width={80} height={42} rx={3} className="fill-white" />
      <rect x={8} y={6} width={80} height={7} rx={2} className="fill-slate-200" />
      <rect x={16} y={19} width={40} height={4} rx={2} className="fill-slate-400" />
      <rect x={16} y={27} width={56} height={3} rx={1.5} className="fill-slate-300" />
      <rect x={16} y={33} width={48} height={3} rx={1.5} className="fill-slate-300" />
      <rect x={3} y={39} width={16} height={12} rx={3} className="fill-slate-900/80" />
      <Icon prims={lucideScreenShare} cx={11} cy={45} size={9} className="stroke-white" />
    </g>
  );
}

function BubbleRing({ x, y, hue }: { x: number; y: number; hue: 'emerald' | 'violet' }) {
  return (
    <rect
      x={x}
      y={y}
      width={BUBBLE_W}
      height={BUBBLE_H}
      rx={11}
      className={`fill-none ${hue === 'emerald' ? 'stroke-emerald-500' : 'stroke-violet-500'}`}
      strokeWidth={2}
    />
  );
}

// Bubbles of people standing close share a row (apps/editor/lib/calls/bubble-layout.ts), drawn at 120/180 of the
// editor's canvas px (2/3): the gap between bubbles, and how far a tail keeps from a row's ends.
const BUBBLE_GAP = 5;
const TAIL_INSET = 9;

/** The tail under a person's bubbles, in their colour, slid back towards their head and held inside the row's ends
 *  (`tailShift`). Drawn before the bubbles, so only its lower half shows. */
function BubbleTail({
  left,
  width,
  head,
  y,
  hue,
}: {
  left: number;
  width: number;
  head: number;
  y: number;
  hue: 'emerald' | 'violet';
}) {
  const centre = left + width / 2;
  const reach = width / 2 - TAIL_INSET;
  const x = centre + Math.min(reach, Math.max(-reach, head - centre));
  return (
    <path
      d={`M${x} ${y - 5} l5 5 l-5 5 l-5 -5 z`}
      className={hue === 'emerald' ? 'fill-emerald-500' : 'fill-violet-500'}
    />
  );
}

/** Two people talking close: Sam's camera, hovered ("Maximise Sam's Camera", its maximise mark showing), and Priya's
 *  camera beside her shared screen, laid out in one row centred on the pair, each person's tail pointing at them. */
export function CallBubbles() {
  const sam = { x: 176, y: 236 };
  const priya = { x: 244, y: 236 };
  // Just over the head (32 canvas px above it, 21 here), clear of the name chip, which a bubble covers.
  const by = sam.y - 69 - 21 - BUBBLE_H;
  const priyaWidth = BUBBLE_W * 2 + BUBBLE_GAP;
  const rowWidth = BUBBLE_W + BUBBLE_GAP + priyaWidth;
  const samX = (sam.x + priya.x) / 2 - rowWidth / 2;
  const priyaCam = samX + BUBBLE_W + BUBBLE_GAP;
  const priyaScreen = priyaCam + BUBBLE_W + BUBBLE_GAP;
  return (
    <Scene w={420} h={248}>
      <BubbleTail left={samX} width={BUBBLE_W} head={sam.x} y={by + BUBBLE_H} hue="emerald" />
      <BubbleTail
        left={priyaCam}
        width={priyaWidth}
        head={priya.x}
        y={by + BUBBLE_H}
        hue="violet"
      />
      <CameraPicture x={samX} y={by} hue="emerald" />
      <BubbleRing x={samX} y={by} hue="emerald" />
      {/* The maximise mark a hovered bubble shows in its corner. */}
      <g className="help-art-as-drawn">
        <rect
          x={samX + BUBBLE_W - 20}
          y={by + 4}
          width={16}
          height={16}
          rx={4}
          className="fill-slate-900/70"
        />
        <Icon
          prims={lucideMaximize2}
          cx={samX + BUBBLE_W - 12}
          cy={by + 12}
          size={10}
          className="stroke-white"
        />
      </g>
      <CameraPicture x={priyaCam} y={by} hue="violet" />
      <BubbleRing x={priyaCam} y={by} hue="violet" />
      <ScreenPicture x={priyaScreen} y={by} />
      <BubbleRing x={priyaScreen} y={by} hue="violet" />
      {/* Sam is talking: his equaliser rides his bubble's top-left corner, not his head. */}
      <rect x={samX + 4} y={by + 4} width={22} height={18} rx={5} className="fill-slate-950/65" />
      <TalkingBars cx={samX + 15} y={by + 18} hue="emerald" />
      <PixelCharacter fx={sam.x} fy={sam.y} shirt="emerald" name="Sam" hair="fill-slate-800" />
      <PixelCharacter fx={priya.x} fy={priya.y} shirt="violet" name="Priya" hair="fill-slate-900" />
      <Card x={samX} y={by - 34} w={150} title="Maximise Sam's Camera" />
      <Cursor x={samX + BUBBLE_W - 30} y={by + 24} />
    </Scene>
  );
}

/** A maximised bubble: a large panel over the dimmed canvas, its name and Restore in a bar above the picture. */
export function MaximisedBubble() {
  const px = 60;
  const pw = 300;
  const barH = 30;
  const picH = Math.round((pw * 9) / 16);
  const py = 16;
  return (
    <Scene w={420} h={py * 2 + barH + picH}>
      <PixelCharacter fx={44} fy={200} shirt="emerald" name="Sam" hair="fill-slate-800" />
      <PixelCharacter fx={388} fy={210} shirt="violet" name="Priya" hair="fill-slate-900" />
      <g className="help-art-as-drawn">
        <rect x={0} y={0} width={420} height={py * 2 + barH + picH} className="fill-slate-900/45" />
        <rect x={px} y={py} width={pw} height={barH + picH} rx={12} className="fill-slate-900" />
        <circle cx={px + 14} cy={py + barH / 2} r={4} className="fill-violet-500" />
        <Label x={px + 24} y={py + barH / 2 + 1} size={11} weight={600} className="fill-white">
          Priya&apos;s Screen
        </Label>
        <rect x={px + pw - 76} y={py + 5} width={68} height={20} rx={6} className="fill-white/15" />
        <Icon
          prims={lucideMinimize2}
          cx={px + pw - 64}
          cy={py + barH / 2}
          size={11}
          className="stroke-white"
        />
        <Label x={px + pw - 54} y={py + barH / 2 + 1} size={10} weight={500} className="fill-white">
          Restore
        </Label>
        {/* The shared window, letterboxed in the picture. */}
        <rect
          x={px + 18}
          y={py + barH + 10}
          width={pw - 36}
          height={picH - 20}
          rx={4}
          className="fill-white"
        />
        <rect
          x={px + 18}
          y={py + barH + 10}
          width={pw - 36}
          height={12}
          rx={3}
          className="fill-slate-200"
        />
        <rect
          x={px + 36}
          y={py + barH + 36}
          width={120}
          height={8}
          rx={3}
          className="fill-slate-500"
        />
        <rect
          x={px + 36}
          y={py + barH + 54}
          width={170}
          height={5}
          rx={2.5}
          className="fill-slate-300"
        />
        <rect
          x={px + 36}
          y={py + barH + 66}
          width={150}
          height={5}
          rx={2.5}
          className="fill-slate-300"
        />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={px + 196 + i * 18}
            y={py + barH + 132 - (i + 1) * 18}
            width={12}
            height={(i + 1) * 18}
            rx={2}
            className={['fill-violet-400', 'fill-violet-500', 'fill-emerald-500'][i]}
          />
        ))}
      </g>
    </Scene>
  );
}

/** Sharing a screen: Sharing and Stop Sharing join the Call dock after the call group, behind a divider, with the
 *  camera on; under audio only, the dock's one calm Video Paused. */
export function SharingAndVideoPaused() {
  return (
    <Scene w={420} h={150}>
      <RowLabel y={22}>While you share, camera on</RowLabel>
      <DockRow
        y={34}
        segs={[
          { name: 'Mic', icon: lucideMic, tone: 'live', ring: true },
          { name: 'Camera', icon: lucideVideo, tone: 'live' },
          { name: 'Sharing', icon: lucideCircleDot, tone: 'muted', divider: true },
          { name: 'Stop Sharing', icon: lucideScreenShareOff, tone: 'muted' },
        ]}
      />
      <RowLabel y={90}>While video is paused</RowLabel>
      <DockRow
        y={102}
        segs={[
          { name: 'Mic', icon: lucideMic, tone: 'live', ring: true },
          { name: 'Video Paused', icon: lucidePause },
        ]}
      />
    </Scene>
  );
}
