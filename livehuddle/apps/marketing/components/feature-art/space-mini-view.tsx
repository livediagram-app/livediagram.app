// Keep the Space in view (docs/specs/008-canvas/avatar-mode.md "The mini view"): the Mini View's window as the editor
// draws it (apps/editor/components/calls/mini-view/), each row's bust the sprite's own front head. The motion is the
// shared card keyframes (app/feature-art/canvas.css), which settle under reduced motion.

import { HeadFront } from '@livehuddle/avatar/components/avatar-sprite-head';
import { SKIN_DARK } from '@livehuddle/avatar/components/avatar-sprite-palette';
import type { AvatarConfig } from '@livehuddle/avatar/config';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';
import { TEAM_POD } from '../hero-space-cast';
import { PANEL, STRONG, BODY, SUBTLE, Close, Button } from './space-panel-parts';
import { at } from './space-shot';

const look = (name: string): { config: AvatarConfig; colour: string } => {
  const member = TEAM_POD.cast.find((m) => m.name === name)!;
  return { config: member.config, colour: member.colour };
};

/** A row's bust (MiniViewRow's MiniBust): the sprite's front head over shoulders in the person's colour, in a circle. */
function Bust({
  x,
  y,
  name,
  speaking,
}: {
  x: number;
  y: number;
  name: string;
  speaking?: boolean;
}) {
  const { config, colour } = look(name);
  return (
    <g>
      {speaking ? (
        <circle cx={x} cy={y} r={5.6} fill="none" stroke={colour} strokeWidth={0.9} />
      ) : null}
      <clipPath id={`fa-bust-${name}`}>
        <circle cx={x} cy={y} r={4.6} />
      </clipPath>
      <circle cx={x} cy={y} r={4.6} className="fill-slate-100 dark:fill-slate-800" />
      <g clipPath={`url(#fa-bust-${name})`}>
        <svg
          x={x - 4.4}
          y={y - 4}
          width={8.8}
          height={8.8}
          viewBox="1 0 14 14"
          shapeRendering="crispEdges"
        >
          <rect x={6} y={9} width={4} height={1} fill={SKIN_DARK} />
          <rect x={3} y={10} width={10} height={4} fill={colour} />
          <rect x={2} y={11} width={12} height={3} fill={colour} />
          <HeadFront gender={config.gender} hair={config.hair} colour={config.hairColour} />
        </svg>
      </g>
    </g>
  );
}

/** The canvas's three talking bars, in the speaker's colour. */
function Bars({ x, y, colour }: { x: number; y: number; colour: string }) {
  return (
    <g>
      {[3, 6, 4].map((h, i) => (
        <rect
          key={i}
          x={x + i * 2.2}
          y={y - h / 2}
          width={1.4}
          height={h}
          rx={0.7}
          fill={colour}
          className="fa-a-pop"
          style={at(0.6 + i * 0.12)}
        />
      ))}
    </g>
  );
}

/**
 * Keep the Space in view: the Mini View's window, popped out over the notes you are working on in another tab. In
 * the Space and its count with Back to Space, a knock with Let In and Not Now, the people you hear under Near You
 * (Priya talking), and your microphone and camera at its foot.
 */
