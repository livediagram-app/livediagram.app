// The Tools-family dialogs and controls (tools-menus.tsx re-exports them): the Code dialog
// (docs/specs/009-elements/code-block.md), the line chart's Chart Data dialog (docs/specs/009-elements/pie-chart.md)
// and a table's row and column controls, with the text field they and the Tools flyout share. Every label is the
// editor's own string.

import {
  Scene,
  Dialog,
  Button,
  Label,
  TextBar,
  Menu,
} from '@liveworkspace/help-site/art/primitives';

/** A small rounded text field with its typed value. */
export function Field({ x, y, w, value }: { x: number; y: number; w: number; value: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={x + 7} y={y + 11} size={10} tone="body">
        {value}
      </Label>
    </g>
  );
}

/** The Code dialog a double-click opens: the dark editor, the Language
 *  dropdown, Cancel and Save. */
export function CodeDialog() {
  const lines = [
    [0, 72, 'fill-violet-400'],
    [14, 110, 'fill-sky-300'],
    [14, 88, 'fill-emerald-400'],
    [0, 20, 'fill-slate-300'],
  ] as const;
  return (
    <Scene w={420} h={236} bg="plain">
      <Dialog x={40} y={14} w={340} h={208} title="Code" sceneW={420} sceneH={236} scrim={false}>
        <g className="help-art-as-drawn">
          <rect
            x={56}
            y={60}
            width={308}
            height={100}
            rx={8}
            className="fill-slate-800 stroke-slate-600"
            strokeWidth={1.5}
          />
          {lines.map(([indent, w, cls], i) => (
            <rect
              key={i}
              x={70 + indent}
              y={76 + i * 18}
              width={w}
              height={7}
              rx={3.5}
              className={cls}
            />
          ))}
        </g>
        <Label x={56} y={186} size={11} tone="body">
          Language
        </Label>
        <rect
          x={110}
          y={175}
          width={70}
          height={22}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.4}
        />
        <Label x={120} y={187} size={11} tone="body">
          ts
        </Label>
        <path
          d="M166 184 l3 3 l3 -3"
          fill="none"
          className="stroke-slate-400"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Button x={244} y={175} w={56} h={24} label="Cancel" />
        <Button x={308} y={175} w={56} h={24} label="Save" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** The line chart's Chart Data dialog: Import CSV, a row per category and a
 *  column per series, + Add row and Done. */
export function LineDataDialog() {
  const series = ['Series 1', 'Series 2'];
  const rows: [string, number, number][] = [
    ['Jan', 10, 5],
    ['Feb', 25, 12],
    ['Mar', 18, 22],
  ];
  return (
    <Scene w={420} h={240} bg="plain">
      <Dialog
        x={30}
        y={12}
        w={360}
        h={218}
        title="Chart Data"
        sceneW={420}
        sceneH={240}
        scrim={false}
      >
        <Button x={46} y={58} w={84} h={22} label="Import CSV" />
        {/* Each series name has its own remove ×, as the dialog draws it */}
        {series.map((s, i) => (
          <g key={s}>
            <Field x={136 + i * 96} y={92} w={76} value={s} />
            <Label x={222 + i * 96} y={103} anchor="middle" size={11} tone="muted">
              ×
            </Label>
          </g>
        ))}
        <rect
          x={328}
          y={92}
          width={20}
          height={20}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={338} y={103} anchor="middle" size={11} tone="body">
          +
        </Label>
        {rows.map(([cat, a, b], r) => {
          const ry = 120 + r * 26;
          return (
            <g key={cat}>
              <Field x={46} y={ry} w={82} value={cat} />
              <Field x={136} y={ry} w={88} value={String(a)} />
              <Field x={232} y={ry} w={88} value={String(b)} />
              <Label x={338} y={ry + 11} anchor="middle" size={12} tone="muted">
                ×
              </Label>
            </g>
          );
        })}
        <Button x={46} y={198} w={74} h={22} label="+ Add row" />
        <Button x={314} y={198} w={60} h={22} label="Done" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** A selected table with its structural controls: a ⋯ above each column and
 *  beside each row, and the + on the right and bottom edges. */
export function TableEditControls() {
  const x = 110;
  const y = 58;
  const cw = 70;
  const ch = 32;
  const cols = 3;
  const rows = 3;
  const W = cw * cols;
  const H = ch * rows;
  const dots = (cx: number, cy: number, key: string, on = false) => (
    <g key={key}>
      <circle
        cx={cx}
        cy={cy}
        r={10}
        className={on ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-300'}
        strokeWidth={1.4}
      />
      <Label x={cx} y={cy} anchor="middle" size={11} weight={700} tone={on ? 'onAccent' : 'body'}>
        ⋯
      </Label>
    </g>
  );
  const plus = (cx: number, cy: number, key: string) => (
    <g key={key}>
      <circle
        cx={cx}
        cy={cy}
        r={10}
        className="fill-brand-500 stroke-brand-600"
        strokeWidth={1.4}
      />
      <Label x={cx} y={cy + 1} anchor="middle" size={13} weight={700} tone="onAccent">
        +
      </Label>
    </g>
  );
  return (
    <Scene w={420} h={236}>
      <rect
        x={x}
        y={y}
        width={W}
        height={H}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <rect x={x} y={y} width={W} height={ch} className="fill-brand-100" />
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={x + (i + 1) * cw}
          y1={y}
          x2={x + (i + 1) * cw}
          y2={y + H}
          className="stroke-slate-300"
          strokeWidth={1.2}
        />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={x}
          y1={y + (i + 1) * ch}
          x2={x + W}
          y2={y + (i + 1) * ch}
          className="stroke-slate-300"
          strokeWidth={1.2}
        />
      ))}
      {[0, 1, 2].map((c) => (
        <TextBar key={`h${c}`} x={x + c * cw + 12} y={y + ch / 2 - 3} w={40} tone="accent" />
      ))}
      {[1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <TextBar key={`${r}-${c}`} x={x + c * cw + 12} y={y + r * ch + ch / 2 - 3} w={36} />
        )),
      )}
      <rect
        x={x - 2}
        y={y - 2}
        width={W + 4}
        height={H + 4}
        className="fill-none stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {[0, 1, 2].map((c) => dots(x + c * cw + cw / 2, y - 18, `c${c}`, c === 0))}
      {[0, 1, 2].map((r) => dots(x - 18, y + r * ch + ch / 2, `r${r}`))}
      {plus(x + W + 22, y + H / 2, 'right')}
      {plus(x + W / 2, y + H + 22, 'bottom')}
      <Menu
        x={x + cw / 2 + 12}
        y={y - 8}
        w={118}
        rowH={20}
        items={['Insert left', 'Insert right', 'Move left', 'Move right', 'Delete column']}
        active={1}
      />
    </Scene>
  );
}
