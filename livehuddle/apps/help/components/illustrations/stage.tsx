// Stage illustrations (docs/specs/018-help/help-app.md, docs/specs/012-collaboration/meeting-rooms-and-stage.md): a
// hall seen from above with a speaker on its stage heard by the whole tab, and the element menu's Stage section.
// Calls cannot run without the Realtime secrets, so these are drawn rather than shot, from the editor's own words:
// apps/editor/components/palette/StageMenuSection.tsx (Who Can Speak, Editors, Editors and Participants, Show
// Cameras) and the stage's drawing (packages/document/src/office.ts: a top, a front face and a name plate).

import { Avatar, Label, Panel, Scene } from '@liveworkspace/help-site/art/primitives';
import { Switch } from '@liveworkspace/help-site/art/illustrations/settings-dialog';

// --- The hall ----------------------------------------------------------------

const HALL = { x: 20, y: 14, w: 300, h: 208 };
const WALL = 6;
const STAGE = { x: 95, y: 32, w: 150, h: 50 };
const FRONT = 16;
const SEAT_XS = [56, 88, 120, 220, 252, 284];
const ROW_YS = [120, 152, 184];

/** A stage as the canvas draws it from the room's camera: its top, the front face below and a name plate. */
function StageDrawing() {
  const plateW = 62;
  return (
    <g>
      <rect
        x={STAGE.x}
        y={STAGE.y}
        width={STAGE.w}
        height={STAGE.h}
        rx={3}
        className="fill-amber-400/25 stroke-amber-500"
        strokeWidth={1.5}
      />
      <path
        d={`M${STAGE.x + 8} ${STAGE.y + 11}h${STAGE.w - 16}M${STAGE.x + 8} ${STAGE.y + 22}h${STAGE.w - 16}`}
        className="stroke-amber-500/40"
        strokeWidth={1}
      />
      <rect
        x={STAGE.x}
        y={STAGE.y + STAGE.h - FRONT}
        width={STAGE.w}
        height={FRONT}
        rx={2}
        className="fill-amber-500/60"
      />
      <rect
        x={STAGE.x + (STAGE.w - plateW) / 2}
        y={STAGE.y + STAGE.h - FRONT + 2}
        width={plateW}
        height={FRONT - 4}
        rx={2}
        className="fill-white"
      />
      <Label
        x={STAGE.x + STAGE.w / 2}
        y={STAGE.y + STAGE.h - FRONT / 2 + 0.5}
        anchor="middle"
        size={10}
        weight={700}
        tone="strong"
      >
        Stage
      </Label>
    </g>
  );
}

/** A seat seen from above: a small rounded square in the furniture's slate. */
function Seat({ x, y }: { x: number; y: number }) {
  return <rect x={x - 7} y={y - 6} width={14} height={12} rx={3} className="fill-slate-200" />;
}

/** Sound reaching out from the speaker: rings that pass through the whole hall and its walls. */
function Reach({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      {[46, 98, 156].map((r, i) => (
        <path
          key={r}
          d={`M${cx - r} ${cy + 6} A${r} ${r} 0 0 0 ${cx + r} ${cy + 6}`}
          className="stroke-brand-400"
          strokeOpacity={0.7 - i * 0.18}
          strokeWidth={2}
          strokeDasharray="5 6"
        />
      ))}
    </g>
  );
}