export function MiniViewArt() {
  const priya = look('Priya');
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {/* The other tab: a browser window on the notes you are writing. */}
        <rect x={10} y={6} width={200} height={90} rx={5} strokeWidth={0.8} className={PANEL} />
        <rect
          x={10.4}
          y={6.4}
          width={199.2}
          height={11}
          rx={4.6}
          className="fill-slate-100 dark:fill-slate-800"
        />
        <rect
          x={16}
          y={9}
          width={54}
          height={8.4}
          rx={2}
          className="fill-white dark:fill-slate-900"
        />
        <text x={20} y={15} fontSize={4.8} fontWeight={600} className={STRONG}>
          Launch notes
        </text>
        <text x={76} y={15} fontSize={4.8} className={SUBTLE}>
          Team Office
        </text>
        <text x={24} y={32} fontSize={7.4} fontWeight={700} className={STRONG}>
          Launch notes
        </text>
        {[40, 47, 54, 64, 71, 78].map((y, i) => (
          <rect
            key={y}
            x={24}
            y={y}
            width={[118, 130, 92, 124, 108, 70][i]}
            height={3}
            rx={1.5}
            className="fill-slate-200 dark:fill-slate-700"
          />
        ))}
        {/* The Mini View, on top of every window. */}
        <g className="fa-a-pop" style={at(0.2)}>
          <rect
            x={164}
            y={3}
            width={126}
            height={92}
            rx={5}
            strokeWidth={0.8}
            className={`${PANEL} drop-shadow-md`}
          />
          <rect
            x={164.4}
            y={3.4}
            width={125.2}
            height={9}
            rx={4.6}
            className="fill-slate-100 dark:fill-slate-800"
          />
          <text x={170} y={9.6} fontSize={4.6} fontWeight={600} className={BODY}>
            Mini View
          </text>
          <Close x={283} y={7.9} />
          {/* The header: In the Space, its count, Back to Space. */}
          <text x={170} y={21.4} fontSize={5.8} fontWeight={700} className={STRONG}>
            In the Space
          </text>
          <rect
            x={205}
            y={16.6}
            width={9}
            height={6.4}
            rx={3.2}
            className="fill-slate-100 dark:fill-slate-800"
          />
          <text
            x={209.5}
            y={21.2}
            fontSize={4.6}
            fontWeight={700}
            textAnchor="middle"
            className={BODY}
          >
            6
          </text>
          <path
            d="M241 21.4 L244.6 17.8 M242 17.8 H244.6 V20.4"
            fill="none"
            strokeWidth={0.8}
            strokeLinecap="round"
            className="stroke-slate-600 dark:stroke-slate-300"
          />
          <text
            x={247}
            y={21.4}
            fontSize={5}
            fontWeight={600}
            className="fill-slate-700 dark:fill-slate-200"
          >
            Back to Space
          </text>
          <path
            d="M164 26 H290"
            strokeWidth={0.8}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          {/* A knock that reached you. */}
          <g className="fa-a-pop" style={at(0.9)}>
            <rect
              x={168}
              y={29}
              width={118}
              height={21}
              rx={3}
              strokeWidth={0.6}
              className="fill-amber-50 stroke-amber-200 dark:fill-amber-500/15 dark:stroke-amber-400/30"
            />
            <text
              x={172}
              y={36.4}
              fontSize={5.4}
              fontWeight={600}
              className="fill-amber-900 dark:fill-amber-100"
            >
              Ana is knocking
            </text>
            <Button x={172} y={39} w={22} h={8} text="Let In" solid />
            <Button x={197} y={39} w={26} h={8} text="Not Now" />
          </g>
          {/* Near You: the people you hear. */}
          <text
            x={170}
            y={57.4}
            fontSize={4.4}
            fontWeight={600}
            letterSpacing={0.3}
            className={BODY}
          >
            NEAR YOU
          </text>
          <Bust x={175} y={65} name="Priya" speaking />
          <text x={184} y={66.8} fontSize={5.6} fontWeight={500} className={STRONG}>
            Priya
          </text>
          <Bars x={276} y={65} colour={priya.colour} />
          <Bust x={175} y={76.5} name="Sam" />
          <text x={184} y={75.6} fontSize={5.6} fontWeight={500} className={STRONG}>
            Sam
          </text>
          <circle cx={185.4} cy={80.2} r={1.1} className="fill-amber-500" />
          <text x={188} y={81.6} fontSize={4.4} className={BODY}>
            Away
          </text>
          {/* Your microphone and camera, the Call dock's own buttons. */}
          <path
            d="M164 84.5 H290"
            strokeWidth={0.8}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          <rect
            x={214}
            y={86.4}
            width={11}
            height={7}
            rx={2}
            className="fill-slate-100 dark:fill-slate-800"
          />
          <rect
            x={218.4}
            y={87.6}
            width={2.2}
            height={3.4}
            rx={1.1}
            className="fill-slate-700 dark:fill-slate-200"
          />
          <path
            d="M217.4 90.2 A2.1 2.1 0 0 0 221.6 90.2 M219.5 92.3 V93"
            fill="none"
            strokeWidth={0.6}
            className="stroke-slate-700 dark:stroke-slate-200"
          />
          <rect
            x={229}
            y={86.4}
            width={11}
            height={7}
            rx={2}
            className="fill-slate-100 dark:fill-slate-800"
          />
          <rect
            x={231.6}
            y={88.4}
            width={4}
            height={3}
            rx={0.6}
            className="fill-slate-700 dark:fill-slate-200"
          />
          <path
            d="M235.6 89.3 L237.6 88.3 V91.3 L235.6 90.3 Z"
            className="fill-slate-700 dark:fill-slate-200"
          />
        </g>
      </svg>
    </Frame>
  );
}
