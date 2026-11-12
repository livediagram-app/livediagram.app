// Calls illustrations (docs/specs/018-help/help-app.md): the call group on the Call dock at the bottom centre, the
// microphone's states, earshot and the talking bars, and the camera and screen bubbles. Calls cannot run without
// the Realtime secrets, so these are drawn rather than shot, from the call components' own words and tones:
// apps/editor/components/calls/CallStripGroup.tsx (the strip and its hover cards), TalkingBars.tsx
// ("Sam is talking, walk over"), MediaBubble.tsx ("Maximise Sam's Camera"), CallBubbles.tsx (a close group's row
// and tails), MaximisedBubble.tsx (Restore) and
// ScreenShareStripGroup.tsx (Sharing and Stop Sharing, after the call group on the Call dock while you share) and
// CallDock.tsx (the card). Icons are the strip's own Lucide glyphs.

import {
  lucideMic,
  lucideMicOff,
  lucideScreenShare,
  lucideVideoOff,
} from '@liveworkspace/icons/lucide';
import { Cursor, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { PixelCharacter } from './pixel-character';
import { Card, DockRow, RowLabel, SEG_H, type Seg, Strip, TalkingBars } from './calls-parts';

// The camera and screen bubbles live in calls-bubbles.tsx.
export { CallBubbles, MaximisedBubble, SharingAndVideoPaused } from './calls-bubbles';

/** The Call dock at the bottom centre: the microphone muted when you walk in, then unmuted, with Camera and Share. No
 *  Join, no Leave. */
export function CallStrip() {
  return (
    <Scene w={420} h={168}>
      <RowLabel y={24}>Walking in: muted</RowLabel>
      <DockRow
        y={38}
        segs={[
          { name: 'Muted', icon: lucideMicOff, tone: 'muted' },
          { name: 'Camera', icon: lucideVideoOff },
          { name: 'Share', icon: lucideScreenShare },
        ]}
      />
      <RowLabel y={102}>After you unmute</RowLabel>
      <DockRow
        y={116}
        segs={[
          { name: 'Mic', icon: lucideMic, tone: 'live', ring: true },
          { name: 'Camera', icon: lucideVideoOff },
          { name: 'Share', icon: lucideScreenShare },
        ]}
      />
    </Scene>
  );
}

const MIC_STATES: { seg: Seg; line: string }[] = [
  {
    seg: { name: 'Mic', icon: lucideMic, tone: 'live', ring: true, w: 118 },
    line: 'Somebody near you hears you.',
  },
  {
    seg: { name: 'Mic', icon: lucideMic, w: 118 },
    line: 'Your mic is on, but nobody is close enough.',
  },
  { seg: { name: 'Muted', icon: lucideMicOff, tone: 'muted', w: 118 }, line: 'Nobody hears you.' },
  {
    seg: { name: 'Blocked', icon: lucideMicOff, tone: 'warn', w: 118 },
    line: 'The browser refused the mic. You still hear.',
  },
  {
    seg: { name: 'Mic Off', icon: lucideMic, w: 118 },
    line: 'You just unmuted and it is still opening.',
  },
];

/** The microphone's five states, each as the Call dock names it on a desktop, with what it means. */
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
