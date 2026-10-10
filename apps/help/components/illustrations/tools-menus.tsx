// The editing surfaces behind the Tools-family elements: the context menu's Tools
// flyout (docs/specs/008-canvas/canvas-and-palette.md) with a Checklist, Progress, Data or
// Portal section open, the Code dialog (docs/specs/009-elements/code-block.md), the line
// chart's Chart data dialog (docs/specs/009-elements/pie-chart.md), and a table's row and
// column controls. Every label is the editor's own string. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks.

import { Scene, Panel, Dialog, Button, Label, TextBar, Menu, Arrow } from './primitives';

// --- Building blocks ---------------------------------------------------------

/** The element menu with its Tools row open, and the Tools flyout beside it
 *  showing one accordion section expanded. `children` draws the section body
 *  from `bodyY` down. */
function ToolsFlyout({
  section,
  flyoutH,
  sceneH,
  children,
}: {
  section: string;
  flyoutH: number;
  sceneH: number;
  children: React.ReactNode;
}) {
  return (
    <Scene w={420} h={sceneH} bg="plain">
      <Menu x={20} y={24} w={112} items={['Style', 'Tools', 'Animation']} active={1} />
      <Panel x={144} y={24} w={256} h={flyoutH}>
        <Label x={160} y={42} size={11} weight={700} tone="strong">
          {section}
        </Label>
        <path
          d="M378 39 l4 4 l4 -4"
          fill="none"
          className="stroke-slate-400"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1={144} y1={56} x2={400} y2={56} className="stroke-slate-200" strokeWidth={1.2} />
        {children}
      </Panel>
    </Scene>
  );
}

