// Calls illustrations (docs/specs/018-help/help-app.md): the call strip in the bottom-right cluster, the
// microphone's states, earshot and the talking bars, and the camera and screen bubbles. Calls cannot run without
// the Realtime secrets, so these are drawn rather than shot, from the call components' own words and tones:
// apps/editor/components/calls/CallClusterButton.tsx (the strip and its hover cards), TalkingBars.tsx
// ("Sam is talking, walk over"), MediaBubble.tsx ("Maximise Sam's Camera"), CallBubbles.tsx (a close group's row
// and tails), MaximisedBubble.tsx (Restore) and
// ScreenShareBar.tsx (Stop Sharing). Icons are the strip's own Lucide glyphs.

import type { ReactNode } from 'react';
import {
  lucideHeadphoneOff,
  lucideMaximize2,
  lucideMic,
  lucideMicOff,
  lucideMinimize2,
  lucidePause,
  lucideScreenShare,
  lucideScreenShareOff,
  lucideUser,
  lucideVideo,
  lucideVideoOff,
} from '@liveworkspace/icons/lucide';
import type { IconPrim } from '@liveworkspace/icons';
import { Prims } from '@livehuddle/ui';
import { Cursor, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { PixelCharacter } from './selection-modes';

// --- The strip ----------------------------------------------------------------

type Tone = 'rest' | 'live' | 'warn' | 'muted';

const TONE_INK: Record<Tone, { stroke: string; fill: string }> = {
  rest: { stroke: 'stroke-slate-600', fill: 'fill-slate-600' },
  live: { stroke: 'stroke-brand-700', fill: 'fill-brand-700' },
  warn: {
    stroke: 'stroke-amber-600 dark:stroke-amber-300',
    fill: 'fill-amber-600 dark:fill-amber-300',
  },
  muted: {
    stroke: 'stroke-rose-600 dark:stroke-rose-300',
    fill: 'fill-rose-600 dark:fill-rose-300',
  },
};

/** A Lucide glyph centred on (cx, cy) at `size` units, stroked in `className`. */
function Icon({
  prims,
  cx,
  cy,
  size = 14,
  className = 'stroke-slate-600',
}: {
  prims: readonly IconPrim[];
  cx: number;
  cy: number;
  size?: number;
  className?: string;
}) {
  const s = size / 24;
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${s})`}
      className={className}
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Prims prims={prims} />
    </g>
  );
}

const SEG_H = 34;

type Seg = {
  name: string;
  icon?: readonly IconPrim[];
  tone?: Tone;
  ring?: boolean;
  w?: number;
};

const segWidth = (s: Seg) => s.w ?? (s.icon ? Math.round(s.name.length * 6 + 36) : 28);

/** A cluster strip: a white frame of segments parted by hairlines, each its icon and its name (a wide desktop's
 *  look). A segment with no icon is the strip's `?`. Returns the frame at (x, y). */
function Strip({ x, y, segs }: { x: number; y: number; segs: Seg[] }) {
  const widths = segs.map(segWidth);
  const total = widths.reduce((a, b) => a + b, 0);
  // Each segment's left edge: the frame's, plus the widths before it.
  const lefts = widths.map((_, i) => x + widths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={total}
        height={SEG_H}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {segs.map((s, i) => {
        const sx = lefts[i] ?? x;
        const w = widths[i] ?? 0;
        const ink = TONE_INK[s.tone ?? 'rest'];
        return (
          <g key={s.name}>
            {i > 0 && (
              <line
                x1={sx}
                y1={y}
                x2={sx}
                y2={y + SEG_H}
                className="stroke-slate-100"
                strokeWidth={1}
              />
            )}
            {s.ring && (
              <rect
                x={sx + 4}
                y={y + 4}
                width={w - 8}
                height={SEG_H - 8}
                rx={5}
                className="fill-none stroke-brand-400"
                strokeWidth={1.6}
                opacity={0.7}
              />
            )}
            {s.icon ? (
              <>
                <Icon prims={s.icon} cx={sx + 17} cy={y + SEG_H / 2} className={ink.stroke} />
                <Label
                  x={sx + 28}
                  y={y + SEG_H / 2 + 1}
                  size={10.5}
                  weight={600}
                  className={ink.fill}
                >
                  {s.name}
                </Label>
              </>
            ) : (
              <Label
                x={sx + w / 2}
                y={y + SEG_H / 2 + 1}
                anchor="middle"
                size={12}
                weight={700}
                tone="muted"
              >
                ?
              </Label>
            )}
          </g>
        );
      })}
    </g>
  );
}

const HELP: Seg = { name: '?' };
const AVATAR: Seg = { name: 'Avatar', icon: lucideUser };
const stripWidth = (segs: Seg[]) => segs.map(segWidth).reduce((a, b) => a + b, 0);

/** Right-aligns a strip and the Avatar button beside it at `right`, as the bottom-right cluster lays them out. */
function ClusterRow({ y, segs, right = 404 }: { y: number; segs: Seg[]; right?: number }) {
  const avatarX = right - segWidth(AVATAR);
  return (
    <g>
      <Strip x={avatarX - 8 - stripWidth(segs)} y={y} segs={segs} />
      <Strip x={avatarX} y={y} segs={[AVATAR]} />
    </g>
  );
}

function RowLabel({ y, children }: { y: number; children: ReactNode }) {
  return (
    <Label x={16} y={y} size={10} weight={600} tone="muted">
      {children}
    </Label>
  );
}

/** The call strip beside Avatar: Join Audio before you join, then the microphone, Camera, Share and Leave. */
export function CallStrip() {
  return (
    <Scene w={420} h={168}>
      <RowLabel y={24}>Before you join</RowLabel>
      <ClusterRow y={38} segs={[{ name: 'Join Audio', icon: lucideMic }, HELP]} />
      <RowLabel y={102}>Once you are in</RowLabel>
      <ClusterRow
        y={116}
        segs={[
          { name: 'Live', icon: lucideMic, tone: 'live', ring: true },
          { name: 'Camera', icon: lucideVideoOff },
          { name: 'Share', icon: lucideScreenShare },
          { name: 'Leave', icon: lucideHeadphoneOff },
          HELP,
        ]}
      />
    </Scene>
  );
}

const MIC_STATES: { seg: Seg; line: string }[] = [
  {
    seg: { name: 'Live', icon: lucideMic, tone: 'live', ring: true, w: 118 },
    line: 'Somebody near you hears you.',
  },
  {
    seg: { name: 'Nobody Near', icon: lucideMic, w: 118 },
    line: 'Your mic is on, but nobody is close enough.',
  },
  { seg: { name: 'Muted', icon: lucideMicOff, tone: 'muted', w: 118 }, line: 'Nobody hears you.' },
  {
    seg: { name: 'Mic Blocked', icon: lucideMicOff, tone: 'warn', w: 118 },
    line: 'The browser refused the mic. You still hear.',
  },
  {
    seg: { name: 'Mic Off', icon: lucideMic, w: 118 },
    line: 'Nobody else is on this tab, so it is closed.',
  },
];

/** The microphone's five states, each as the strip shows it, with what it means. */
export function MicStates() {
  return (
    <Scene w={420} h={222} bg="plain">
      {MIC_STATES.map(({ seg, line }, i) => {
        const y = 12 + i * 41;
        return (
          <g key={seg.name}>
            <Strip x={16} y={y} segs={[seg]} />
            <Label x={148} y={y + SEG_H / 2 + 1} size={10.5} tone="body">
              {line}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

// --- On the board ---------------------------------------------------------------

/** Three talking bars, bottoms on `y`, centred on `cx`, in the speaker's colour. */
function TalkingBars({
  cx,
  y,
  hue,
  faint = false,
}: {
  cx: number;
  y: number;
  hue: 'emerald' | 'violet' | 'brand';
  faint?: boolean;
}) {
  const fill = { emerald: 'fill-emerald-500', violet: 'fill-violet-500', brand: 'fill-brand-500' }[
    hue
  ];
  const heights = [6, 11, 8];
  return (
    <g opacity={faint ? 0.5 : 1}>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={cx - 6.5 + i * 5}
          y={y - h}
          width={3}
          height={h}
          rx={1.5}
          className={fill}
        />
      ))}
    </g>
  );
}

/** A drawn hover card: a bold title, and a line under it when there is one. */
function Card({
  x,
  y,
  w,
  title,
  line,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  line?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={line ? 42 : 26}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={x + 10} y={y + 14} size={10.5} weight={700} tone="strong">
        {title}
      </Label>
      {line && (
        <Label x={x + 10} y={y + 30} size={9.5} tone="muted">
          {line}
        </Label>
      )}
    </g>
  );
}

// PixelCharacter at its default size stands 69 units tall, and its name chip sits 22 above its head.
const CHIP_TOP = 69 + 22;

/** Earshot: your character, the hearing range round it with Sam inside (heard, bright bars) and Priya out of it,
 *  her bars faint, hovered: "Priya is talking, walk over". */
export function Earshot() {
  const you = { x: 120, y: 172 };
  const sam = { x: 186, y: 150 };
  const priya = { x: 344, y: 150 };
  return (
    <Scene w={420} h={262}>
      <circle
        cx={you.x}
        cy={you.y}
        r={84}
        className="fill-brand-50/40 stroke-brand-300"
        strokeWidth={1.5}
        strokeDasharray="5 5"
      />
      <Label x={you.x} y={you.y + 72} anchor="middle" size={10} weight={600} tone="accent">
        In earshot
      </Label>
      {/* The walk a press on the bars starts, stopping short of Priya. */}
      <path
        d={`M${you.x + 14} ${you.y - 4} Q 250 200 ${priya.x - 52} ${priya.y + 2}`}
        className="stroke-brand-300"
        strokeWidth={2}
        fill="none"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      <PixelCharacter fx={you.x} fy={you.y} />
      <PixelCharacter fx={sam.x} fy={sam.y} shirt="emerald" name="Sam" hair="fill-slate-800" />
      <TalkingBars cx={sam.x} y={sam.y - CHIP_TOP - 4} hue="emerald" />
      <PixelCharacter fx={priya.x} fy={priya.y} shirt="violet" name="Priya" hair="fill-slate-900" />
      <rect
        x={priya.x - 12}
        y={priya.y - CHIP_TOP - 20}
        width={24}
        height={18}
        rx={4}
        className="fill-white/80"
      />
      <TalkingBars cx={priya.x} y={priya.y - CHIP_TOP - 6} hue="violet" faint />
      <Card x={236} y={10} w={172} title="Priya is talking, walk over" />
      <Cursor x={priya.x + 8} y={priya.y - CHIP_TOP - 12} />
    </Scene>
  );
}

// A bubble is 16:9; drawn 96 wide.
const BUBBLE_W = 96;
const BUBBLE_H = 54;

/** A camera bubble's picture: a head and shoulders on the person's colour, the same in both appearances. */
function CameraPicture({ x, y, hue }: { x: number; y: number; hue: 'emerald' | 'violet' }) {
  const tint = { emerald: 'fill-emerald-500/35', violet: 'fill-violet-500/35' }[hue];
  return (
    <g className="help-art-as-drawn">
      <rect x={x} y={y} width={BUBBLE_W} height={BUBBLE_H} rx={9} className="fill-slate-800" />
      <rect x={x} y={y} width={BUBBLE_W} height={BUBBLE_H} rx={9} className={tint} />
      <circle cx={x + BUBBLE_W / 2} cy={y + 22} r={10} className="fill-amber-200" />
      <path
        d={`M${x + BUBBLE_W / 2 - 22} ${y + BUBBLE_H} q0 -18 22 -18 q22 0 22 18 z`}
        className="fill-slate-300"
      />
    </g>
  );
}

/** A screen bubble's picture: a shared window of slides, with the small screen badge in its corner. */
function ScreenPicture({ x, y }: { x: number; y: number }) {
  return (
    <g className="help-art-as-drawn">
      <rect x={x} y={y} width={BUBBLE_W} height={BUBBLE_H} rx={9} className="fill-slate-800" />
      <rect
        x={x + 8}
        y={y + 6}
        width={BUBBLE_W - 16}
        height={BUBBLE_H - 12}
        rx={3}
        className="fill-white"
      />
      <rect
        x={x + 8}
        y={y + 6}
        width={BUBBLE_W - 16}
        height={7}
        rx={2}
        className="fill-slate-200"
      />
      <rect x={x + 16} y={y + 19} width={40} height={4} rx={2} className="fill-slate-400" />
      <rect x={x + 16} y={y + 27} width={56} height={3} rx={1.5} className="fill-slate-300" />
      <rect x={x + 16} y={y + 33} width={48} height={3} rx={1.5} className="fill-slate-300" />
      <rect
        x={x + 3}
        y={y + BUBBLE_H - 15}
        width={16}
        height={12}
        rx={3}
        className="fill-slate-900/80"
      />
      <Icon
        prims={lucideScreenShare}
        cx={x + 11}
        cy={y + BUBBLE_H - 9}
        size={9}
        className="stroke-white"
      />
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
      rx={9}
      className={`fill-none ${hue === 'emerald' ? 'stroke-emerald-500' : 'stroke-violet-500'}`}
      strokeWidth={2}
    />
  );
}

// Bubbles of people standing close share a row (apps/editor/lib/calls/bubble-layout.ts), drawn at 96/120 of the
// editor's canvas px: the gap between bubbles, and how far a tail keeps from a row's ends.
const BUBBLE_GAP = 6;
const TAIL_INSET = 11;

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
  const by = sam.y - CHIP_TOP - 8 - BUBBLE_H;
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
      <PixelCharacter fx={sam.x} fy={sam.y} shirt="emerald" name="Sam" hair="fill-slate-800" />
      <PixelCharacter fx={priya.x} fy={priya.y} shirt="violet" name="Priya" hair="fill-slate-900" />
      <Card x={samX} y={by - 34} w={136} title="Maximise Sam's Camera" />
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

/** Sharing a screen: the bar only the sharer sees, with Stop Sharing, over the strip with the camera on and the
 *  share pressed; under audio only, the strip's one calm Video Paused. */
export function SharingAndVideoPaused() {
  return (
    <Scene w={420} h={206}>
      <g className="help-art-as-drawn">
        <rect
          x={70}
          y={12}
          width={280}
          height={32}
          rx={16}
          className="fill-slate-900 stroke-white/10"
          strokeWidth={1}
        />
        <circle cx={88} cy={28} r={4} className="fill-rose-500" />
        <Label x={100} y={29} size={10.5} weight={600} className="fill-white">
          You are sharing your screen
        </Label>
        <rect x={252} y={16} width={94} height={24} rx={12} className="fill-rose-500" />
        <Icon prims={lucideScreenShareOff} cx={265} cy={28} size={11} className="stroke-white" />
        <Label x={274} y={29} size={10} weight={700} className="fill-white">
          Stop Sharing
        </Label>
      </g>
      <RowLabel y={78}>Sharing, camera on</RowLabel>
      <ClusterRow
        y={90}
        segs={[
          { name: 'Live', icon: lucideMic, tone: 'live', ring: true },
          { name: 'Camera', icon: lucideVideo, tone: 'live' },
          { name: 'Sharing', icon: lucideScreenShareOff, tone: 'live' },
          { name: 'Leave', icon: lucideHeadphoneOff },
          HELP,
        ]}
      />
      <RowLabel y={146}>While video is paused</RowLabel>
      <ClusterRow
        y={158}
        segs={[
          { name: 'Live', icon: lucideMic, tone: 'live', ring: true },
          { name: 'Video Paused', icon: lucidePause },
          { name: 'Leave', icon: lucideHeadphoneOff },
          HELP,
        ]}
      />
    </Scene>
  );
}
