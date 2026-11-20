// The editing surfaces behind the Tools-family elements: the context menu's Tools
// flyout (docs/specs/008-canvas/canvas-and-palette.md) with a Checklist, Progress or
// Data section open, the Code dialog (docs/specs/009-elements/code-block.md), the line
// chart's Chart Data dialog (docs/specs/009-elements/pie-chart.md), and a table's row and
// column controls (those three drawn in tools-dialogs.tsx). Every label is the editor's own string. Composed from the
// shared primitives; raw shapes only for motifs the kit lacks.

import { Scene, Panel, Button, Label, Menu } from '@liveworkspace/help-site/art/primitives';
import { Field } from './tools-dialogs';

export { CodeDialog, LineDataDialog, TableEditControls } from './tools-dialogs';

// --- Building blocks ---------------------------------------------------------

/** The element menu with its Tools row open, and the Tools flyout beside it
 *  showing one accordion section expanded. `children` draws the section body
 *  from `bodyY` down. */
function ToolsFlyout({
  section,
  flyoutH,
  sceneH,
  row = 'Tools',
  children,
}: {
  section: string;
  flyoutH: number;
  sceneH: number;
  // The menu row the flyout hangs from.
  row?: 'Tools' | 'Animation';
  children: React.ReactNode;
}) {
  return (
    <Scene w={420} h={sceneH} bg="plain">
      <Menu
        x={20}
        y={24}
        w={112}
        items={['Appearance', 'Tools', 'Animation']}
        active={row === 'Tools' ? 1 : 2}
      />
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

/** Tools → Progress: the Percentage slider. */
export function ProgressMenu() {
  return (
    <ToolsFlyout section="Progress" flyoutH={80} sceneH={128}>
      <Label x={158} y={72} size={10} tone="muted">
        Percentage
      </Label>
      <Label x={386} y={72} anchor="end" size={10} weight={600} tone="body">
        70%
      </Label>
      <rect x={158} y={84} width={228} height={5} rx={2.5} className="fill-slate-200" />
      <rect x={158} y={84} width={160} height={5} rx={2.5} className="fill-brand-500" />
      <circle cx={318} cy={86.5} r={7} className="fill-white stroke-brand-500" strokeWidth={2} />
    </ToolsFlyout>
  );
}

/** Animation for a progress bar or ring: its one category, so the fill's tiles show inline. */
export function ProgressAnimationMenu() {
  const anims = ['None', 'Fill', 'Pulse', 'Stripes'];
  return (
    <ToolsFlyout section="Animation" row="Animation" flyoutH={100} sceneH={146}>
      {anims.map((a, i) => {
        const tx = 158 + i * 58;
        // None, so the flyout is complete: an animation would add Speed and Repeat rows below.
        const on = a === 'None';
        return (
          <g key={a}>
            <rect
              x={tx}
              y={66}
              width={54}
              height={50}
              rx={7}
              className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
              strokeWidth={1.4}
            />
            <rect x={tx + 9} y={80} width={36} height={8} rx={4} className="fill-slate-200" />
            {a !== 'None' && (
              <rect
                x={tx + 9}
                y={80}
                width={a === 'Fill' ? 22 : 30}
                height={8}
                rx={4}
                className={on ? 'fill-brand-500' : 'fill-brand-300'}
              />
            )}
            <Label
              x={tx + 27}
              y={104}
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
