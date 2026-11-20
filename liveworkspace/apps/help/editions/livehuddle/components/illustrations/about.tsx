// About-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the conceptual articles, what
// livehuddle is, who it serves, why use it, and what open source means.
// Composed only from the shared primitives so the house style holds. Several
// About figures reuse canvas / collaboration scenes (CanvasOverview,
// LiveCursors) rather than redrawing them.

import { Scene, Arrow, Label } from '@liveworkspace/help-site/art/primitives';
import { AvatarPad, Desk, Plant, Room, Sofa, Sticky } from './space-furniture';
import { PixelCharacter } from './pixel-character';

/** The open canvas with no sign-in wall: a Space already in use, and a
 *  dismissed "Sign in" gate crossed out to the side. */
export function OpenCanvas() {
  return (
    <Scene w={420} h={220}>
      <Room x={24} y={30} w={250} h={170} name="Team Room" />
      <Desk x={50} y={70} />
      <Desk x={104} y={70} />
      <Sticky x={180} y={60} w={58} h={50} label="Hello!" lines={2} />
      <AvatarPad cx={150} cy={160} />
      <PixelCharacter fx={150} fy={160} px={1.8} />

      {/* The blocked-out sign-in gate */}
      <g transform="translate(300 58)">
        <rect
          width={104}
          height={92}
          rx={10}
          className="fill-white stroke-slate-200"
          strokeWidth={0.75}
        />
        <Label x={52} y={22} anchor="middle" size={10} weight={700} tone="muted">
          Sign in
        </Label>
        <rect x={16} y={36} width={72} height={16} rx={5} className="fill-slate-100" />
        <rect x={16} y={58} width={72} height={20} rx={6} className="fill-brand-200" />
        {/* Crossed out */}
        <line
          x1={6}
          y1={6}
          x2={98}
          y2={86}
          className="stroke-rose-500"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      <Label x={352} y={166} anchor="middle" size={11} weight={700} tone="accent">
        Not required
      </Label>
    </Scene>
  );
}

/** Open source motif: a code window whose contents build the app you use,
 *  with an MIT-licence tag. */
export function OpenSource() {
  return (
    <Scene w={420} h={210} bg="plain">
      {/* Code window, dark in both appearances */}
      <g className="help-art-as-drawn">
        <rect
          x={32}
          y={36}
          width={176}
          height={138}
          rx={10}
          className="fill-slate-800 dark:stroke-slate-700"
          strokeWidth={2}
        />
        <rect x={32} y={36} width={176} height={22} rx={10} className="fill-slate-700" />
        <circle cx={46} cy={47} r={3} className="fill-rose-400" />
        <circle cx={58} cy={47} r={3} className="fill-amber-400" />
        <circle cx={70} cy={47} r={3} className="fill-emerald-400" />
        {[
          ['fill-emerald-400', 70, 48],
          ['fill-slate-400', 86, 96],
          ['fill-brand-300', 102, 72],
          ['fill-slate-400', 118, 120],
          ['fill-emerald-400', 134, 60],
          ['fill-slate-400', 150, 104],
        ].map(([cls, y, w], i) => (
          <rect
            key={i}
            x={48 + (i % 2) * 10}
            y={y as number}
            width={w as number}
            height={6}
            rx={3}
            className={cls as string}
          />
        ))}
      </g>

      {/* The code builds the app */}
      <Arrow from={[214, 105]} to={[268, 105]} tone="accent" />

      {/* The app */}
      <rect
        x={276}
        y={56}
        width={120}
        height={98}
        rx={10}
        className="fill-white stroke-brand-300"
        strokeWidth={0.75}
      />
      <rect x={276} y={56} width={120} height={20} rx={10} className="fill-brand-100" />
      <Label x={336} y={67} anchor="middle" size={10} weight={700} tone="accent">
        The app
      </Label>
      <Room x={286} y={84} w={100} h={60} name="Lounge" door="none" />
      <Sofa x={300} y={104} />
      <Plant cx={366} cy={126} s={0.8} />

      {/* MIT licence tag */}
      <g transform="translate(32 178)">
        <rect
          width={72}
          height={22}
          rx={7}
          className="fill-white stroke-brand-300"
          strokeWidth={1.5}
        />
        <Label x={36} y={12} anchor="middle" size={10} weight={700} tone="accent">
          MIT licence
        </Label>
      </g>
    </Scene>
  );
}