/** A small rounded text field with its typed value. */
function Field({ x, y, w, value }: { x: number; y: number; w: number; value: string }) {
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

/** A square checkbox, ticked when `on`. */
function Check({ x, y, on }: { x: number; y: number; on: boolean }) {
  return on ? (
    <g>
      <rect x={x} y={y} width={14} height={14} rx={4} className="fill-brand-500" />
      <path
        d={`M${x + 3.5} ${y + 7} l2.8 2.8 l5.2 -6`}
        fill="none"
        className="stroke-white help-art-as-drawn"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ) : (
    <rect
      x={x}
      y={y}
      width={14}
      height={14}
      rx={4}
      className="fill-white stroke-slate-300"
      strokeWidth={1.6}
    />
  );
}

/** A full-width secondary button inside a menu section. */
function SectionButton({ y, label }: { y: number; label: string }) {
  return <Button x={158} y={y} w={228} h={22} label={label} />;
}

// --- Scenes ------------------------------------------------------------------

/** Tools → Checklist: a done toggle, the row text and a remove per row, then
 *  Add Row. */
export function ChecklistMenu() {
  const rows: [boolean, string][] = [
    [true, 'Book the room'],
    [true, 'Send the invite'],
    [false, 'Write the agenda'],
  ];
  return (
    <ToolsFlyout section="Checklist" flyoutH={170} sceneH={212}>
      {rows.map(([done, text], i) => {
        const ry = 68 + i * 28;
        return (
          <g key={text}>
            <Check x={158} y={ry + 3} on={done} />
            <Field x={180} y={ry} w={180} value={text} />
            <Label x={376} y={ry + 11} anchor="middle" size={12} tone="muted">
              ×
            </Label>
          </g>
        );
      })}
      <SectionButton y={156} label="+ Add Row" />
    </ToolsFlyout>
  );
}

/** Tools → Progress: the Percentage slider and the four fill-animation tiles. */
export function ProgressMenu() {
  const anims = ['None', 'Fill', 'Pulse', 'Stripes'];
  return (
    <ToolsFlyout section="Progress" flyoutH={150} sceneH={196}>
      <Label x={158} y={72} size={10} tone="muted">
        Percentage
      </Label>
      <Label x={386} y={72} anchor="end" size={10} weight={600} tone="body">
        70%
      </Label>
      <rect x={158} y={84} width={228} height={5} rx={2.5} className="fill-slate-200" />
      <rect x={158} y={84} width={160} height={5} rx={2.5} className="fill-brand-500" />
      <circle cx={318} cy={86.5} r={7} className="fill-white stroke-brand-500" strokeWidth={2} />
      {anims.map((a, i) => {
        const tx = 158 + i * 58;
        // None, so the flyout is complete: an animation would add Speed and Repeat rows below.
        const on = a === 'None';
        return (
          <g key={a}>
            <rect
              x={tx}
              y={108}
              width={54}
              height={50}
              rx={7}
              className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
              strokeWidth={1.4}
            />
            <rect x={tx + 9} y={122} width={36} height={8} rx={4} className="fill-slate-200" />
            {a !== 'None' && (
              <rect
                x={tx + 9}
                y={122}
                width={a === 'Fill' ? 22 : 30}
                height={8}
                rx={4}
                className={on ? 'fill-brand-500' : 'fill-brand-300'}
              />
            )}
            <Label
              x={tx + 27}
              y={146}
              anchor="middle"
              size={10}
              weight={on ? 700 : 500}
              tone={on ? 'accent' : 'body'}
            >
              {a}
            </Label>
          </g>
        );
      })}
    </ToolsFlyout>
  );
}

/** Tools → Data for a pie or bar chart: a swatch, a label and a value per
 *  slice, then + Add Slice. */
export function ChartDataMenu() {
  const rows: [string, string, number][] = [
    ['fill-brand-500', 'Design', 40],
    ['fill-amber-400', 'Build', 30],
    ['fill-emerald-500', 'Test', 20],
  ];
  return (
    <ToolsFlyout section="Data" flyoutH={160} sceneH={204}>
      {rows.map(([cls, label, value], i) => {
        const ry = 68 + i * 28;
        return (
          <g key={label}>
            <rect x={158} y={ry + 3} width={14} height={14} rx={3} className={cls} />
            <Field x={180} y={ry} w={118} value={label} />
            <Field x={306} y={ry} w={52} value={String(value)} />
            <Label x={376} y={ry + 11} anchor="middle" size={12} tone="muted">
              ×
            </Label>
          </g>
        );
      })}
      <SectionButton y={156} label="+ Add Slice" />
    </ToolsFlyout>
  );
}

/** A tall portal ring in the given hue: an outer bloom, a bright rim and a
 *  dark mouth. Dimmed when it leads nowhere. */
function PortalRing({
  cx,
  cy,
  hue,
  dim = false,
}: {
  cx: number;
  cy: number;
  hue: 'brand' | 'amber';
  dim?: boolean;
}) {
  const rim = hue === 'brand' ? 'stroke-brand-400' : 'stroke-amber-400';
  const bloom = hue === 'brand' ? 'fill-brand-100' : 'fill-amber-100';
  return (
    <g opacity={dim ? 0.45 : 1}>
      <ellipse cx={cx} cy={cy} rx={30} ry={46} className={bloom} />
      <ellipse cx={cx} cy={cy} rx={22} ry={38} className="fill-slate-700" />
      <ellipse cx={cx} cy={cy} rx={22} ry={38} fill="none" className={rim} strokeWidth={4} />
    </g>
  );
}

/** Two linked portals on the canvas, and the Portal section of the menu:
 *  Name, the Leads to grid (with a portal on another tab), and Create Portal. */
export function PortalMenu() {
  const tiles = ['Portal 2', 'Portal 3 · Detail', 'Create Portal'];
  return (
    <Scene w={420} h={236}>
      <PortalRing cx={56} cy={84} hue="brand" />
      <PortalRing cx={56} cy={186} hue="amber" />
      <Arrow from={[92, 104]} to={[92, 168]} kind="straight" tone="muted" dashed />
      <Panel x={140} y={20} w={260} h={196}>
        <Label x={156} y={38} size={11} weight={700} tone="strong">
          Portal
        </Label>
        <line x1={140} y1={52} x2={400} y2={52} className="stroke-slate-200" strokeWidth={1.2} />
        <Label x={156} y={66} size={10} tone="muted">
          Name
        </Label>
        <Field x={156} y={76} w={228} value="Back to overview" />
        <Label x={156} y={112} size={10} tone="muted">
          Leads to
        </Label>
        {tiles.map((t, i) => {
          const tx = 156 + (i % 2) * 116;
          const ty = 124 + Math.floor(i / 2) * 42;
          const on = i === 0;
          return (
            <g key={t}>
              <rect
                x={tx}
                y={ty}
                width={110}
                height={36}
                rx={7}
                className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
                strokeWidth={1.4}
              />
              <Label
                x={tx + 55}
                y={ty + 19}
                anchor="middle"
                size={10}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {t === 'Create Portal' ? `+ ${t}` : t}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
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

/** The line chart's Chart data dialog: Import CSV, a row per category and a
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
        title="Chart data"
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