export function StageHall() {
  const speaker = { x: STAGE.x + STAGE.w / 2, y: STAGE.y + 16 };
  const door = { x: HALL.x + HALL.w / 2, w: 44 };
  const corridor = { x: 370, y: 176 };
  return (
    <Scene w={420} h={240}>
      {/* The hall's floor and walls, a doorway in the front wall. */}
      <rect x={HALL.x} y={HALL.y} width={HALL.w} height={HALL.h} rx={4} className="fill-slate-50" />
      <path
        d={`M${door.x - door.w / 2} ${HALL.y + HALL.h}H${HALL.x}V${HALL.y}H${HALL.x + HALL.w}V${HALL.y + HALL.h}H${door.x + door.w / 2}`}
        className="stroke-slate-300"
        strokeWidth={WALL}
        fill="none"
        strokeLinejoin="round"
      />
      <StageDrawing />
      <Reach cx={speaker.x} cy={speaker.y} />
      {ROW_YS.flatMap((y) => SEAT_XS.map((x) => <Seat key={`${x}-${y}`} x={x} y={y} />))}
      {/* The audience in its seats, and someone in the corridor outside: all of them hear the stage. */}
      <Avatar cx={88} cy={150} r={9} initial="S" colour="emerald" />
      <Avatar cx={252} cy={150} r={9} initial="P" colour="violet" />
      <Avatar cx={120} cy={182} r={9} initial="M" colour="amber" />
      <Avatar cx={284} cy={182} r={9} initial="J" colour="rose" />
      <Avatar cx={corridor.x} cy={corridor.y} r={9} initial="K" colour="slate" />
      <Avatar cx={speaker.x} cy={speaker.y} r={11} initial="A" colour="brand" />
      <Label x={HALL.x + 10} y={HALL.y + 14} size={10} weight={600} tone="muted">
        All-Hands
      </Label>
      <Label x={corridor.x} y={corridor.y + 24} anchor="middle" size={10} tone="muted">
        Outside,
      </Label>
      <Label x={corridor.x} y={corridor.y + 37} anchor="middle" size={10} tone="muted">
        hears it
      </Label>
      <Label x={340} y={44} size={11} weight={700} tone="accent">
        On the stage
      </Label>
      <Label x={340} y={60} size={10} tone="body">
        Heard by
      </Label>
      <Label x={340} y={74} size={10} tone="body">
        the whole tab
      </Label>
      <path d="M336 52H252" className="stroke-brand-400" strokeWidth={1.5} strokeDasharray="2 3" />
    </Scene>
  );
}

// --- The settings ------------------------------------------------------------

/** One Who Can Speak tile, as the element menu draws it: a glyph over its label, the chosen one tinted. */
function SpeakerTile({
  x,
  y,
  w,
  label,
  active,
  glyph,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  active: boolean;
  glyph: 'pencil' | 'people';
}) {
  const cx = x + w / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={46}
        rx={7}
        className={active ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      <g
        transform={`translate(${cx - 7} ${y + 8}) scale(${14 / 24})`}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? 'stroke-brand-600' : 'stroke-slate-500'}
      >
        {glyph === 'pencil' ? (
          <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        ) : (
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </>
        )}
      </g>
      <Label
        x={cx}
        y={y + 35}
        anchor="middle"
        size={10}
        weight={active ? 600 : 400}
        tone={active ? 'accent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
}

export function StageSettings() {
  const panel = { x: 60, y: 12, w: 300, h: 200 };
  const inner = panel.x + 12;
  const tileW = (panel.w - 24 - 6) / 2;
  return (
    <Scene w={420} h={220}>
      <Panel x={panel.x} y={panel.y} w={panel.w} h={panel.h} title="Stage" />
      <Label x={inner} y={panel.y + 38} size={10} weight={600} tone="muted">
        Who Can Speak
      </Label>
      <SpeakerTile x={inner} y={panel.y + 48} w={tileW} label="Editors" active glyph="pencil" />
      <SpeakerTile
        x={inner + tileW + 6}
        y={panel.y + 48}
        w={tileW}
        label="Editors and Participants"
        active={false}
        glyph="people"
      />
      <Label x={inner} y={panel.y + 112} size={10} tone="muted">
        Who the whole tab hears from the stage.
      </Label>
      <Label x={inner} y={panel.y + 126} size={10} tone="muted">
        Anyone else on it is heard as the audience is.
      </Label>
      <path d={`M${panel.x} ${panel.y + 142}H${panel.x + panel.w}`} className="stroke-slate-200" />
      <Label x={inner} y={panel.y + 162} size={10} weight={600} tone="strong">
        Show Cameras
      </Label>
      <Label x={inner} y={panel.y + 180} size={10} tone="muted">
        Everyone on the tab sees a speaker&apos;s camera
      </Label>
      <Switch x={panel.x + panel.w - 38} y={panel.y + 164} on />
    </Scene>
  );
}
