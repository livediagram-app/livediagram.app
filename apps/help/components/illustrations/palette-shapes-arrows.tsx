// Palette-category illustrations (docs/specs/018-help/help-app.md): the Shapes and Arrows the palette
// places, morphing one shape kind into another, shape markers, style presets,
// arrow styles, draggable curve / elbow handles, and arrow-to-arrow snapping.
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, SelectionBox, Cursor, Menu, Label, TextBar } from './primitives';

/** A gallery of the shape kinds the Shapes tab offers, in a tidy grid. */
export function ShapeGallery() {
  const cells: { kind: Parameters<typeof Shape>[0]['kind']; label: string }[] = [
    { kind: 'rect', label: 'Square' },
    { kind: 'circle', label: 'Circle' },
    { kind: 'diamond', label: 'Diamond' },
    { kind: 'cylinder', label: 'Cylinder' },
    { kind: 'hexagon', label: 'Hexagon' },
    { kind: 'parallelogram', label: 'Parallelogram' },
    { kind: 'stadium', label: 'Stadium' },
    { kind: 'triangle', label: 'Triangle' },
  ];
  const cw = 100;
  const ch = 56;
  return (
    <Scene w={420} h={240}>
      {cells.map((c, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const sx = 12 + col * cw;
        const sy = 26 + row * (ch + 56);
        return (
          <g key={i}>
            <Shape x={sx + 16} y={sy} w={cw - 32} h={ch} kind={c.kind} accent={i === 0} />
            <Label x={sx + cw / 2} y={sy + ch + 16} anchor="middle" size={9} tone="muted">
              {c.label}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

/** A selected square being morphed into a cylinder in place, via the
 *  right-click menu's shape-kind picker. */
export function ShapeMorph() {
  return (
    <Scene w={420} h={240}>
      <Shape x={40} y={138} w={104} h={60} kind="rect" accent label="Store" />
      <SelectionBox x={40} y={138} w={104} h={60} />
      <Arrow from={[152, 168]} to={[244, 168]} kind="curved" tone="muted" dashed />
      <Shape x={252} y={134} w={104} h={68} kind="cylinder" accent label="Store" />
      <Menu
        x={135}
        y={26}
        w={150}
        items={['Square', 'Cylinder', 'Diamond', 'Hexagon']}
        active={1}
        rowH={24}
      />
      <Label x={145} y={18} size={8} weight={700} tone="muted">
        SHAPE
      </Label>
    </Scene>
  );
}

/** A traffic-light status dot inside one shape and a checkbox marker in
 *  another, sitting just left of each shape's label. */
export function ShapeMarkers() {
  return (
    <Scene w={420} h={170}>
      {/* Traffic-light dot */}
      <Shape x={44} y={56} w={140} h={58} kind="rect" label="" />
      <circle cx={70} cy={85} r={9} className="fill-emerald-500 stroke-white" strokeWidth={2} />
      <Label x={90} y={86} size={10} weight={500} tone="strong">
        On track
      </Label>
      {/* Checkbox marker */}
      <Shape x={236} y={56} w={140} h={58} kind="rect" label="" />
      <g transform="translate(254 76)">
        <rect
          width={18}
          height={18}
          rx={4}
          className="fill-white stroke-brand-500"
          strokeWidth={2}
        />
        <path
          d="M3 9 L7 13 L15 4"
          className="stroke-brand-500"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <Label x={284} y={86} size={10} weight={500} tone="strong">
        Done
      </Label>
    </Scene>
  );
}

/** A row of one-click colour and border presets, applied to a shape. */
export function StylePresets() {
  const colours = ['fill-brand-500', 'fill-emerald-500', 'fill-violet-500', 'fill-amber-500'];
  return (
    <Scene w={420} h={220}>
      <Label x={210} y={22} anchor="middle" size={8} weight={700} tone="muted">
        PRESETS
      </Label>
      {/* Colour swatch row */}
      {colours.map((cls, i) => {
        const sx = 60 + i * 78;
        const sel = i === 1;
        return (
          <g key={i}>
            <rect
              x={sx}
              y={40}
              width={56}
              height={36}
              rx={8}
              className={`${cls} ${sel ? 'stroke-brand-600' : 'stroke-slate-200'}`}
              strokeWidth={sel ? 3 : 1.5}
            />
          </g>
        );
      })}
      {/* Border swatch row */}
      {['solid', 'dashed', 'dotted', 'thick'].map((kind, i) => {
        const sx = 60 + i * 78;
        const dash = kind === 'dashed' ? '6 4' : kind === 'dotted' ? '1 5' : undefined;
        return (
          <rect
            key={i}
            x={sx}
            y={90}
            width={56}
            height={36}
            rx={8}
            className="fill-white stroke-brand-500"
            strokeWidth={kind === 'thick' ? 4 : 2}
            strokeDasharray={dash}
            strokeLinecap="round"
          />
        );
      })}
      {/* The shape the chosen preset lands on */}
      <Arrow from={[210, 132]} to={[210, 158]} tone="muted" />
      <Shape
        x={152}
        y={162}
        w={116}
        h={48}
        kind="rect"
        fill="fill-emerald-500"
        stroke="stroke-emerald-600"
        label="Styled"
        labelTone="onAccent"
      />
    </Scene>
  );
}

/** Three shapes wired up with arrows of different styles: straight, curved,
 *  and an elbow. */
export function ArrowsConnecting() {
  return (
    <Scene w={420} h={220}>
      <Shape x={40} y={88} w={88} h={48} kind="rect" label="Start" />
      <Shape x={186} y={40} w={88} h={48} kind="diamond" />
      <Shape x={300} y={140} w={88} h={48} kind="rect" accent label="Done" />
      <Arrow from={[128, 112]} to={[186, 80]} kind="straight" />
      <Arrow from={[274, 64]} to={[344, 140]} kind="curved" />
      <Arrow from={[84, 136]} to={[300, 176]} kind="elbow" dashed />
    </Scene>
  );
}

/** The same connector shown straight, curved, and elbow side by side. */
export function ArrowStyles() {
  const cols: { kind: 'straight' | 'curved' | 'elbow'; label: string }[] = [
    { kind: 'straight', label: 'Straight' },
    { kind: 'curved', label: 'Curved' },
    { kind: 'elbow', label: 'Angled' },
  ];
  const cw = 140;
  return (
    <Scene w={420} h={190}>
      {cols.map((c, i) => {
        const x0 = i * cw;
        const ax = x0 + 22;
        const bx = x0 + cw - 22;
        return (
          <g key={i}>
            <Shape x={ax} y={48} w={36} h={28} kind="rect" />
            <Shape x={bx - 36} y={104} w={36} h={28} kind="rect" />
            <Arrow from={[ax + 36, 62]} to={[bx - 36, 118]} kind={c.kind} />
            <Label x={x0 + cw / 2} y={168} anchor="middle" size={10} weight={600} tone="muted">
              {c.label}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

/** A curved arrow being reshaped by dragging its midpoint handle. */
export function CurveElbowHandles() {
  return (
    <Scene w={420} h={210}>
      <Shape x={36} y={120} w={80} h={46} kind="rect" label="A" />
      <Shape x={304} y={120} w={80} h={46} kind="rect" accent label="B" />
      {/* The curved path being shaped */}
      <Arrow from={[116, 143]} to={[304, 143]} kind="curved" />
      {/* Drag trail to the handle */}
      <path
        d="M210 110 q-4 -22 0 -42"
        className="stroke-slate-300"
        strokeWidth={2}
        strokeDasharray="4 4"
        fill="none"
      />
      {/* The draggable handle on the curve */}
      <circle cx={210} cy={68} r={8} className="fill-white stroke-brand-500" strokeWidth={2.5} />
      <Cursor x={216} y={72} colour="brand" />
    </Scene>
  );
}

/** A message arrow whose endpoint is snapped onto a vertical lifeline arrow,
 *  the sequence-diagram pattern, with the lifeline's snap points showing. */
export function ArrowToArrow() {
  const lifelineX = 280;
  return (
    <Scene w={420} h={230}>
      <Shape x={66} y={24} w={92} h={40} kind="rect" label="Caller" />
      <Shape x={234} y={24} w={92} h={40} kind="rect" label="Service" />
      {/* Two lifeline arrows */}
      <Arrow from={[112, 64]} to={[112, 212]} tone="muted" head={false} />
      <Arrow from={[lifelineX, 64]} to={[lifelineX, 212]} tone="muted" head={false} />
      {/* Snap points along the target lifeline */}
      {[96, 128, 160, 192].map((y) => (
        <circle key={y} cx={lifelineX} cy={y} r={3} className="fill-brand-300" />
      ))}
      {/* The message arrow, endpoint snapped onto the lifeline */}
      <Arrow from={[112, 128]} to={[lifelineX, 128]} kind="straight" />
      <circle
        cx={lifelineX}
        cy={128}
        r={5}
        className="fill-brand-500 stroke-white"
        strokeWidth={2}
      />
      <Label x={150} y={118} size={10} weight={500} tone="muted">
        request
      </Label>
      {/* The return message */}
      <Arrow from={[lifelineX, 192]} to={[112, 192]} kind="straight" dashed />
      <TextBar x={150} y={200} w={48} tone="faint" />
    </Scene>
  );
}
